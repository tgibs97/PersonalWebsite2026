import { useCallback, useEffect, useRef, useState } from 'react'
import { LoadingImage, Spinner } from '../os/Spinner'
import { track } from '../os/track'

/*
 * Photos: albums from Trent's Immich server, shown like XP's "My Pictures" folder in Thumbnails view.
 * The Worker (worker/photos.ts) does all the talking to Immich; this window only sees album and photo ids,
 * and loads images from /api/photos/... on the site itself.
 */

interface Album {
  id: string
  title: string
  members: boolean
  count: number
  cover: string | null
}

interface Photo {
  id: string
  ratio: number
  taken: string
  video: boolean
}

type Load<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: T }

const imageUrl = (album: string, photo: string, size: 'thumb' | 'preview' | 'video') => `/api/photos/${album}/${photo}/${size}`

/** "2026-03-11T00:38:01" → "March 11, 2026". Only the date part is read, so time zones can't shift the day. */
function formatDate(taken: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(taken)
  if (!m) return ''
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** Fetches JSON from `url`. A new url reads as loading straight away, so stale data is never shown under it. */
function useJson<T>(url: string | null, attempt: number): Load<T> {
  const [load, setLoad] = useState<{ key: string; load: Load<T> } | null>(null)
  const key = `${url}#${attempt}`
  useEffect(() => {
    if (!url) return
    let live = true
    fetch(url, { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? (res.json() as Promise<T>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => live && setLoad({ key, load: { state: 'ready', data } }))
      .catch(() => live && setLoad({ key, load: { state: 'error' } }))
    return () => {
      live = false
    }
  }, [url, key])
  return load?.key === key ? load.load : { state: 'loading' }
}

export function Photos() {
  const [albumId, setAlbumId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)

  const albums = useJson<{ albums: Album[] }>('/api/photos', attempt)
  const album = useJson<{ album: Album; photos: Photo[] }>(albumId && `/api/photos/${albumId}`, attempt)
  const current = albumId ? album : albums

  const openAlbum = (id: string) => {
    setAlbumId(id)
    setViewing(null)
  }
  const goUp = () => {
    if (viewing !== null) setViewing(null)
    else setAlbumId(null)
  }

  const title = albumId && album.state === 'ready' ? album.data.album.title : null
  const photos = albumId && album.state === 'ready' ? album.data.photos : null

  let status = ''
  if (current.state === 'loading') status = 'Loading…'
  else if (current.state === 'error') status = 'Not available'
  else if (photos) status = plural(photos.length, 'photo')
  else if (albums.state === 'ready') status = plural(albums.data.albums.length, 'album')

  return (
    <div className="ph">
      <div className="ph-toolbar">
        <button className="ph-tool" onClick={goUp} disabled={!albumId} title="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="9" fill={albumId ? '#3d9c36' : '#b5b5a6'} stroke={albumId ? '#1f6b1a' : '#8d8d7f'} />
            <path d="M11.5 5.5 7 10l4.5 4.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <div className="ph-path" aria-label="Location">
          <button className="ph-crumb" onClick={() => setAlbumId(null)} disabled={!albumId}>
            Photos
          </button>
          {albumId && (
            <>
              <span aria-hidden="true">›</span>
              <span className="ph-crumb-current">{title ?? '…'}</span>
            </>
          )}
        </div>
      </div>

      <div className="ph-body">
        {current.state === 'loading' && <Spinner block label="Loading…" />}
        {current.state === 'error' && (
          <div className="ph-note">
            <p>The photos can't be reached right now.</p>
            <button className="xp-button ph-retry" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </div>
        )}

        {!albumId && albums.state === 'ready' &&
          (albums.data.albums.length === 0 ? (
            <p className="ph-note">There are no albums here yet.</p>
          ) : (
            <ul className="ph-grid" role="list">
              {albums.data.albums.map((a) => (
                <li key={a.id}>
                  <button
                    className="ph-tile ph-album"
                    onClick={() => {
                      track('album', a.id, a.title)
                      openAlbum(a.id)
                    }}
                  >
                    <span className="ph-frame">
                      {a.cover ? <LoadingImage src={imageUrl(a.id, a.cover, 'thumb')} alt="" loading="lazy" decoding="async" /> : null}
                    </span>
                    <span className="ph-label">{a.title}</span>
                    <span className="ph-sub">
                      {plural(a.count, 'photo')}
                      {a.members ? ' · private' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ))}

        {albumId && photos && (
          <ul className="ph-grid" role="list">
            {photos.map((p, i) => (
              <li key={p.id}>
                <button
                  className="ph-tile"
                  onClick={() => {
                    track('photo', albumId, String(i))
                    setViewing(i)
                  }}
                  aria-label={`Photo ${i + 1} of ${photos.length}`}
                >
                  <span className="ph-frame">
                    <LoadingImage src={imageUrl(albumId, p.id, 'thumb')} alt="" loading="lazy" decoding="async" />
                    {p.video && <span className="ph-play" aria-label="Video" />}
                  </span>
                  <span className="ph-label">{formatDate(p.taken)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ph-status">{current.state === 'loading' ? <Spinner label="Loading…" /> : status}</div>

      {albumId && photos && viewing !== null && photos[viewing] && (
        <Viewer albumId={albumId} photos={photos} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}

/** The picture viewer, after "Windows Picture and Fax Viewer": the photo, and Previous / Next underneath. */
function Viewer({
  albumId,
  photos,
  index,
  onIndex,
  onClose,
}: {
  albumId: string
  photos: Photo[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const photo = photos[index]
  const step = useCallback((by: number) => onIndex((index + by + photos.length) % photos.length), [index, onIndex, photos.length])

  useEffect(() => ref.current?.focus(), [])

  // Fetch the neighbours' previews ahead of time, so Next and Previous feel instant.
  useEffect(() => {
    for (const by of [1, -1]) {
      const next = photos[(index + by + photos.length) % photos.length]
      if (next && !next.video) new Image().src = imageUrl(albumId, next.id, 'preview')
    }
  }, [albumId, index, photos])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') step(1)
    else if (e.key === 'ArrowLeft') step(-1)
    else if (e.key === 'Escape') onClose()
    else return
    e.preventDefault()
  }

  return (
    <div className="ph-viewer" ref={ref} tabIndex={-1} onKeyDown={onKey} role="dialog" aria-label="Photo viewer">
      <div className="ph-stage">
        {photo.video ? (
          <video
            key={photo.id}
            src={imageUrl(albumId, photo.id, 'video')}
            poster={imageUrl(albumId, photo.id, 'preview')}
            controls
            autoPlay
            playsInline
          />
        ) : (
          <LoadingImage key={photo.id} src={imageUrl(albumId, photo.id, 'preview')} alt={`Photo ${index + 1} of ${photos.length}`} />
        )}
      </div>
      <div className="ph-viewer-bar">
        <span className="ph-viewer-info">
          {index + 1} of {photos.length}
          {photo.taken && ` · ${formatDate(photo.taken)}`}
        </span>
        <div className="ph-viewer-nav">
          <button className="ph-round" onClick={() => step(-1)} aria-label="Previous" title="Previous (Left arrow)">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <path d="M13 6 8 11l5 5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="ph-round" onClick={() => step(1)} aria-label="Next" title="Next (Right arrow)">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <path d="M9 6l5 5-5 5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <button className="xp-button ph-close" onClick={onClose}>
          Back to album
        </button>
      </div>
    </div>
  )
}
