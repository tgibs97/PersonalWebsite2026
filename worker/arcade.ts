import { visitorOf } from './analytics'
import {
  BOARD_SIZE,
  cleanInitials,
  isMode,
  KEEP_RANKS,
  MAX_PER_VISITOR,
  plausible,
  RUN_MAX_AGE_MS,
  type Mode,
} from './arcade-rules'
import { isAdmin, type UserId } from './users'

/*
 * The Paper Toss leaderboard: a top ten for each difficulty, with arcade-style three-letter initials.
 *
 *   POST /api/arcade/start               a run begins: get a signed run token
 *   GET  /api/arcade/scores?mode=baby    the board
 *   POST /api/arcade/scores              hand in a score: { token, initials, streak }
 *   DELETE /api/arcade/scores/<id>       remove an entry (Trent only)
 *
 * Open to everyone who is logged on, Guests included (the Recycle Bin is a public window). The score comes from
 * the player's browser, so it's checked as far as it can be (see arcade-rules.ts): signed token, enough real
 * time passed, used once, at most three places per browser per board, and rude initials refused.
 */

const encoder = new TextEncoder()
const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })

const fail = (error: string, status = 400) => json({ ok: false, error }, status)

const importKey = (secret: string) =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])

async function sign(secret: string, text: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', await importKey(secret), encoder.encode(text))))
}

/** A run token: `<run id>.<mode>.<start ms>.<signature>`. Proves this Worker started the run, when, and on which board. */
async function makeToken(secret: string, mode: Mode): Promise<string> {
  const id = toBase64Url(crypto.getRandomValues(new Uint8Array(12)))
  const started = Date.now()
  return `${id}.${mode}.${started}.${await sign(secret, `arcade:${id}:${mode}:${started}`)}`
}

/** The run behind a token, or null if it is malformed, forged, for another board, or too old. */
async function readToken(secret: string, token: unknown, mode: Mode): Promise<{ id: string; started: number } | null> {
  if (typeof token !== 'string' || token.length > 200) return null
  const [id, tokenMode, started, signature, ...rest] = token.split('.')
  if (!id || !signature || rest.length > 0 || tokenMode !== mode || !/^\d{10,14}$/.test(started ?? '')) return null
  if (!/^[A-Za-z0-9_-]{16}$/.test(id)) return null
  const key = await importKey(secret)
  const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(`arcade:${id}:${tokenMode}:${started}`))
  // Compared in constant time, as the session cookie is.
  const given = Uint8Array.from(atob(signature.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(signature.length / 4) * 4, '=')), (c) => c.charCodeAt(0))
  if (given.length !== expected.byteLength || !crypto.subtle.timingSafeEqual(given, expected)) return null
  const startedMs = Number(started)
  const age = Date.now() - startedMs
  return age >= 0 && age <= RUN_MAX_AGE_MS ? { id, started: startedMs } : null
}

interface Row {
  id: number
  initials: string
  score: number
  achieved_at: number
}

async function board(env: Env, mode: Mode) {
  const { results } = await env.DB.prepare(
    'SELECT id, initials, score, achieved_at FROM arcade_scores WHERE mode = ? ORDER BY score DESC, achieved_at ASC, id ASC LIMIT ?',
  )
    .bind(mode, BOARD_SIZE)
    .all<Row>()
  return results.map((r, i) => ({ id: r.id, rank: i + 1, initials: r.initials, score: r.score, at: r.achieved_at }))
}

/** Reads a small JSON body (at most 2 KB), or null. */
async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) return null
  if (Number(request.headers.get('Content-Length') ?? 0) > 2048) return null
  try {
    const body: unknown = JSON.parse((await request.text()).slice(0, 2048))
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export async function arcade(request: Request, env: Env, user: UserId): Promise<Response> {
  const url = new URL(request.url)
  const parts = url.pathname.split('/').slice(3).filter((p, i, all) => !(p === '' && i === all.length - 1)) // after /api/arcade

  // Only this site's own pages use the API, and every write must say, with an Origin header, that it came from here.
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ ok: false }, 403)
  if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) return json({ ok: false }, 403)
  if (!env.DB || !env.SESSION_SECRET) return json({ ok: false, reason: 'unavailable' }, 503)

  try {
    const [a, id] = parts
    if (a === 'scores' && parts.length === 1 && request.method === 'GET') {
      const mode = url.searchParams.get('mode')
      if (!isMode(mode)) return fail('Unknown difficulty.')
      return json({ ok: true, mode, admin: isAdmin(user), scores: await board(env, mode) })
    }
    if (a === 'start' && parts.length === 1 && request.method === 'POST') {
      const mode = (await readJson(request))?.mode
      if (!isMode(mode)) return fail('Unknown difficulty.')
      return json({ ok: true, token: await makeToken(env.SESSION_SECRET, mode) })
    }
    if (a === 'scores' && parts.length === 1 && request.method === 'POST') return await submit(request, env, user)
    if (a === 'scores' && parts.length === 2 && request.method === 'DELETE') {
      if (!isAdmin(user)) return json({ ok: false }, 403)
      if (!/^\d{1,12}$/.test(id)) return json({ ok: false }, 404)
      const result = await env.DB.prepare('DELETE FROM arcade_scores WHERE id = ?').bind(Number(id)).run()
      return result.meta.changes > 0 ? json({ ok: true }) : json({ ok: false }, 404)
    }
    return json({ ok: false }, parts.length ? 404 : 405)
  } catch (err) {
    console.error(JSON.stringify({ message: 'arcade: request failed', error: String(err).slice(0, 300) }))
    return json({ ok: false, reason: 'error' }, 500)
  }
}

async function submit(request: Request, env: Env, user: UserId): Promise<Response> {
  const body = await readJson(request)
  if (!body) return fail('That didn’t go through.')
  const mode = body.mode
  if (!isMode(mode)) return fail('Unknown difficulty.')
  const initials = cleanInitials(body.initials)
  if (!initials) return fail('Use three letters or numbers. Some combinations aren’t allowed.')

  const run = await readToken(env.SESSION_SECRET, body.token, mode)
  if (!run) return fail('That run has expired. Play again to set a score.')
  if (!plausible(body.streak, Date.now() - run.started)) return fail('That score didn’t check out.')
  const score = body.streak

  // Would it make the board at all? Rank = how many are as good or better, plus one (earlier scores win ties).
  const better = await env.DB.prepare('SELECT COUNT(*) AS n FROM arcade_scores WHERE mode = ? AND score >= ?').bind(mode, score).first<{ n: number }>()
  const rank = (better?.n ?? 0) + 1
  if (rank > BOARD_SIZE) return json({ ok: true, ranked: false, scores: await board(env, mode) })

  // One browser can't take the whole board: past three places it has to beat its own lowest to replace it.
  const visitor = visitorOf(request)
  let replace: number | null = null
  if (visitor) {
    const mine = await env.DB.prepare('SELECT id, score FROM arcade_scores WHERE mode = ? AND visitor = ? ORDER BY score ASC, achieved_at DESC LIMIT ?')
      .bind(mode, visitor, MAX_PER_VISITOR)
      .all<{ id: number; score: number }>()
    if (mine.results.length >= MAX_PER_VISITOR) {
      if (score <= mine.results[0].score) return fail(`You already hold ${MAX_PER_VISITOR} places here. Beat your lowest to replace it.`, 409)
      replace = mine.results[0].id
    }
  }

  // The run token works once: only the first hand-in of it gets through.
  const used = await env.DB.prepare('INSERT INTO arcade_runs (id, used_at) VALUES (?1, ?2) ON CONFLICT(id) DO NOTHING').bind(run.id, Date.now()).run()
  if (used.meta.changes === 0) return fail('That score has already been handed in.', 409)

  const now = Date.now()
  const statements = [
    ...(replace !== null ? [env.DB.prepare('DELETE FROM arcade_scores WHERE id = ?').bind(replace)] : []),
    env.DB.prepare('INSERT INTO arcade_scores (mode, initials, score, achieved_at, visitor, user_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(mode, initials, score, now, visitor, user),
    // Tidy: keep only the best few entries, and forget old run tokens.
    env.DB.prepare('DELETE FROM arcade_scores WHERE mode = ?1 AND id NOT IN (SELECT id FROM arcade_scores WHERE mode = ?1 ORDER BY score DESC, achieved_at ASC, id ASC LIMIT ?2)').bind(mode, KEEP_RANKS),
    env.DB.prepare('DELETE FROM arcade_runs WHERE used_at < ?').bind(now - 2 * 86_400_000),
  ]
  const results = await env.DB.batch(statements)
  const inserted = results[replace !== null ? 1 : 0].meta.last_row_id
  return json({ ok: true, ranked: true, id: inserted, rank, scores: await board(env, mode) })
}
