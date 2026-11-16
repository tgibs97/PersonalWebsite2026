import { readCookie, SESSION_COOKIE } from './session'
import { parseAgent } from './ua'
import { isAdmin, type UserId } from './users'

/*
 * The site's own analytics. Nothing goes to a third party and nothing is loaded from another domain, so
 * ad blockers and privacy browsers have nothing to match: the page sends a small note to this site
 * (`POST /api/desk`), and this file stores it in the D1 database for Trent's Analytics window to read.
 *
 * What is kept, on purpose, to tell repeat visitors apart and spot abuse:
 *   - the visitor's IP address, country/region/city and network (from Cloudflare), and raw browser string;
 *   - a long-lived visitor id (the `xp_vid` cookie, a year), so the same browser is recognised between
 *     visits and across different IP addresses;
 *   - what they did: apps opened and closed (with seconds), links followed, albums and photos viewed,
 *     Paper Toss runs, and every log-on attempt that got as far as a password.
 * All raw rows are deleted after KEEP_DAYS.
 *
 * What is NEVER recorded: anything about the Wishlist (so Trent can't be spoiled by it), the Analytics
 * window, and Trent's own visits (his sessions are ignored; only wrong passwords against his account are noted).
 */

export const KEEP_DAYS = 365
const DAY_MS = 86_400_000
const MAX_BATCH = 30
const MAX_VISIT_EVENTS = 3000
/**
 * "Time on site" adds up the time between a visitor's moves, ignoring any quiet stretch longer than this: a tab
 * left open, or a visitor coming back hours later in the same log-on, would otherwise look like hours on the site.
 */
const IDLE_GAP_MS = 10 * 60_000
const MAX_BODY = 16 * 1024

/** What the page may report. Anything else is dropped. */
const KINDS = new Set(['load', 'open', 'close', 'out', 'game', 'album', 'photo', 'leave'])
/**
 * Apps that are never recorded, whoever opens them: the Wishlist (so Trent can't be spoiled by it), and the
 * Analytics window itself (so his admin tab can't end up in a guest's visit if he browses as someone else).
 */
const NEVER = new Set(['wishlist', 'analytics', 'control-panel'])

const VISITOR_COOKIE = 'xp_vid'
const VISITOR_ID = /^[A-Za-z0-9_-]{22}$/

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

const logFailure = (err: unknown) => console.error(JSON.stringify({ message: 'analytics: write failed', error: String(err).slice(0, 200) }))

// ---------- Who is this? ----------

/** The visitor id this browser already holds, or null. */
export function visitorOf(request: Request): string | null {
  const id = readCookie(request, VISITOR_COOKIE)
  return id && VISITOR_ID.test(id) ? id : null
}

/**
 * The visitor id for this browser, making one if it has none. A new id is sent back as a cookie by adding
 * to `headers`; with `refresh`, an existing one is sent again so its year starts over.
 */
export function ensureVisitor(request: Request, headers: Headers, refresh = false): string {
  const existing = visitorOf(request)
  if (existing && !refresh) return existing
  const id = existing ?? toBase64Url(crypto.getRandomValues(new Uint8Array(16)))
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  headers.append('Set-Cookie', `${VISITOR_COOKIE}=${id}; Max-Age=${365 * 86400}; Path=/; HttpOnly; SameSite=Lax${secure}`)
  return id
}

/** Where a request came from and what it came on. */
function whereFrom(request: Request) {
  const cf = request.cf
  const ua = (request.headers.get('User-Agent') ?? '').slice(0, 400)
  return {
    ip: (request.headers.get('CF-Connecting-IP') ?? 'unknown').slice(0, 64),
    country: String(cf?.country ?? ''),
    region: String(cf?.region ?? '').slice(0, 80),
    city: String(cf?.city ?? '').slice(0, 80),
    asn: typeof cf?.asn === 'number' ? cf.asn : null,
    org: String(cf?.asOrganization ?? '').slice(0, 100),
    ua,
    ...parseAgent(ua),
  }
}

/**
 * A session's visit id: a hash of its cookie, so the cookie itself is never stored. The visitor id is in it
 * too, because a session cookie only carries its expiry second: two people logging on in the same second
 * would otherwise be given the very same visit.
 */
async function visitIdOf(request: Request, visitor: string): Promise<string | null> {
  const cookie = readCookie(request, SESSION_COOKIE)
  if (!cookie) return null
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`visit:${visitor}:${cookie}`))
  return toBase64Url(new Uint8Array(digest).slice(0, 16))
}

// ---------- The log-on screen ----------

/** Log-on attempts worth keeping one by one. Trent's own successful log-ons are not. */
export function noteLogin(env: Env, ctx: ExecutionContext, request: Request, visitor: string, user: string, outcome: 'guest_ok' | 'pw_ok' | 'pw_wrong') {
  if (!env.DB) return
  if (outcome !== 'pw_wrong' && user === 'trent') return
  const w = whereFrom(request)
  ctx.waitUntil(
    env.DB.prepare('INSERT INTO an_logins (at, visitor, user_id, outcome, ip, country, ua) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
      .bind(Date.now(), visitor, user, outcome, w.ip, w.country, w.ua)
      .run()
      .catch(logFailure),
  )
}

// Daily totals for traffic too plentiful to keep row by row. Counts are held in memory and written together a
// short while after the first one arrives, so a bot hammering the log-on screen costs one small write every
// few seconds instead of one per visit, and can't use up the database's daily write allowance. Each count
// carries the day it happened on, so one held across midnight still lands on the right day.
const COUNTER_DELAY_MS = 20_000
const pending = new Map<string, number>()
let flushScheduled = false

async function writeCounters(env: Env): Promise<void> {
  if (pending.size === 0) return
  const statements = [...pending].map(([dayAndKey, n]) => {
    const [day, key] = dayAndKey.split('|')
    return env.DB.prepare('INSERT INTO an_counters (day, key, n) VALUES (?1, ?2, ?3) ON CONFLICT(day, key) DO UPDATE SET n = n + ?3').bind(day, key, n)
  })
  pending.clear()
  await env.DB.batch(statements).then(() => undefined, logFailure)
}

export function bump(env: Env, ctx: ExecutionContext, key: string, by = 1) {
  if (!env.DB) return
  const dayAndKey = `${new Date().toISOString().slice(0, 10)}|${key}`
  pending.set(dayAndKey, (pending.get(dayAndKey) ?? 0) + by)
  if (flushScheduled) return
  flushScheduled = true
  // waitUntil keeps this request's Worker alive long enough to write them, so a count never waits for the next visitor.
  ctx.waitUntil(
    new Promise<void>((resolve) => setTimeout(resolve, COUNTER_DELAY_MS)).then(() => {
      flushScheduled = false
      return writeCounters(env)
    }),
  )
}

// ---------- Recording ----------

interface Note {
  kind: string
  target: string
  detail: string
  at: number
}

const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, max) : '')

const APP_ID = /^[a-z0-9][a-z0-9-]{0,39}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const seconds = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 172_800 ? Math.round(value) : null)

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Each kind of note has one valid shape. Anything else is dropped, so a visitor can't fill the dashboard with
 * made-up app names or odd text. Returns the cleaned target and detail, or null.
 */
function checked(kind: string, target: string, detail: string): { target: string; detail: string } | null {
  switch (kind) {
    case 'load': {
      const d = parseObject(detail) ?? {}
      const out: Record<string, unknown> = {}
      for (const key of ['ref', 'lang', 'tz', 'slug']) if (typeof d[key] === 'string') out[key] = clip(d[key], key === 'ref' ? 100 : 60)
      for (const key of ['w', 'h', 'dpr']) if (typeof d[key] === 'number' && Number.isFinite(d[key])) out[key] = Math.round((d[key] as number) * 100) / 100
      return { target: '', detail: JSON.stringify(out) }
    }
    case 'open':
      return APP_ID.test(target) && !NEVER.has(target) ? { target, detail: '' } : null
    case 'close': {
      const s = seconds(Number(detail))
      return APP_ID.test(target) && !NEVER.has(target) && s !== null ? { target, detail: String(s) } : null
    }
    case 'out':
      return /^https?:\/\/[^\s]{3,290}$/i.test(target) ? { target, detail: '' } : null
    case 'game': {
      const d = parseObject(detail)
      const streak = d?.streak
      if (target !== 'paper-toss' || (d?.mode !== 'baby' && d?.mode !== 'souls') || typeof streak !== 'number' || !Number.isInteger(streak) || streak < 0 || streak > 10_000) return null
      return { target, detail: JSON.stringify({ mode: d.mode, streak }) }
    }
    case 'album':
      return UUID.test(target) ? { target, detail: clip(detail, 80) } : null
    case 'photo':
      return UUID.test(target) && /^\d{1,5}$/.test(detail) ? { target, detail } : null
    case 'leave': {
      const d = parseObject(detail)
      const total = seconds(d?.s)
      if (total === null) return null
      const apps: Record<string, number> = {}
      if (d?.apps && typeof d.apps === 'object') {
        for (const [id, value] of Object.entries(d.apps as Record<string, unknown>).slice(0, 30)) {
          const s = seconds(value)
          if (APP_ID.test(id) && !NEVER.has(id) && s !== null) apps[id] = s
        }
      }
      return { target: '', detail: JSON.stringify({ s: total, apps }) }
    }
    default:
      return null
  }
}

/** The page's notes, checked and tidied. Unknown kinds, the Wishlist, and malformed entries are dropped. */
function cleanNotes(raw: unknown, now: number): Note[] {
  if (!Array.isArray(raw)) return []
  const notes: Note[] = []
  for (const entry of raw.slice(0, MAX_BATCH)) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const kind = clip(e.k, 12)
    if (!KINDS.has(kind)) continue
    const valid = checked(kind, clip(e.t, 300), clip(e.d, 600))
    if (!valid) continue
    // The page says when it happened; it can't claim a time in the future or more than ten minutes ago.
    const ms = typeof e.ms === 'number' && Number.isFinite(e.ms) ? e.ms : now
    notes.push({ kind, ...valid, at: Math.min(now, Math.max(now - 600_000, ms)) })
  }
  return notes
}

/**
 * POST /api/desk: the page reports what the visitor did. Only reached with a valid session.
 * Always answers 204, so there's nothing for a page (or an observer) to learn from it.
 */
export async function record(request: Request, env: Env, ctx: ExecutionContext, user: UserId): Promise<Response> {
  const none = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
  if (request.headers.get('Origin') !== new URL(request.url).origin) return new Response(null, { status: 403 })
  if (!env.DB || isAdmin(user)) return none()

  let body: unknown
  try {
    if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY) return none()
    body = JSON.parse(await request.text())
  } catch {
    return none()
  }

  const now = Date.now()
  const notes = cleanNotes((body as { e?: unknown } | null)?.e, now)
  if (notes.length === 0) return none()
  const headers = new Headers({ 'Cache-Control': 'no-store' })
  const visitor = ensureVisitor(request, headers)
  const visitId = await visitIdOf(request, visitor)
  if (!visitId) return none()
  const w = whereFrom(request)

  try {
    const known = await env.DB.prepare('SELECT events FROM an_visits WHERE id = ?').bind(visitId).first<{ events: number }>()
    // One session can't fill the database: past the cap it only keeps its "last seen" time moving.
    const keep = !known || known.events < MAX_VISIT_EVENTS ? notes : []
    const statements = [
      env.DB.prepare(
        `INSERT INTO an_visits (id, visitor, user_id, started_at, last_at, events, ip, country, region, city, asn, org, ua, browser, os, device)
         VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
         ON CONFLICT(id) DO UPDATE SET last_at = ?4, events = events + ?5`,
      ).bind(visitId, visitor, user, now, keep.length, w.ip, w.country, w.region, w.city, w.asn, w.org, w.ua, w.browser, w.os, w.device),
      ...keep.map((n) =>
        env.DB.prepare('INSERT INTO an_events (visit_id, at, kind, target, detail) VALUES (?1, ?2, ?3, ?4, ?5)').bind(visitId, n.at, n.kind, n.target, n.detail),
      ),
    ]
    await env.DB.batch(statements)
    if (keep.some((n) => n.kind === 'load')) bump(env, ctx, 'desktop')
    if (Math.random() < 0.01) ctx.waitUntil(cleanUp(env))
  } catch (err) {
    logFailure(err)
  }
  return new Response(null, { status: 204, headers })
}

/** Deletes everything older than KEEP_DAYS. */
export async function cleanUp(env: Env): Promise<void> {
  const cutoff = Date.now() - KEEP_DAYS * DAY_MS
  const day = new Date(cutoff).toISOString().slice(0, 10)
  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM an_events WHERE at < ?').bind(cutoff),
      env.DB.prepare('DELETE FROM an_visits WHERE last_at < ?').bind(cutoff),
      env.DB.prepare('DELETE FROM an_logins WHERE at < ?').bind(cutoff),
      env.DB.prepare('DELETE FROM an_counters WHERE day < ?').bind(day),
    ])
  } catch (err) {
    logFailure(err)
  }
}

// ---------- Reporting (Trent only) ----------

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })

type Row = Record<string, unknown>
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

/**
 * GET /api/desk/report?days=7&audience=guests|family|both[&visitor=<id>]
 * Only Trent's login gets an answer.
 */
export async function report(request: Request, env: Env, user: UserId): Promise<Response> {
  if (request.method !== 'GET') return json({ ok: false }, 405)
  if (!isAdmin(user)) return json({ ok: false }, 403)
  if (!env.DB) return json({ ok: false, reason: 'unavailable' }, 503)

  const url = new URL(request.url)
  const days = Math.min(KEEP_DAYS, Math.max(1, Math.floor(Number(url.searchParams.get('days')) || 7)))
  const audience = url.searchParams.get('audience')
  const users = audience === 'family' ? ['family'] : audience === 'both' ? ['guests', 'family'] : ['guests']
  const now = Date.now()
  // "Today" counts as one day: from the start of today (UTC) back, so 7 days is today and the six before.
  const since = new Date(new Date(now).toISOString().slice(0, 10) + 'T00:00:00Z').getTime() - (days - 1) * DAY_MS
  const sinceDay = new Date(since).toISOString().slice(0, 10)
  const marks = users.map(() => '?').join(',')

  const visitor = url.searchParams.get('visitor')
  if (visitor !== null) {
    if (!VISITOR_ID.test(visitor)) return json({ ok: false }, 400)
    return json(await visitorDetail(env, visitor))
  }

  const [summary, returning, perDay, apps, closes, outbound, games, albums, counters, visitors, fails, failIps, twins, active] = await env.DB.batch<Row>([
    env.DB.prepare(`SELECT user_id, COUNT(*) AS visits, COUNT(DISTINCT visitor) AS visitors FROM an_visits WHERE started_at >= ? AND user_id IN (${marks}) GROUP BY user_id`).bind(since, ...users),
    env.DB.prepare(
      `SELECT COUNT(DISTINCT v.visitor) AS n FROM an_visits v WHERE v.started_at >= ? AND v.user_id IN (${marks})
         AND EXISTS (SELECT 1 FROM an_visits o WHERE o.visitor = v.visitor AND o.started_at < v.started_at)`,
    ).bind(since, ...users),
    env.DB.prepare(`SELECT strftime('%Y-%m-%d', started_at / 1000, 'unixepoch') AS day, COUNT(*) AS visits, COUNT(DISTINCT visitor) AS visitors FROM an_visits WHERE started_at >= ? AND user_id IN (${marks}) GROUP BY day ORDER BY day`).bind(since, ...users),
    env.DB.prepare(`SELECT e.target AS app, COUNT(*) AS opens, COUNT(DISTINCT v.visitor) AS visitors FROM an_events e JOIN an_visits v ON v.id = e.visit_id WHERE e.kind = 'open' AND e.at >= ? AND v.user_id IN (${marks}) GROUP BY e.target ORDER BY opens DESC LIMIT 30`).bind(since, ...users),
    env.DB.prepare(`SELECT e.target AS app, AVG(CAST(e.detail AS REAL)) AS avg_s FROM an_events e JOIN an_visits v ON v.id = e.visit_id WHERE e.kind = 'close' AND e.at >= ? AND v.user_id IN (${marks}) GROUP BY e.target`).bind(since, ...users),
    env.DB.prepare(`SELECT e.target AS link, COUNT(*) AS clicks, COUNT(DISTINCT v.visitor) AS visitors FROM an_events e JOIN an_visits v ON v.id = e.visit_id WHERE e.kind = 'out' AND e.at >= ? AND v.user_id IN (${marks}) GROUP BY e.target ORDER BY clicks DESC LIMIT 20`).bind(since, ...users),
    env.DB.prepare(
      `SELECT json_extract(e.detail, '$.mode') AS mode, COUNT(*) AS runs, MAX(json_extract(e.detail, '$.streak')) AS best, AVG(json_extract(e.detail, '$.streak')) AS avg
         FROM an_events e JOIN an_visits v ON v.id = e.visit_id WHERE e.kind = 'game' AND e.at >= ? AND v.user_id IN (${marks}) GROUP BY mode`,
    ).bind(since, ...users),
    env.DB.prepare(`SELECT e.target AS album, MAX(e.detail) AS title, COUNT(*) AS views, COUNT(DISTINCT v.visitor) AS visitors FROM an_events e JOIN an_visits v ON v.id = e.visit_id WHERE e.kind = 'album' AND e.at >= ? AND v.user_id IN (${marks}) GROUP BY e.target ORDER BY views DESC LIMIT 20`).bind(since, ...users),
    env.DB.prepare('SELECT key, SUM(n) AS n FROM an_counters WHERE day >= ? GROUP BY key').bind(sinceDay),
    env.DB.prepare(
      `SELECT v.visitor,
              GROUP_CONCAT(DISTINCT v.user_id) AS users,
              COUNT(*) AS visits,
              MIN(v.started_at) AS first_seen,
              MAX(v.last_at) AS last_seen,
              SUM(v.events) AS events,
              MAX(v.events) AS busiest,
              COUNT(DISTINCT v.ip) AS ips,
              (SELECT ip FROM an_visits x WHERE x.visitor = v.visitor ORDER BY x.started_at DESC LIMIT 1) AS ip,
              (SELECT country FROM an_visits x WHERE x.visitor = v.visitor ORDER BY x.started_at DESC LIMIT 1) AS country,
              (SELECT city FROM an_visits x WHERE x.visitor = v.visitor ORDER BY x.started_at DESC LIMIT 1) AS city,
              (SELECT org FROM an_visits x WHERE x.visitor = v.visitor ORDER BY x.started_at DESC LIMIT 1) AS org,
              (SELECT browser FROM an_visits x WHERE x.visitor = v.visitor ORDER BY x.started_at DESC LIMIT 1) AS browser,
              (SELECT os FROM an_visits x WHERE x.visitor = v.visitor ORDER BY x.started_at DESC LIMIT 1) AS os,
              (SELECT device FROM an_visits x WHERE x.visitor = v.visitor ORDER BY x.started_at DESC LIMIT 1) AS device,
              (SELECT COUNT(DISTINCT y.visitor) FROM an_visits y WHERE y.ip = (SELECT ip FROM an_visits x WHERE x.visitor = v.visitor ORDER BY x.started_at DESC LIMIT 1) AND y.visitor != v.visitor) AS shared_ip,
              (SELECT COUNT(*) FROM an_logins l WHERE l.visitor = v.visitor AND l.outcome = 'pw_wrong') AS wrong_passwords
         FROM an_visits v WHERE v.started_at >= ? AND v.user_id IN (${marks})
        GROUP BY v.visitor ORDER BY last_seen DESC LIMIT 200`,
    ).bind(since, ...users),
    env.DB.prepare('SELECT at, visitor, user_id, outcome, ip, country, ua FROM an_logins WHERE at >= ? AND outcome = ? ORDER BY at DESC LIMIT 100').bind(since, 'pw_wrong'),
    env.DB.prepare(`SELECT ip, COUNT(*) AS n, MAX(at) AS last, COUNT(DISTINCT visitor) AS visitors FROM an_logins WHERE at >= ? AND outcome = 'pw_wrong' GROUP BY ip ORDER BY n DESC LIMIT 20`).bind(since),
    // Pairs of different visitor ids that have been on the same IP address with the same browser and system.
    env.DB.prepare(
      `SELECT DISTINCT a.visitor AS visitor, b.visitor AS other, b.last_at AS other_last
         FROM an_visits a JOIN an_visits b ON a.ip = b.ip AND a.browser = b.browser AND a.os = b.os AND a.visitor != b.visitor
        WHERE a.started_at >= ? AND a.ip != 'unknown' AND a.ip != ''
        LIMIT 1000`,
    ).bind(since),
    // Time on site: per visitor, the time between moves, leaving out quiet stretches (see IDLE_GAP_MS).
    env.DB.prepare(
      `WITH gaps AS (
         SELECT e.visit_id, e.at - LAG(e.at) OVER (PARTITION BY e.visit_id ORDER BY e.at) AS gap
           FROM an_events e JOIN an_visits v ON v.id = e.visit_id
          WHERE v.started_at >= ?1 AND v.user_id IN (${users.map((_, i) => `?${i + 3}`).join(',')})
       ), per_visit AS (
         SELECT visit_id, SUM(CASE WHEN gap <= ?2 THEN gap ELSE 0 END) AS active FROM gaps GROUP BY visit_id
       )
       SELECT v.visitor, v.user_id, COUNT(*) AS visits, SUM(COALESCE(p.active, 0)) AS active_ms
         FROM an_visits v LEFT JOIN per_visit p ON p.visit_id = v.id
        WHERE v.started_at >= ?1 AND v.user_id IN (${users.map((_, i) => `?${i + 3}`).join(',')})
        GROUP BY v.visitor, v.user_id`,
    ).bind(since, IDLE_GAP_MS, ...users),
  ])

  const timeOf = new Map<string, number>()
  const perUser = new Map<string, { visits: number; ms: number }>()
  for (const r of active.results) {
    timeOf.set(String(r.visitor), (timeOf.get(String(r.visitor)) ?? 0) + num(r.active_ms))
    const u = perUser.get(String(r.user_id)) ?? { visits: 0, ms: 0 }
    u.visits += num(r.visits)
    u.ms += num(r.active_ms)
    perUser.set(String(r.user_id), u)
  }

  // "Probably the same person": another cookie, same IP address, same browser and system. A guess, never a merge:
  // a household or an office can put different people on one IP with the same browser.
  const likelyBy = new Map<string, Map<string, number>>()
  for (const r of twins.results) {
    const mine = likelyBy.get(String(r.visitor)) ?? new Map<string, number>()
    mine.set(String(r.other), Math.max(mine.get(String(r.other)) ?? 0, num(r.other_last)))
    likelyBy.set(String(r.visitor), mine)
  }

  const seconds = new Map(closes.results.map((r) => [String(r.app), num(r.avg_s)]))
  return json({
    ok: true,
    now,
    days,
    audience: users.length === 2 ? 'both' : users[0],
    keepDays: KEEP_DAYS,
    summary: summary.results.map((r) => ({ user: r.user_id, visits: num(r.visits), visitors: num(r.visitors), avgSeconds: Math.round((perUser.get(String(r.user_id))?.ms ?? 0) / Math.max(1, num(r.visits)) / 1000) })),
    returningVisitors: num(returning.results[0]?.n),
    perDay: perDay.results.map((r) => ({ day: r.day, visits: num(r.visits), visitors: num(r.visitors) })),
    apps: apps.results.map((r) => ({ app: r.app, opens: num(r.opens), visitors: num(r.visitors), avgSeconds: Math.round(seconds.get(String(r.app)) ?? 0) })),
    outbound: outbound.results.map((r) => ({ link: r.link, clicks: num(r.clicks), visitors: num(r.visitors) })),
    games: games.results.map((r) => ({ mode: r.mode, runs: num(r.runs), best: num(r.best), average: Math.round(num(r.avg) * 10) / 10 })),
    albums: albums.results.map((r) => ({ album: r.album, title: r.title, views: num(r.views), visitors: num(r.visitors) })),
    funnel: Object.fromEntries(counters.results.map((r) => [String(r.key), num(r.n)])),
    visitors: visitors.results.map((r) => {
      const visits = num(r.visits)
      const flags: string[] = []
      const likely = [...(likelyBy.get(String(r.visitor)) ?? new Map<string, number>())].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([visitor]) => ({ visitor }))
      // Visitors on the same IP who are NOT probably this one (a different browser: more likely a different person).
      const others = Math.max(0, num(r.shared_ip) - (likelyBy.get(String(r.visitor))?.size ?? 0))
      if (num(r.ips) >= 4) flags.push(`${num(r.ips)} different IP addresses`)
      if (others > 0) flags.push(`shares its IP with ${others} other visitor${others === 1 ? '' : 's'} (different browser)`)
      if (num(r.wrong_passwords) >= 3) flags.push(`${num(r.wrong_passwords)} wrong passwords`)
      if (num(r.busiest) >= 500) flags.push(`one visit made ${num(r.busiest)} moves`)
      if (r.device === 'bot') flags.push('looks like a bot')
      return {
        visitor: r.visitor, users: String(r.users ?? '').split(','), visits, returning: visits > 1,
        firstSeen: num(r.first_seen), lastSeen: num(r.last_seen), events: num(r.events), ips: num(r.ips),
        timeOnSiteSeconds: Math.round((timeOf.get(String(r.visitor)) ?? 0) / 1000),
        ip: r.ip, country: r.country, city: r.city, org: r.org, browser: r.browser, os: r.os, device: r.device, flags, likely,
      }
    }),
    wrongPasswords: fails.results.map((r) => ({ at: num(r.at), visitor: r.visitor, user: r.user_id, ip: r.ip, country: r.country, ua: r.ua })),
    wrongPasswordIps: failIps.results.map((r) => ({ ip: r.ip, attempts: num(r.n), last: num(r.last), visitors: num(r.visitors) })),
  })
}

/** Everything one visitor id has done: each visit, from where, and what happened in it. */
async function visitorDetail(env: Env, visitor: string) {
  const visits = await env.DB.prepare('SELECT * FROM an_visits WHERE visitor = ? ORDER BY started_at DESC LIMIT 30').bind(visitor).all<Row>()
  const ids = visits.results.map((v) => String(v.id))
  const events = ids.length
    ? await env.DB.prepare(`SELECT visit_id, at, kind, target, detail FROM an_events WHERE visit_id IN (${ids.map(() => '?').join(',')}) ORDER BY at LIMIT 2500`).bind(...ids).all<Row>()
    : { results: [] as Row[] }
  const logins = await env.DB.prepare('SELECT at, user_id, outcome, ip FROM an_logins WHERE visitor = ? ORDER BY at DESC LIMIT 50').bind(visitor).all<Row>()
  // Other visitor ids seen on the same IP addresses: the same person on a fresh cookie, or a neighbour.
  const ips = [...new Set(visits.results.map((v) => String(v.ip)).filter((ip) => ip && ip !== 'unknown'))].slice(0, 10)
  const alike = ips.length
    ? await env.DB.prepare(`SELECT visitor, ip, browser, os, COUNT(*) AS visits, MAX(last_at) AS last_seen FROM an_visits WHERE ip IN (${ips.map(() => '?').join(',')}) AND visitor != ? GROUP BY visitor, ip, browser, os ORDER BY last_seen DESC LIMIT 30`).bind(...ips, visitor).all<Row>()
    : { results: [] as Row[] }

  return {
    ok: true,
    visitor,
    visits: visits.results.map((v) => ({
      id: v.id, user: v.user_id, startedAt: num(v.started_at), lastAt: num(v.last_at), ip: v.ip, country: v.country, region: v.region, city: v.city,
      asn: v.asn, org: v.org, ua: v.ua, browser: v.browser, os: v.os, device: v.device,
      events: events.results.filter((e) => e.visit_id === v.id).map((e) => ({ at: num(e.at), kind: e.kind, target: e.target, detail: e.detail })),
    })),
    logins: logins.results.map((l) => ({ at: num(l.at), user: l.user_id, outcome: l.outcome, ip: l.ip })),
    sameIp: alike.results.map((a) => ({
      visitor: a.visitor, ip: a.ip, visits: num(a.visits), lastSeen: num(a.last_seen),
      // Same browser and system as one of this visitor's own visits: probably the same person.
      sameBrowser: visits.results.some((v) => v.browser === a.browser && v.os === a.os),
    })),
  }
}
