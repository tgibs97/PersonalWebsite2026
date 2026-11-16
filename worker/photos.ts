import { Memo, mapLimit } from './async'
import { readTags } from './photo-tags'
import { isMember, type UserId } from './users'

/*
 * The Photos app's data, from Trent's Immich server.
 *
 * Immich is only reachable through a Cloudflare Tunnel that Cloudflare Access locks to one service token,
 * which only this Worker holds. The Worker lists Trent's Immich share links with a read-only API key
 * (permission `sharedLink.read`) and shows the ones whose description is tagged (see photo-tags.ts):
 *
 *   [site]      the link's photos appear in the Photos app
 *   [private]   ...but only for members (Trent, Family & Friends); Guests can't see or fetch them.
 *               ([members] and [hidden] mean the same, and typos of "private" count too.)
 *
 * Photos are then read with each link's own share key, so Immich itself limits every request to that
 * link's photos. Nothing about Immich reaches the browser: not its address, not the keys, not file paths.
 * Images are proxied and kept in Cloudflare's cache, so repeat views never touch the home server.
 *
 * Everything here treats what Immich sends back as untrusted: ids must be UUIDs, content types must be
 * images or videos, and sizes are capped. A Guest is anyone who passes the bot check, so a public album is
 * visible to anyone who clicks "Guests"; only tag a link [site] without [private] if that's what you want.
 */

/** How long the list of links and each album's photos are reused before asking Immich again. */
const LIST_TTL_MS = 60_000
/** After a failure, how long before asking Immich again (so a server that's down isn't hammered). */
const FAILURE_TTL_MS = 5_000
/** How long Cloudflare's cache keeps an image. Photos in Immich don't change once uploaded. */
const EDGE_IMAGE_TTL_S = 7 * 24 * 3600
const BROWSER_IMAGE_TTL_S = 24 * 3600

const MAX_LINKS = 50
const MAX_PHOTOS = 5000
/** Immich groups an album's photos by month. Each month is one request to the server at home. */
const MAX_MONTHS = 120
const MONTH_CONCURRENCY = 6

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)

const IMAGE_TYPES = new Set(['image/jpeg', 'image/webp', 'image/png', 'image/avif', 'image/gif'])
const VIDEO_TYPE = /^video\/[a-z0-9.+-]+$/

/** What the browser gets for each photo. */
interface Photo {
  id: string
  /** Width over height, for laying out the grid before images load. */
  ratio: number
  /** When it was taken, as Immich records it (local time, no zone). */
  taken: string
  video: boolean
}

interface Album {
  /** The Immich share link's id. Not secret: it can't be used to open the link. */
  id: string
  title: string
  /** Hidden from Guests. */
  members: boolean
  count: number
  cover: string | null
}

/** A tagged share link, as the Worker keeps it. `key` never leaves the Worker. */
interface Link extends Album {
  key: string
  albumId: string | null
  /** A single-photo (INDIVIDUAL) link carries its photos; an album's are read from its timeline. */
  photos: Photo[] | null
}

// ---------- Talking to Immich ----------

class ImmichError extends Error {}

function configured(env: Env): boolean {
  if (!env.IMMICH_URL || !env.IMMICH_ACCESS_CLIENT_ID || !env.IMMICH_ACCESS_CLIENT_SECRET || !env.IMMICH_API_KEY) return false
  try {
    // The Access token travels with every request, so it must never go over plain HTTP.
    return new URL(env.IMMICH_URL).protocol === 'https:'
  } catch {
    return false
  }
}

/** A request to Immich through the tunnel. The Access headers get it past Cloudflare Access. */
function immich(env: Env, path: string, init: RequestInit & { apiKey?: boolean } = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('CF-Access-Client-Id', env.IMMICH_ACCESS_CLIENT_ID)
  headers.set('CF-Access-Client-Secret', env.IMMICH_ACCESS_CLIENT_SECRET)
  if (init.apiKey) headers.set('x-api-key', env.IMMICH_API_KEY)
  // Redirects are never followed: the Access credentials must not follow one to another host.
  return fetch(new URL(path, env.IMMICH_URL), { ...init, headers, redirect: 'manual' })
}

async function immichJson<T>(env: Env, path: string, apiKey = false): Promise<T> {
  const res = await immich(env, path, { apiKey, headers: { Accept: 'application/json' } })
  // The query string holds a share key, so it is never put in a message.
  if (!res.ok) throw new ImmichError(`${res.status} from Immich for ${path.split('?')[0]}`)
  return res.json<T>()
}

/** The bits of Immich's shared-link response this file reads. */
interface ImmichLink {
  id: string
  key: string
  type: 'ALBUM' | 'INDIVIDUAL'
  description: string | null
  expiresAt: string | null
  album?: { id: string; albumName: string; albumThumbnailAssetId: string | null }
  assets: Array<{
    id: string
    type: string
    width?: number | null
    height?: number | null
    exifInfo?: { exifImageWidth?: number | null; exifImageHeight?: number | null } | null
    localDateTime?: string
    fileCreatedAt?: string
  }>
}

/** One entry of an album's timeline: a month, and how many photos it holds. */
interface ImmichMonth {
  timeBucket: string
  count: number
}

/** One month of an album's timeline. Immich sends it as parallel arrays, one entry per photo. */
interface ImmichBucket {
  id: string[]
  isImage: boolean[]
  ratio: number[]
  fileCreatedAt: string[]
  isTrashed?: boolean[]
}

const ratioOf = (ratio: unknown) => (typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0.05 && ratio < 20 ? ratio : 1)
const textOf = (value: unknown) => (typeof value === 'string' ? value.slice(0, 40) : '')

function toLink(raw: ImmichLink): Link | null {
  const tags = readTags(raw.description)
  if (!tags.site) return null
  if (raw.expiresAt && Date.parse(raw.expiresAt) <= Date.now()) return null
  if (!isUuid(raw.id) || typeof raw.key !== 'string' || raw.key.length === 0) return null
  if (raw.album && !isUuid(raw.album.id)) return null

  const photos =
    raw.type === 'INDIVIDUAL'
      ? (raw.assets ?? [])
          .filter((a) => isUuid(a.id))
          .slice(0, MAX_PHOTOS)
          .map((a) => {
            const w = a.width ?? a.exifInfo?.exifImageWidth ?? 0
            const h = a.height ?? a.exifInfo?.exifImageHeight ?? 0
            return { id: a.id, ratio: ratioOf(w && h ? w / h : 1), taken: textOf(a.localDateTime ?? a.fileCreatedAt), video: a.type === 'VIDEO' }
          })
      : null

  const cover = photos ? (photos[0]?.id ?? null) : (raw.album?.albumThumbnailAssetId ?? null)
  return {
    id: raw.id,
    key: raw.key,
    title: tags.title || textOf(raw.album?.albumName) || 'Shared photos',
    members: tags.private,
    albumId: raw.album?.id ?? null,
    count: photos ? photos.length : 0, // an album's is counted from its timeline
    cover: isUuid(cover) ? cover : null,
    photos,
  }
}

// Kept per Worker instance for a minute, so browsing the app doesn't send a burst of requests home.
// Everyone who asks while one is loading shares that single request.
const linksMemo = new Memo<Link[]>(LIST_TTL_MS, FAILURE_TTL_MS)
const monthsMemo = new Memo<ImmichMonth[]>(LIST_TTL_MS, FAILURE_TTL_MS)
const photosMemo = new Memo<Photo[]>(LIST_TTL_MS, FAILURE_TTL_MS)

function tagged(env: Env): Promise<Link[]> {
  return linksMemo.get('links', async () => {
    const raw = await immichJson<ImmichLink[]>(env, '/api/shared-links', true)
    const links = raw.map(toLink).filter((l): l is Link => l !== null).slice(0, MAX_LINKS)
    // A link that was removed (or untagged) takes its remembered contents with it.
    monthsMemo.keepOnly(links.map((l) => l.id))
    photosMemo.keepOnly(links.map((l) => l.id))
    return links
  })
}

const albumQuery = (link: Link) => `albumId=${encodeURIComponent(link.albumId ?? '')}&key=${encodeURIComponent(link.key)}`

/** An album's months with their photo counts: one cheap request, newest first. */
function monthsOf(env: Env, link: Link): Promise<ImmichMonth[]> {
  return monthsMemo.get(link.id, async () => {
    const months = await immichJson<ImmichMonth[]>(env, `/api/timeline/buckets?${albumQuery(link)}`)
    return months.filter((m) => typeof m.timeBucket === 'string' && /^\d{4}-\d{2}-\d{2}/.test(m.timeBucket)).slice(0, MAX_MONTHS)
  })
}

/** How many photos a link has, for the album list. For an album that's one request, not one per month. */
async function countOf(env: Env, link: Link): Promise<number> {
  if (link.photos) return link.photos.length
  if (!link.albumId) return 0
  const months = await monthsOf(env, link)
  return Math.min(MAX_PHOTOS, months.reduce((total, m) => total + (Number.isFinite(m.count) ? m.count : 0), 0))
}

function photosOf(env: Env, link: Link): Promise<Photo[]> {
  if (link.photos) return Promise.resolve(link.photos)
  if (!link.albumId) return Promise.resolve([])
  return photosMemo.get(link.id, async () => {
    const months = await monthsOf(env, link)
    const buckets = await mapLimit(months, MONTH_CONCURRENCY, (m) =>
      immichJson<ImmichBucket>(env, `/api/timeline/bucket?${albumQuery(link)}&timeBucket=${encodeURIComponent(m.timeBucket)}`),
    )
    const photos = buckets
      .flatMap((m) =>
        (m.id ?? []).map((id, i) => ({ id, ratio: ratioOf(m.ratio?.[i]), taken: textOf(m.fileCreatedAt?.[i]), video: m.isImage?.[i] === false, trashed: m.isTrashed?.[i] === true })),
      )
      .filter((p) => isUuid(p.id) && !p.trashed)
      .map(({ trashed: _trashed, ...p }) => p)
    if (photos.length > MAX_PHOTOS) {
      console.log(JSON.stringify({ message: 'photos: album truncated', linkId: link.id, photos: photos.length, shown: MAX_PHOTOS }))
    }
    return photos.slice(0, MAX_PHOTOS)
  })
}

// ---------- The API the Photos app calls ----------

/** Headers for everything the Photos API sends: nothing here may be sniffed into something executable. */
const SAFE = { 'X-Content-Type-Options': 'nosniff' }

/**
 * For images and video. If one were ever opened as a page, this makes it inert (no scripts, no styles from
 * elsewhere, no cookies), and the same-origin policy keeps other sites from embedding it.
 */
const INERT = {
  ...SAFE,
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  'Cross-Origin-Resource-Policy': 'same-origin',
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...SAFE, 'Cache-Control': 'private, no-store' } })
}

const contentTypeOf = (res: Response) => (res.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()

const visibleTo = (user: UserId) => (link: Link) => !link.members || isMember(user)

const publicAlbum = ({ id, title, members, count, cover }: Link): Album => ({ id, title, members, count, cover })

/**
 * GET /api/photos                         the albums this user can see
 * GET /api/photos/<album>                 one album and its photos
 * GET /api/photos/<album>/<photo>/thumb   a small thumbnail (WebP)
 * GET /api/photos/<album>/<photo>/preview a large preview (JPEG), for the viewer
 * GET /api/photos/<album>/<photo>/video   a video's stream (supports Range, so it can seek)
 *
 * Only reached with a valid session (see worker/index.ts).
 */
export async function photos(request: Request, env: Env, ctx: ExecutionContext, user: UserId): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false }, 405)
  // Only this site's own pages use this API. (Cookies are SameSite=Lax, so other sites couldn't read it anyway.)
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ ok: false }, 403)
  if (!configured(env)) {
    console.error(JSON.stringify({ message: 'photos unavailable: IMMICH_* settings are missing, or IMMICH_URL is not https' }))
    return json({ ok: false, reason: 'unavailable' }, 503)
  }

  const parts = new URL(request.url).pathname.split('/').slice(3) // after /api/photos
  try {
    const links = (await tagged(env)).filter(visibleTo(user))
    if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
      // One album failing to count doesn't hide the others.
      const counts = await Promise.all(links.map((l) => countOf(env, l).catch(() => l.count)))
      return json({ ok: true, albums: links.map((l, i) => ({ ...publicAlbum(l), count: counts[i] })) })
    }

    const [albumId, photoId, size] = parts
    // A private album looks exactly like one that doesn't exist.
    const link = isUuid(albumId) ? links.find((l) => l.id === albumId) : undefined
    if (!link) return json({ ok: false }, 404)

    const list = await photosOf(env, link)
    if (parts.length === 1) return json({ ok: true, album: { ...publicAlbum(link), count: list.length }, photos: list })

    const photo = isUuid(photoId) ? list.find((p) => p.id === photoId) : undefined
    if (!photo || parts.length !== 3) return json({ ok: false }, 404)
    // Awaited, so a failure fetching from Immich lands in the catch below.
    if (size === 'thumb' || size === 'preview') return await image(request, env, ctx, link, photo, size)
    if (size === 'video' && photo.video) return await video(request, env, link, photo)
    return json({ ok: false }, 404)
  } catch (err) {
    console.error(JSON.stringify({ message: 'photos: Immich request failed', error: String(err) }))
    return json({ ok: false, reason: 'unavailable' }, 502)
  }
}

/** A thumbnail or preview, from Cloudflare's cache when it can be. The cache key holds no secrets. */
async function image(request: Request, env: Env, ctx: ExecutionContext, link: Link, photo: Photo, size: 'thumb' | 'preview') {
  const cache = caches.default
  // Looked up only after the caller has been shown to be allowed this photo, so the key needs no user in it.
  const cacheKey = new Request(new URL(`/__photo-cache/${photo.id}/${size}`, request.url).toString())
  let cached = await cache.match(cacheKey)
  if (!cached) {
    const res = await immich(env, `/api/assets/${photo.id}/thumbnail?size=${size === 'thumb' ? 'thumbnail' : 'preview'}&key=${encodeURIComponent(link.key)}`)
    if (!res.ok || !res.body) return json({ ok: false }, res.status === 404 ? 404 : 502)
    // Only real image types are passed on or cached; whatever Immich says it is, it never becomes a page.
    const type = contentTypeOf(res)
    if (!IMAGE_TYPES.has(type)) {
      await res.body.cancel()
      return json({ ok: false }, 502)
    }
    // Rebuilt from scratch, so nothing else Immich sent (cookies and the like) is passed on.
    cached = new Response(res.body, { headers: { 'Content-Type': type, 'Cache-Control': `public, max-age=${EDGE_IMAGE_TTL_S}` } })
    ctx.waitUntil(cache.put(cacheKey, cached.clone()))
  }
  const headers = new Headers(cached.headers)
  // The browser may keep it a day, but no shared cache may: the photo is only for logged-on visitors.
  headers.set('Cache-Control', `private, max-age=${BROWSER_IMAGE_TTL_S}`)
  for (const [name, value] of Object.entries(INERT)) headers.set(name, value)
  return new Response(request.method === 'HEAD' ? null : cached.body, { status: 200, headers })
}

/** A video, streamed straight through. Range requests pass along so the player can seek. */
async function video(request: Request, env: Env, link: Link, photo: Photo) {
  const range = request.headers.get('Range')
  const res = await immich(env, `/api/assets/${photo.id}/video/playback?key=${encodeURIComponent(link.key)}`, {
    headers: range && /^bytes=\d*-\d*$/.test(range) ? { Range: range } : {},
  })
  if (!res.ok || !res.body) return json({ ok: false }, res.status === 404 ? 404 : 502)
  const type = contentTypeOf(res)
  if (!VIDEO_TYPE.test(type)) {
    await res.body.cancel()
    return json({ ok: false }, 502)
  }
  const headers = new Headers({ ...INERT, 'Cache-Control': 'private, no-store', 'Content-Type': type })
  for (const name of ['Content-Length', 'Content-Range', 'Accept-Ranges']) {
    const value = res.headers.get(name)
    if (value) headers.set(name, value)
  }
  return new Response(request.method === 'HEAD' ? null : res.body, { status: res.status, headers })
}
