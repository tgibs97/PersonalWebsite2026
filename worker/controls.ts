import { isAdmin, isUserId, USERS, type UserId } from './users'

/*
 * The Control Panel's switches: for each app, Trent picks which of the three users (Guests, Family & Friends,
 * Trent) get it. An app that's off for a user disappears from that user's desktop, and its API refuses them.
 *
 *   GET /api/controls         what's switched off, for each user                       (Trent only)
 *   PUT /api/controls/apps    { apps: { "<app id>": { guests?: bool, family?: bool, trent?: bool } } }   (Trent only)
 *
 * The user's own list of switched-off apps comes with /api/whoami, so the desktop can leave them out. The
 * Photos, Wishlist and Paper Toss APIs check the same list on every request, so a hidden app can't be used
 * by calling its API directly either. An (app, user) pair with no row is on, so a fresh database changes nothing.
 * Trent can switch things off for himself too: the Control Panel can never be switched off, so he can always
 * switch it back on.
 */

const APP_ID = /^[a-z0-9-]{1,40}$/
const MAX_APPS = 50
/** Other isolates may not see a change for this long. (The one that took the change sees it at once.) */
const CACHE_MS = 10_000
/** The Control Panel itself can't be switched off, so Trent can always get back in. */
const LOCKED = new Set(['control-panel'])

/** The URL prefix of each API that belongs to an app, and the app it belongs to. */
const API_OWNERS: [prefix: string, app: string][] = [
  ['/api/photos', 'photos'],
  ['/api/wishlist', 'wishlist'],
  ['/api/arcade', 'recycle-bin'],
  ['/api/desk/report', 'analytics'],
]

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })

type Off = Record<UserId, Set<string>>

const emptyOff = (): Off => ({ guests: new Set(), family: new Set(), trent: new Set() })

let cache: { at: number; off: Off } | null = null

/** The apps that are switched off for each user. If the database can't be read, nothing is hidden (and it is logged). */
async function switchedOffAll(env: Env): Promise<Off> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.off
  const off = emptyOff()
  try {
    if (env.DB) {
      const { results } = await env.DB.prepare('SELECT app_id, user_id FROM app_access WHERE enabled = 0').all<{ app_id: string; user_id: string }>()
      for (const r of results) if (isUserId(r.user_id) && !LOCKED.has(r.app_id)) off[r.user_id].add(r.app_id)
    }
  } catch (error) {
    console.error(JSON.stringify({ event: 'controls_read_failed', error: String(error) }))
    return off
  }
  cache = { at: Date.now(), off }
  return off
}

/** The ids of the apps switched off for this user. */
export async function switchedOffFor(env: Env, user: UserId): Promise<Set<string>> {
  return (await switchedOffAll(env))[user]
}

/** The app an API path belongs to, if it belongs to one that can be switched off. */
export function appOfApi(pathname: string): string | null {
  for (const [prefix, app] of API_OWNERS) if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return app
  return null
}

/** The answer a switched-off app's API gives. */
export const switchedOffResponse = () => json({ ok: false, error: 'This is switched off right now.' }, 404)

const listing = async (env: Env) => {
  const off = await switchedOffAll(env)
  return Object.fromEntries((Object.keys(USERS) as UserId[]).map((u) => [u, [...off[u]].sort()]))
}

export async function controls(request: Request, env: Env, user: UserId): Promise<Response> {
  if (!isAdmin(user)) return json({ ok: false }, 403)
  if (!env.DB) return json({ ok: false, reason: 'unavailable' }, 503)
  const { pathname } = new URL(request.url)

  if (pathname === '/api/controls' && request.method === 'GET') return json({ ok: true, off: await listing(env) })

  if (pathname === '/api/controls/apps' && request.method === 'PUT') {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return json({ ok: false, error: 'That didn’t make sense.' }, 400)
    }
    const apps = (body as { apps?: unknown } | null)?.apps
    if (!apps || typeof apps !== 'object' || Array.isArray(apps)) return json({ ok: false, error: 'No apps given.' }, 400)
    const entries = Object.entries(apps)
    if (entries.length === 0 || entries.length > MAX_APPS) return json({ ok: false, error: 'No apps given.' }, 400)

    const changes: [app: string, user: UserId, on: boolean][] = []
    for (const [id, who] of entries) {
      if (!APP_ID.test(id) || LOCKED.has(id) || !who || typeof who !== 'object' || Array.isArray(who)) {
        return json({ ok: false, error: 'Those switches don’t look right.' }, 400)
      }
      const pairs = Object.entries(who)
      if (pairs.length === 0) return json({ ok: false, error: 'Those switches don’t look right.' }, 400)
      for (const [u, on] of pairs) {
        if (!isUserId(u) || typeof on !== 'boolean') return json({ ok: false, error: 'Those switches don’t look right.' }, 400)
        changes.push([id, u, on])
      }
    }

    const now = Date.now()
    await env.DB.batch(
      changes.map(([app, u, on]) =>
        env.DB.prepare(
          'INSERT INTO app_access (app_id, user_id, enabled, changed_at) VALUES (?, ?, ?, ?) ON CONFLICT (app_id, user_id) DO UPDATE SET enabled = excluded.enabled, changed_at = excluded.changed_at',
        ).bind(app, u, on ? 1 : 0, now),
      ),
    )
    cache = null
    return json({ ok: true, off: await listing(env) })
  }

  return json({ ok: false }, 404)
}
