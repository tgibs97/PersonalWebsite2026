import { isAdmin, isMember, type UserId } from './users'
import {
  LIMITS,
  parseClaimName,
  parseItem,
  readImageIds,
  readUrls,
  sniffImage,
  type ImageType,
  type WishUrl,
} from './wishlist-validate'

/*
 * The Wishlist's data: items in D1, pictures in R2.
 *
 *   Trent (the admin)      edits the list: items, links, prices, notes, pictures, order.
 *   Family & Friends       read the list, and mark an item as bought by typing their name.
 *   Guests                 nothing: the whole API is members-only.
 *
 * THE SURPRISE RULE. Trent must not learn what has been bought. So this file never sends him claims
 * (not even a "claimed" flag) unless he has pressed "Reveal purchases", and the admin's list is built
 * from a query that doesn't touch the claims table at all. A claim also never touches the item's row, so
 * not even its updated_at changes. It's enforced here, not in the page, so it holds whatever he tries.
 * (He owns the Cloudflare account, so he could always read the database directly. And he knows the
 * Family & Friends password. This protects the surprise from the app, not from his own determination.)
 *
 * Nothing about claims is ever logged.
 */

const IMAGE_CACHE_S = 7 * 24 * 3600
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)

interface ItemRow {
  id: string
  name: string
  msrp_cents: number | null
  expected_cents: number | null
  max_cents: number | null
  notes: string
  urls: string
  images: string
  position: number
  claim_name?: string | null
  claim_at?: number | null
}

interface Claim {
  name: string
  at: number
}

interface Item {
  id: string
  name: string
  msrpCents: number | null
  expectedCents: number | null
  maxCents: number | null
  notes: string
  urls: WishUrl[]
  images: string[]
  /** Only present when the viewer may see purchases: null = nobody has bought it. Left out entirely otherwise. */
  claim?: Claim | null
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}

const gone = () => json({ ok: false }, 404)

/** For images: if one were ever opened as a page it would be inert, and no other site may embed it. */
const INERT = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  'Cross-Origin-Resource-Policy': 'same-origin',
}

const toItem = (row: ItemRow, withClaim: boolean): Item => {
  const item: Item = {
    id: row.id,
    name: row.name,
    msrpCents: row.msrp_cents,
    expectedCents: row.expected_cents,
    maxCents: row.max_cents,
    notes: row.notes,
    urls: readUrls(row.urls),
    images: readImageIds(row.images),
  }
  if (withClaim) item.claim = row.claim_name ? { name: row.claim_name, at: row.claim_at ?? 0 } : null
  return item
}

/** Reads a JSON body of at most `max` bytes. Anything else (wrong type, too big, not JSON) is null. */
async function readJson(request: Request, max: number = LIMITS.jsonBytes): Promise<unknown> {
  if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) return null
  const bytes = await readLimited(request, max)
  if (!bytes) return null
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

/** The body as bytes, or null if it is longer than `max`. Stops reading as soon as it is. */
async function readLimited(request: Request, max: number): Promise<Uint8Array | null> {
  if (Number(request.headers.get('Content-Length') ?? 0) > max) return null
  if (!request.body) return new Uint8Array(0)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.byteLength
  }
  return bytes
}

async function revealed(env: Env): Promise<boolean> {
  const row = await env.DB.prepare("SELECT value FROM wishlist_settings WHERE key = 'claims_revealed'").first<{ value: string }>()
  return row?.value === '1'
}

/**
 * /api/wishlist ...
 *   GET    /                                the list (and whether purchases are revealed)
 *   POST   /items                           add an item                      (Trent)
 *   PUT    /items/<id>                      change an item                   (Trent)
 *   DELETE /items/<id>                      remove an item                   (Trent)
 *   POST   /items/<id>/images               add a picture (the raw file)     (Trent)
 *   DELETE /items/<id>/images/<image>       remove a picture                 (Trent)
 *   PUT    /order                           reorder: { ids: [...] }          (Trent)
 *   PUT    /reveal                          { revealed: boolean }            (Trent)
 *   POST   /items/<id>/claim                { name }: "I bought this"        (Family & Friends)
 *   DELETE /items/<id>/claim                undo a claim                     (Family & Friends)
 *   GET    /images/<image>                  a picture                        (members)
 *
 * Only reached with a valid session (see worker/index.ts).
 */
export async function wishlist(request: Request, env: Env, user: UserId): Promise<Response> {
  const response = await route(request, env, user)
  return request.method === 'HEAD' ? new Response(null, response) : response
}

async function route(request: Request, env: Env, user: UserId): Promise<Response> {
  const url = new URL(request.url)
  const method = request.method === 'HEAD' ? 'GET' : request.method
  const parts = url.pathname.split('/').slice(3).filter((p, i, all) => !(p === '' && i === all.length - 1)) // after /api/wishlist

  if (!isMember(user)) return json({ ok: false }, 403)
  // Only this site's own pages use the API. Every write must also say, with an Origin header, that it came from here.
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ ok: false }, 403)
  if (method !== 'GET' && request.headers.get('Origin') !== url.origin) return json({ ok: false }, 403)
  if (!env.DB || !env.IMAGES) {
    console.error(JSON.stringify({ message: 'wishlist unavailable: the DB or IMAGES binding is missing' }))
    return json({ ok: false, reason: 'unavailable' }, 503)
  }

  const admin = isAdmin(user)
  const [a, id, b, imageId] = parts

  try {
    if (a === undefined && method === 'GET') return await list(env, user)
    if (a === 'images' && id !== undefined && parts.length === 2 && method === 'GET') return await serveImage(request, env, id)

    // Everything below that isn't a claim is Trent's.
    if (a === 'items' && b === 'claim' && parts.length === 3) {
      // Trent's login can't claim: his view has no claim buttons, and the API says no too.
      if (admin) return json({ ok: false }, 403)
      if (!isUuid(id)) return gone()
      if (method === 'POST') return await claim(request, env, id)
      if (method === 'DELETE') return await unclaim(env, id)
      return json({ ok: false }, 405)
    }

    if (!admin) return json({ ok: false }, 403)

    if (a === 'items' && id === undefined && method === 'POST') return await createItem(request, env)
    if (a === 'items' && isUuid(id) && b === undefined) {
      if (method === 'PUT') return await updateItem(request, env, id)
      if (method === 'DELETE') return await deleteItem(env, id)
    }
    if (a === 'items' && isUuid(id) && b === 'images' && imageId === undefined && method === 'POST') return await addImage(request, env, id)
    if (a === 'items' && isUuid(id) && b === 'images' && isUuid(imageId) && parts.length === 4 && method === 'DELETE') {
      return await removeImage(env, id, imageId)
    }
    if (a === 'order' && parts.length === 1 && method === 'PUT') return await reorder(request, env)
    if (a === 'reveal' && parts.length === 1 && method === 'PUT') return await setReveal(request, env)
    return gone()
  } catch (err) {
    // Only the error itself is logged: never a claim, a name, or what a request contained.
    console.error(JSON.stringify({ message: 'wishlist: request failed', error: String(err).slice(0, 300) }))
    return json({ ok: false, reason: 'error' }, 500)
  }
}

// ---------- Reading ----------

async function list(env: Env, user: UserId): Promise<Response> {
  const isRevealed = await revealed(env)
  // Trent gets claims only once he has revealed them. Until then his query never touches the claims table.
  const withClaims = !isAdmin(user) || isRevealed
  const { results } = withClaims
    ? await env.DB.prepare(
        `SELECT i.*, c.name AS claim_name, c.claimed_at AS claim_at
           FROM wishlist_items i LEFT JOIN wishlist_claims c ON c.item_id = i.id
          ORDER BY i.position, i.created_at`,
      ).all<ItemRow>()
    : await env.DB.prepare('SELECT * FROM wishlist_items ORDER BY position, created_at').all<ItemRow>()
  return json({ ok: true, admin: isAdmin(user), revealed: isRevealed, items: results.map((row) => toItem(row, withClaims)) })
}

async function serveImage(request: Request, env: Env, imageId: string): Promise<Response> {
  if (!isUuid(imageId)) return gone()
  const object = await env.IMAGES.get(`wishlist/${imageId}`)
  if (!object) return gone()
  const type = object.httpMetadata?.contentType
  if (type !== 'image/jpeg' && type !== 'image/png' && type !== 'image/webp') return gone()
  const headers = new Headers({
    ...INERT,
    'Content-Type': type,
    'Cache-Control': `private, max-age=${IMAGE_CACHE_S}, immutable`,
    ETag: object.httpEtag,
  })
  if (request.headers.get('If-None-Match') === object.httpEtag) return new Response(null, { status: 304, headers })
  return new Response(object.body, { status: 200, headers })
}

// ---------- Trent: editing ----------

async function createItem(request: Request, env: Env): Promise<Response> {
  const parsed = parseItem(await readJson(request))
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400)
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM wishlist_items').first<{ n: number }>()
  if ((count?.n ?? 0) >= LIMITS.items) return json({ ok: false, error: `The list is full (${LIMITS.items} items).` }, 409)

  const i = parsed.value
  const id = crypto.randomUUID()
  const now = Date.now()
  await env.DB.prepare(
    `INSERT INTO wishlist_items (id, name, msrp_cents, expected_cents, max_cents, notes, urls, images, position, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?8, ?5, ?6, '[]', (SELECT COALESCE(MAX(position), 0) + 1 FROM wishlist_items), ?7, ?7)`,
  )
    .bind(id, i.name, i.msrpCents, i.expectedCents, i.notes, JSON.stringify(i.urls), now, i.maxCents)
    .run()
  return json({ ok: true, id }, 201)
}

async function updateItem(request: Request, env: Env, id: string): Promise<Response> {
  const parsed = parseItem(await readJson(request))
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400)
  const i = parsed.value
  const result = await env.DB.prepare(
    `UPDATE wishlist_items SET name = ?2, msrp_cents = ?3, expected_cents = ?4, max_cents = ?8, notes = ?5, urls = ?6, updated_at = ?7 WHERE id = ?1`,
  )
    .bind(id, i.name, i.msrpCents, i.expectedCents, i.notes, JSON.stringify(i.urls), Date.now(), i.maxCents)
    .run()
  return result.meta.changes > 0 ? json({ ok: true }) : gone()
}

async function deleteItem(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT images FROM wishlist_items WHERE id = ?').bind(id).first<{ images: string }>()
  if (!row) return gone()
  // The claim goes with it (ON DELETE CASCADE). Pictures are removed from R2 after the row is gone.
  await env.DB.prepare('DELETE FROM wishlist_items WHERE id = ?').bind(id).run()
  const keys = readImageIds(row.images).filter(isUuid).map((image) => `wishlist/${image}`)
  if (keys.length > 0) await env.IMAGES.delete(keys)
  return json({ ok: true })
}

async function addImage(request: Request, env: Env, id: string): Promise<Response> {
  const exists = await env.DB.prepare('SELECT 1 AS found FROM wishlist_items WHERE id = ?').bind(id).first()
  if (!exists) return gone()

  const claimed = (request.headers.get('Content-Type') ?? '').toLowerCase().split(';')[0].trim()
  if (claimed !== 'image/jpeg' && claimed !== 'image/png' && claimed !== 'image/webp') {
    return json({ ok: false, error: 'Pictures must be JPEG, PNG or WebP.' }, 415)
  }
  const bytes = await readLimited(request, LIMITS.imageBytes)
  if (!bytes) return json({ ok: false, error: 'That picture is too big (4 MB at most).' }, 413)
  // What the file really is, from its first bytes: the claimed type proves nothing.
  const type: ImageType | null = sniffImage(bytes)
  if (!type) return json({ ok: false, error: 'That file is not a JPEG, PNG or WebP picture.' }, 415)

  const imageId = crypto.randomUUID()
  await env.IMAGES.put(`wishlist/${imageId}`, bytes, { httpMetadata: { contentType: type } })
  // One statement, so two pictures arriving together can't overwrite each other, and the limit holds.
  const result = await env.DB.prepare(
    `UPDATE wishlist_items SET images = json_insert(images, '$[#]', ?2), updated_at = ?3
      WHERE id = ?1 AND json_array_length(images) < ?4`,
  )
    .bind(id, imageId, Date.now(), LIMITS.images)
    .run()
  if (result.meta.changes === 0) {
    await env.IMAGES.delete(`wishlist/${imageId}`)
    return json({ ok: false, error: `An item can have up to ${LIMITS.images} pictures.` }, 409)
  }
  return json({ ok: true, imageId }, 201)
}

async function removeImage(env: Env, id: string, imageId: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT images FROM wishlist_items WHERE id = ?').bind(id).first<{ images: string }>()
  if (!row || !readImageIds(row.images).includes(imageId)) return gone()
  await env.DB.prepare(
    `UPDATE wishlist_items
        SET images = COALESCE((SELECT json_group_array(value) FROM json_each(wishlist_items.images) WHERE value != ?2), '[]'),
            updated_at = ?3
      WHERE id = ?1`,
  )
    .bind(id, imageId, Date.now())
    .run()
  await env.IMAGES.delete(`wishlist/${imageId}`)
  return json({ ok: true })
}

async function reorder(request: Request, env: Env): Promise<Response> {
  const ids = ((await readJson(request)) as { ids?: unknown } | null)?.ids
  if (!Array.isArray(ids) || ids.length > LIMITS.items || !ids.every(isUuid) || new Set(ids).size !== ids.length) {
    return json({ ok: false, error: 'Send a list of item ids.' }, 400)
  }
  if (ids.length > 0) {
    await env.DB.batch(ids.map((itemId, index) => env.DB.prepare('UPDATE wishlist_items SET position = ?2 WHERE id = ?1').bind(itemId, index + 1)))
  }
  return json({ ok: true })
}

async function setReveal(request: Request, env: Env): Promise<Response> {
  const value = ((await readJson(request)) as { revealed?: unknown } | null)?.revealed
  if (typeof value !== 'boolean') return json({ ok: false }, 400)
  await env.DB.prepare(
    `INSERT INTO wishlist_settings (key, value) VALUES ('claims_revealed', ?1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  )
    .bind(value ? '1' : '0')
    .run()
  return json({ ok: true, revealed: value })
}

// ---------- Family & Friends: "I bought this" ----------

async function claim(request: Request, env: Env, id: string): Promise<Response> {
  const parsed = parseClaimName(await readJson(request))
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400)

  // The claims table has one row per item, so when two people claim at the same moment exactly one wins.
  const result = await env.DB.prepare(
    `INSERT INTO wishlist_claims (item_id, name, claimed_at)
     SELECT ?1, ?2, ?3 WHERE EXISTS (SELECT 1 FROM wishlist_items WHERE id = ?1)
     ON CONFLICT(item_id) DO NOTHING`,
  )
    .bind(id, parsed.value, Date.now())
    .run()
  if (result.meta.changes > 0) return json({ ok: true, claim: { name: parsed.value, at: Date.now() } })

  const current = await env.DB.prepare(
    `SELECT c.name, c.claimed_at FROM wishlist_items i LEFT JOIN wishlist_claims c ON c.item_id = i.id WHERE i.id = ?`,
  )
    .bind(id)
    .first<{ name: string | null; claimed_at: number | null }>()
  if (!current) return gone()
  return json({ ok: false, reason: 'taken', claim: current.name ? { name: current.name, at: current.claimed_at ?? 0 } : null }, 409)
}

async function unclaim(env: Env, id: string): Promise<Response> {
  const item = await env.DB.prepare('SELECT 1 AS found FROM wishlist_items WHERE id = ?').bind(id).first()
  if (!item) return gone()
  await env.DB.prepare('DELETE FROM wishlist_claims WHERE item_id = ?').bind(id).run()
  return json({ ok: true })
}
