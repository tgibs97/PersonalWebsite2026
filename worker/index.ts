import { bump, ensureVisitor, noteLogin, record, report, visitorOf } from './analytics'
import { arcade } from './arcade'
import { appOfApi, controls, switchedOffFor, switchedOffResponse } from './controls'
import { photos } from './photos'
import { wishlist } from './wishlist'
import { endPassCookie, endSessionCookie, passUser, sessionUser, startPassCookie, startSessionCookie } from './session'
import { MAX_TOKEN_LENGTH, verifyTurnstile } from './turnstile'
import { isAdmin, isMember, isUserId, passwordMatches, passwordVar, USERS } from './users'

/**
 * The log-on gate. `run_worker_first` sends every request here, so nothing from the built site
 * (the desktop bundle, its HTML, future content APIs) is served until the visitor holds a session
 * cookie. Getting one means passing a Turnstile check at `/api/logon`, which keeps bots and AI
 * crawlers out: they get a bare 401 (or the login page with a 401) and never see the site.
 */

const LOGIN_PAGE = '/login.html'

/** Dev-server internals the login page needs while `vite dev` is running. Compiled out of builds. */
const DEV_PUBLIC_PREFIXES = [
  '/@vite/',
  '/@id/',
  '/@fs/',
  '/@react-refresh', // the React plugin injects its preamble into every page, login included
  '/node_modules/',
  '/src/login/',
  '/__vite',
]

/** What a visitor who hasn't logged on may fetch: the login screen's own files and robots.txt. */
/**
 * The members-only apps: built into assets/private/ (see vite.config.ts), or served from source by
 * `vite dev`. Only members may fetch them.
 */
const isPrivatePath = (pathname: string) =>
  pathname.startsWith('/assets/private/') || (import.meta.env.DEV && pathname.startsWith('/src/apps/private/'))

/** The admin-only apps (Trent's Analytics): built into assets/admin/, or served from source by `vite dev`. */
const isAdminPath = (pathname: string) =>
  pathname.startsWith('/assets/admin/') || (import.meta.env.DEV && pathname.startsWith('/src/apps/admin/'))

function isPublicPath(pathname: string): boolean {
  if (pathname === '/robots.txt' || pathname === '/favicon.svg') return true
  if (pathname.startsWith('/login-assets/')) return true
  return import.meta.env.DEV && DEV_PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

const NO_INDEX = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }

function json(body: unknown, status: number, extra: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extra } })
}

const log = (level: 'log' | 'error', message: string, fields: Record<string, unknown> = {}) =>
  console[level](JSON.stringify({ message, ...fields }))

/** The login screen is a static page; the Worker only fills in the (public) Turnstile sitekey. */
async function loginPage(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  let page = await env.ASSETS.fetch(new URL(LOGIN_PAGE, request.url))
  // Built assets canonicalise `/login.html` to `/login`; follow that one hop.
  const location = page.headers.get('Location')
  if (page.status >= 300 && page.status < 400 && location) {
    page = await env.ASSETS.fetch(new URL(location, request.url))
  }
  if (!page.ok) return new Response('Unauthorized', { status: 401, headers: NO_INDEX })

  const headers = new Headers(NO_INDEX)
  headers.set('Content-Type', 'text/html; charset=utf-8')
  // Every browser that reaches the log-on screen is given a visitor id (kept a year) so repeat visits can be recognised.
  ensureVisitor(request, headers)
  bump(env, ctx, 'login_page')
  // 401, not 200: crawlers see "not allowed" instead of indexing the login page at every URL,
  // while browsers still render the body.
  return new HTMLRewriter()
    .on('meta[name="turnstile-sitekey"]', {
      element: (el) => void el.setAttribute('content', env.TURNSTILE_SITE_KEY),
    })
    .transform(new Response(request.method === 'HEAD' ? null : page.body, { status: 401, headers }))
}

function loginRequired(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> | Response {
  const wantsPage =
    (request.method === 'GET' || request.method === 'HEAD') &&
    (request.headers.get('Accept') ?? '').includes('text/html')
  return wantsPage ? loginPage(request, env, ctx) : new Response('Unauthorized', { status: 401, headers: NO_INDEX })
}

/** Reads a small JSON body. Anything oversized or malformed comes back as null. */
async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get('Content-Length') ?? 0) > 8192) return null
  try {
    const body: unknown = await request.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Step 1: the bot check. Guests are logged on by it; users with a password get a short-lived pass instead. */
async function logon(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') return json({ ok: false }, 405, { Allow: 'POST' })

  // Fail closed: without both secrets nobody can log on, rather than everybody.
  if (!env.TURNSTILE_SECRET_KEY || !env.SESSION_SECRET) {
    log('error', 'logon unavailable: TURNSTILE_SECRET_KEY or SESSION_SECRET is not configured')
    return json({ ok: false }, 500)
  }

  const body = await readBody(request)
  const token = body?.token
  const user = body?.user
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH || !isUserId(user)) {
    return json({ ok: false }, 400)
  }

  const secretName = passwordVar(user)
  if (secretName && !env[secretName]) {
    log('error', 'logon unavailable: password secret is not configured', { user, secret: secretName })
    return json({ ok: false }, 500)
  }

  const outcome = await verifyTurnstile(token, request, env)
  if (!outcome.ok) {
    log('log', 'logon rejected', { user, reason: outcome.reason })
    bump(env, ctx, 'bot_failed')
    return json({ ok: false }, 403)
  }
  bump(env, ctx, 'bot_passed')

  const headers = new Headers({ 'Cache-Control': 'no-store' })
  // Logging on (re)sends the visitor id, so its year starts over each time they come back.
  const visitor = ensureVisitor(request, headers, true)

  if (secretName) {
    log('log', 'bot check passed; waiting for password', { user })
    headers.append('Set-Cookie', await startPassCookie(request, env.SESSION_SECRET, user))
    return Response.json({ ok: true, next: 'password' }, { status: 200, headers })
  }

  log('log', 'logon accepted', { user })
  noteLogin(env, ctx, request, visitor, user, 'guest_ok')
  headers.append('Set-Cookie', await startSessionCookie(request, env.SESSION_SECRET, user))
  return Response.json({ ok: true }, { status: 200, headers })
}

/** Step 2, for users with a password: needs the pass from step 1, and the right password. */
async function logonPassword(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') return json({ ok: false }, 405, { Allow: 'POST' })
  if (!env.SESSION_SECRET) return json({ ok: false }, 500)

  // The pass says who passed the bot check; the browser can't choose a different user here.
  const passed = await passUser(request, env.SESSION_SECRET)
  if (!isUserId(passed)) return json({ ok: false, expired: true }, 401)

  const secretName = passwordVar(passed)
  const actual = secretName ? env[secretName] : undefined
  if (!secretName || !actual) return json({ ok: false }, 500)

  const typed = (await readBody(request))?.password
  if (typeof typed !== 'string' || typed.length === 0 || typed.length > 256) return json({ ok: false }, 400)

  if (!(await passwordMatches(typed, actual, env.SESSION_SECRET))) {
    log('log', 'logon rejected', { user: passed, reason: 'wrong_password' })
    noteLogin(env, ctx, request, visitorOf(request) ?? '', passed, 'pw_wrong')
    return json({ ok: false }, 403)
  }

  log('log', 'logon accepted', { user: passed })
  const headers = new Headers({ 'Cache-Control': 'no-store' })
  noteLogin(env, ctx, request, ensureVisitor(request, headers, true), passed, 'pw_ok')
  headers.append('Set-Cookie', await startSessionCookie(request, env.SESSION_SECRET, passed))
  headers.append('Set-Cookie', endPassCookie(request))
  return Response.json({ ok: true }, { status: 200, headers })
}

/** Who is logged on, for the desktop to show. Behind the session check like everything else. */
async function whoami(request: Request, env: Env): Promise<Response> {
  const user = await sessionUser(request, env.SESSION_SECRET)
  if (!isUserId(user)) return json({ ok: false }, 401)
  // The apps Trent has switched off for this user, so the desktop can leave them out.
  const off = [...(await switchedOffFor(env, user))].sort()
  return json({ ok: true, id: user, name: USERS[user].name, admin: isAdmin(user), off }, 200)
}

async function logoff(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ ok: false }, 405, { Allow: 'POST' })
  // Logging off needs no body, but drop any that was sent: an unread body breaks the next request on the
  // same connection under the local dev server.
  await request.arrayBuffer()
  return json({ ok: true }, 200, { 'Set-Cookie': endSessionCookie(request) })
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === '/api/logon') return logon(request, env, ctx)
    if (pathname === '/api/logon/password') return logonPassword(request, env, ctx)
    if (pathname === '/api/logoff') return logoff(request)
    if (pathname === '/api/whoami') return whoami(request, env)

    const user = await sessionUser(request, env.SESSION_SECRET)
    if (isUserId(user)) {
      if (pathname === '/api/controls' || pathname.startsWith('/api/controls/')) return controls(request, env, user)
      const owner = appOfApi(pathname)
      if (owner && (await switchedOffFor(env, user)).has(owner)) return switchedOffResponse()
      if (pathname === '/api/photos' || pathname.startsWith('/api/photos/')) return photos(request, env, ctx, user)
      if (pathname === '/api/wishlist' || pathname.startsWith('/api/wishlist/')) return wishlist(request, env, user)
      if (pathname === '/api/arcade' || pathname.startsWith('/api/arcade/')) return arcade(request, env, user)
      if (pathname === '/api/desk') return record(request, env, ctx, user)
      if (pathname === '/api/desk/report') return report(request, env, user)
      if (isAdminPath(pathname) && !isAdmin(user)) return new Response('Forbidden', { status: 403, headers: NO_INDEX })
      if (isPrivatePath(pathname) && !isMember(user)) return new Response('Forbidden', { status: 403, headers: NO_INDEX })
      return env.ASSETS.fetch(request)
    }
    if (isPublicPath(pathname)) return env.ASSETS.fetch(request)
    return loginRequired(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
