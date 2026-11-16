/**
 * Stateless signed cookies: `<expiry-unix-seconds>.<user>.<base64url HMAC-SHA256 of "<purpose>:<expiry>:<user>">`.
 * Nothing is stored server-side; the signature proves this Worker issued the cookie, the purpose stops one
 * kind of cookie being used as another, and the expiry bounds how long it works. Rotating SESSION_SECRET
 * invalidates every cookie at once.
 *
 * Two kinds:
 *  - the session (24 hours): the visitor is logged on, as `user`.
 *  - the pass (5 minutes): `user` passed the bot check and may now type their password.
 */

export const SESSION_COOKIE = 'xp_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24

export const PASS_COOKIE = 'xp_pass'
export const PASS_TTL_SECONDS = 5 * 60

type Purpose = 'session' | 'pass'

const encoder = new TextEncoder()

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

const importKey = (secret: string) =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])

const payload = (purpose: Purpose, expiry: number | string, user: string) =>
  encoder.encode(`${purpose}:${expiry}:${user}`)

/** User ids are short lowercase slugs ("trent", "family", "guests"), so they never contain a dot. */
const USER_ID = /^[a-z][a-z0-9-]{0,31}$/

async function createToken(secret: string, purpose: Purpose, user: string, ttl: number): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + ttl
  const signature = await crypto.subtle.sign('HMAC', await importKey(secret), payload(purpose, expiry, user))
  return `${expiry}.${user}.${toBase64Url(new Uint8Array(signature))}`
}

/** The user a token was issued to, or null if it is malformed, forged, expired, or for another purpose. */
async function tokenUser(secret: string, purpose: Purpose, token: string): Promise<string | null> {
  const [expiry, user, signature, ...rest] = token.split('.')
  if (!expiry || !user || !signature || rest.length > 0) return null
  if (!/^\d{1,12}$/.test(expiry) || !USER_ID.test(user)) return null
  if (Number(expiry) <= Math.floor(Date.now() / 1000)) return null
  const signatureBytes = fromBase64Url(signature)
  if (!signatureBytes) return null
  // `verify` compares in constant time.
  const ok = await crypto.subtle.verify('HMAC', await importKey(secret), signatureBytes, payload(purpose, expiry, user))
  return ok ? user : null
}

export function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return value.join('=')
  }
  return null
}

async function cookieUser(request: Request, secret: string | undefined, name: string, purpose: Purpose) {
  if (!secret) return null
  const token = readCookie(request, name)
  return token ? tokenUser(secret, purpose, token) : null
}

/** The logged-on user, or null when the request has no valid session. */
export const sessionUser = (request: Request, secret: string | undefined) =>
  cookieUser(request, secret, SESSION_COOKIE, 'session')

/** The user who just passed the bot check and may type a password, or null. */
export const passUser = (request: Request, secret: string | undefined) =>
  cookieUser(request, secret, PASS_COOKIE, 'pass')

/**
 * The session is Lax so arriving from a link on another site keeps you logged on; the pass is Strict, as it
 * is only ever sent by this site's own log-on screen.
 */
function cookieAttributes(request: Request, path = '/', sameSite: 'Lax' | 'Strict' = 'Lax'): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `Path=${path}; HttpOnly; SameSite=${sameSite}${secure}`
}

/** A `Set-Cookie` value that logs `user` on. */
export async function startSessionCookie(request: Request, secret: string, user: string): Promise<string> {
  const token = await createToken(secret, 'session', user, SESSION_TTL_SECONDS)
  return `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_TTL_SECONDS}; ${cookieAttributes(request)}`
}

/** A `Set-Cookie` value that ends the session. */
export function endSessionCookie(request: Request): string {
  return `${SESSION_COOKIE}=; Max-Age=0; ${cookieAttributes(request)}`
}

/** A `Set-Cookie` value for the short-lived "passed the bot check" pass. Only the password endpoint sees it. */
export async function startPassCookie(request: Request, secret: string, user: string): Promise<string> {
  const token = await createToken(secret, 'pass', user, PASS_TTL_SECONDS)
  return `${PASS_COOKIE}=${token}; Max-Age=${PASS_TTL_SECONDS}; ${cookieAttributes(request, '/api/logon', 'Strict')}`
}

export function endPassCookie(request: Request): string {
  return `${PASS_COOKIE}=; Max-Age=0; ${cookieAttributes(request, '/api/logon', 'Strict')}`
}
