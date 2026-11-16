import { useCallback, useEffect, useRef, useState } from 'react'
import { LoadingImage, Spinner } from '../../os/Spinner'
import css from '../../styles/wishlist.css?inline'

/*
 * The Wishlist. One window, two faces, chosen by the Worker (the page never decides who is who):
 *
 *   Trent               a manager: his items on the left, an editor on the right.
 *   Family & Friends    gift cards, each with an "I bought this" button.
 *
 * The Worker (worker/wishlist.ts) keeps Trent from learning what has been bought until he presses
 * "Reveal purchases", so there is nothing here to hide: his version of the data simply has no claims in it.
 */

interface WishUrl {
  url: string
  label: string
}

interface Claim {
  name: string
  at: number
}

interface WishItem {
  id: string
  name: string
  msrpCents: number | null
  expectedCents: number | null
  /** "Don't pay over", if set. */
  maxCents: number | null
  notes: string
  urls: WishUrl[]
  images: string[]
  /** Present only for people who may see purchases. null = not bought. */
  claim?: Claim | null
}

interface Loaded {
  admin: boolean
  revealed: boolean
  items: WishItem[]
}

type Called = { ok: boolean; status: number; data: Record<string, unknown> }

const MAX_PICTURES = 8
const PICTURE_EDGE = 1600

async function call(method: string, path: string, body?: unknown): Promise<Called> {
  try {
    const headers: Record<string, string> = {}
    let payload: BodyInit | undefined
    if (body instanceof Blob) {
      headers['Content-Type'] = body.type
      payload = body
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      payload = JSON.stringify(body)
    }
    const res = await fetch(`/api/wishlist${path}`, { method, headers, body: payload, credentials: 'same-origin' })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: {} }
  }
}

const errorOf = (r: Called, fallback: string) => (typeof r.data.error === 'string' ? r.data.error : fallback)

const imageUrl = (id: string) => `/api/wishlist/images/${id}`

const money = (cents: number) => (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })

/** "$1,299.99" or "1299.5" to whole cents; '' is "unknown" (null); anything else is invalid (undefined). */
function parseDollars(text: string): number | null | undefined {
  const t = text.replace(/[$,\s]/g, '')
  if (t === '') return null
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(t)) return undefined
  return Math.round(parseFloat(t) * 100)
}

const dollarsText = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(2))

/** A link is only ever followed if it's a plain web address, whatever the data says. */
const safeHref = (url: string) => (/^https?:\/\//i.test(url) ? url : undefined)

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const dateOf = (ms: number) => new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

/**
 * Re-draws a picture smaller (1600 px on its longest side) as a JPEG before it is sent. That keeps uploads
 * quick, and drawing it afresh drops everything hidden in the original file, like where a photo was taken.
 */
async function shrinkPicture(file: File): Promise<Blob> {
  if (file.size > 40 * 1024 * 1024) throw new Error('That file is too big.')
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, PICTURE_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot resize pictures.')
  ctx.fillStyle = '#fff' // JPEG has no see-through, so a transparent PNG gets a white background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('That file could not be read as a picture.')
  return blob
}

export function Wishlist() {
  const [state, setState] = useState<{ phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; data: Loaded }>({ phase: 'loading' })

  const load = useCallback(async () => {
    const r = await call('GET', '')
    if (r.ok && r.data.ok === true) setState({ phase: 'ready', data: r.data as unknown as Loaded })
    else setState((s) => (s.phase === 'ready' ? s : { phase: 'error' }))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="wl">
      <style>{css}</style>
      {state.phase === 'loading' && <Spinner block label="Loading…" />}
      {state.phase === 'error' && (
        <div className="wl-note">
          <p>The wishlist can't be reached right now.</p>
          <button className="xp-button wl-small" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
      {state.phase === 'ready' && (state.data.admin ? <Manager data={state.data} reload={load} /> : <FamilyView data={state.data} reload={load} />)}
    </div>
  )
}

// ---------- Family & Friends ----------

function FamilyView({ data, reload }: { data: Loaded; reload: () => Promise<void> }) {
  const [hideTaken, setHideTaken] = useState(false)
  const [viewing, setViewing] = useState<{ images: string[]; index: number } | null>(null)
  const shown = hideTaken ? data.items.filter((i) => !i.claim) : data.items

  return (
    <>
      {data.revealed && (
        <p className="wl-banner warn">Heads up: Trent has chosen to see who bought what, so he can see your name on anything you mark.</p>
      )}
      <div className="wl-bar">
        <span className="wl-grow">
          {data.items.filter((i) => !i.claim).length} of {data.items.length} still available
        </span>
        <label>
          <input type="checkbox" checked={hideTaken} onChange={(e) => setHideTaken(e.target.checked)} />
          Hide what's taken
        </label>
      </div>
      <div className="wl-cards">
        {!data.revealed && (
          <p className="wl-intro">
            Found something? Press <b>I bought this</b> so nobody doubles up. Trent isn't told, and can't see it.
          </p>
        )}
        {data.items.length === 0 && <p className="wl-note">Nothing on the list yet.</p>}
        {data.items.length > 0 && shown.length === 0 && <p className="wl-note">Everything's been taken!</p>}
        {shown.map((item) => (
          <ItemCard key={item.id} item={item} reload={reload} onPictures={(index) => setViewing({ images: item.images, index })} />
        ))}
      </div>
      {viewing && <Gallery images={viewing.images} index={viewing.index} onIndex={(index) => setViewing({ ...viewing, index })} onClose={() => setViewing(null)} />}
    </>
  )
}

function ItemCard({ item, reload, onPictures }: { item: WishItem; reload: () => Promise<void>; onPictures: (index: number) => void }) {
  const prices = [item.msrpCents !== null && `MSRP ${money(item.msrpCents)}`, item.expectedCents !== null && `Expect to pay about ${money(item.expectedCents)}`].filter(Boolean)
  return (
    <div className={`wl-card${item.claim ? ' taken' : ''}`}>
      {item.images.length > 0 ? (
        <button className="wl-pic" onClick={() => onPictures(0)} aria-label={`See pictures of ${item.name}`}>
          <LoadingImage src={imageUrl(item.images[0])} alt="" loading="lazy" decoding="async" />
          {item.images.length > 1 && <span className="wl-more">+{item.images.length - 1}</span>}
        </button>
      ) : (
        <span className="wl-pic empty" aria-hidden="true">
          no picture
        </span>
      )}
      <div className="wl-info">
        <span className="wl-name">{item.name}</span>
        {prices.length > 0 && <span className="wl-price">{prices.join(' · ')}</span>}
        {item.maxCents !== null && <span className="wl-cap">Please don’t pay over {money(item.maxCents)}</span>}
        {item.urls.length > 0 && (
          <ul className="wl-links">
            {item.urls.map((u, i) => (
              <li key={i}>
                <a href={safeHref(u.url)} target="_blank" rel="noopener noreferrer">
                  {u.label || hostOf(u.url)}
                </a>{' '}
                {u.label && <small>{hostOf(u.url)}</small>}
              </li>
            ))}
          </ul>
        )}
        {item.notes && <p className="wl-notes">{item.notes}</p>}
        <ClaimBox item={item} reload={reload} />
      </div>
    </div>
  )
}

/** "I bought this", and undoing it. Everyone in Family & Friends can undo, after a confirmation. */
function ClaimBox({ item, reload }: { item: WishItem; reload: () => Promise<void> }) {
  const [mode, setMode] = useState<'idle' | 'claim' | 'undo'>('idle')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function claim() {
    const typed = name.trim()
    if (!typed) return setMessage('Type your name first.')
    setBusy(true)
    setMessage('')
    const r = await call('POST', `/items/${item.id}/claim`, { name: typed })
    setBusy(false)
    if (r.ok) {
      setMode('idle')
      return reload()
    }
    if (r.status === 409) {
      // Someone got there first: the list will now show who.
      setMode('idle')
      setMessage('Someone else just marked this as bought.')
      return reload()
    }
    setMessage(errorOf(r, 'That did not work. Try again.'))
  }

  async function undo() {
    setBusy(true)
    const r = await call('DELETE', `/items/${item.id}/claim`)
    setBusy(false)
    setMode('idle')
    if (r.ok) setMessage('')
    else setMessage('That did not work. Try again.')
    await reload()
  }

  return (
    <div className="wl-claim">
      {item.claim ? (
        mode === 'undo' ? (
          <div className="wl-confirm">
            <span>Mark as not bought? Only if {item.claim.name} changed their mind, or it was a mistake.</span>
            <button className="xp-button wl-small" onClick={() => void undo()} disabled={busy}>
              Yes, mark as not bought
            </button>
            {busy && <Spinner />}
            <button className="xp-button wl-small" onClick={() => setMode('idle')}>
              Keep it
            </button>
          </div>
        ) : (
          <div className="wl-confirm">
            <span className="wl-taken-tag">✓ Bought by {item.claim.name}</span>
            <button className="xp-button wl-small" onClick={() => setMode('undo')}>
              Undo…
            </button>
          </div>
        )
      ) : mode === 'claim' ? (
        <form
          className="wl-confirm"
          onSubmit={(e) => {
            e.preventDefault()
            void claim()
          }}
        >
          <label htmlFor={`who-${item.id}`}>Your name:</label>
          <input id={`who-${item.id}`} type="text" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} style={{ width: 150 }} autoFocus />
          <button className="xp-button wl-small" type="submit" disabled={busy}>
            I bought it
          </button>
          {busy && <Spinner />}
          <button className="xp-button wl-small" type="button" onClick={() => setMode('idle')}>
            Cancel
          </button>
        </form>
      ) : (
        <button className="xp-button wl-small" onClick={() => setMode('claim')}>
          I bought this
        </button>
      )}
      {message && <p className="wl-error">{message}</p>}
    </div>
  )
}

/** Pictures of one item, one at a time, with Previous and Next. */
function Gallery({ images, index, onIndex, onClose }: { images: string[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => ref.current?.focus(), [])
  const step = (by: number) => onIndex((index + by + images.length) % images.length)
  return (
    <div
      className="wl-viewer"
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label="Pictures"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') step(1)
        else if (e.key === 'ArrowLeft') step(-1)
        else if (e.key === 'Escape') onClose()
        else return
        e.preventDefault()
      }}
    >
      <div className="wl-viewer-stage">
        <img key={images[index]} src={imageUrl(images[index])} alt={`Picture ${index + 1} of ${images.length}`} />
      </div>
      <div className="wl-viewer-bar">
        <span className="wl-grow">
          {index + 1} of {images.length}
        </span>
        {images.length > 1 && (
          <>
            <button className="xp-button wl-small" onClick={() => step(-1)}>
              ‹ Previous
            </button>
            <button className="xp-button wl-small" onClick={() => step(1)}>
              Next ›
            </button>
          </>
        )}
        <button className="xp-button wl-small" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

// ---------- Trent: the manager ----------

type Selection = string | 'new' | null

function Manager({ data, reload }: { data: Loaded; reload: () => Promise<void> }) {
  const [selected, setSelected] = useState<Selection>(data.items[0]?.id ?? null)
  const [pending, setPending] = useState<Selection | undefined>(undefined)
  const [askReveal, setAskReveal] = useState(false)
  const [busy, setBusy] = useState(false)
  const dirty = useRef(false)

  const current = selected && selected !== 'new' ? data.items.find((i) => i.id === selected) ?? null : null
  // If the selected item vanished (deleted elsewhere), fall back to nothing.
  const effective: Selection = selected === 'new' ? 'new' : current ? current.id : null

  function choose(next: Selection) {
    if (next === effective) return
    if (dirty.current) setPending(next)
    else setSelected(next)
  }

  async function move(id: string, by: -1 | 1) {
    const ids = data.items.map((i) => i.id)
    const at = ids.indexOf(id)
    const to = at + by
    if (at < 0 || to < 0 || to >= ids.length) return
    ;[ids[at], ids[to]] = [ids[to], ids[at]]
    setBusy(true)
    await call('PUT', '/order', { ids })
    await reload()
    setBusy(false)
  }

  async function setRevealed(revealed: boolean) {
    setBusy(true)
    await call('PUT', '/reveal', { revealed })
    setAskReveal(false)
    await reload()
    setBusy(false)
  }

  return (
    <>
      <div className="wl-bar">
        <button className="xp-button wl-small" onClick={() => choose('new')}>
          + New item
        </button>
        <span className="wl-grow" />
        {busy && <Spinner label="Working…" />}
        {askReveal ? (
          <span className="wl-confirm">
            <span>Show who bought what? That spoils the surprises, and Family & Friends will see that you can.</span>
            <button className="xp-button wl-small" onClick={() => void setRevealed(true)} disabled={busy}>
              Reveal
            </button>
            <button className="xp-button wl-small" onClick={() => setAskReveal(false)}>
              Cancel
            </button>
          </span>
        ) : data.revealed ? (
          <>
            <span>Purchases are visible to you.</span>
            <button className="xp-button wl-small" onClick={() => void setRevealed(false)} disabled={busy}>
              Hide purchases
            </button>
          </>
        ) : (
          <>
            <span>Purchases are hidden from you.</span>
            <button className="xp-button wl-small" onClick={() => setAskReveal(true)}>
              Reveal purchases…
            </button>
          </>
        )}
      </div>

      {pending !== undefined && (
        <p className="wl-banner warn wl-confirm">
          <span>You have changes that aren't saved.</span>
          <button
            className="xp-button wl-small"
            onClick={() => {
              dirty.current = false
              setSelected(pending)
              setPending(undefined)
            }}
          >
            Discard and switch
          </button>
          <button className="xp-button wl-small" onClick={() => setPending(undefined)}>
            Keep editing
          </button>
        </p>
      )}

      <div className="wl-manager">
        <div className="wl-list" role="list">
          {data.items.length === 0 && <p className="wl-note">No items yet. Press “New item” to add one.</p>}
          {data.items.map((item, index) => (
            <div key={item.id} className={`wl-row${effective === item.id ? ' selected' : ''}`} role="listitem">
              <button className="wl-row-main" onClick={() => choose(item.id)}>
                <b>{item.name}</b>
                <small>
                  {item.expectedCents !== null ? money(item.expectedCents) : item.msrpCents !== null ? money(item.msrpCents) : 'no price'}
                  {data.revealed && item.claim ? ` · bought by ${item.claim.name}` : ''}
                </small>
              </button>
              <span className="wl-arrows">
                <button onClick={() => void move(item.id, -1)} disabled={busy || index === 0} aria-label={`Move ${item.name} up`}>
                  ▲
                </button>
                <button onClick={() => void move(item.id, 1)} disabled={busy || index === data.items.length - 1} aria-label={`Move ${item.name} down`}>
                  ▼
                </button>
              </span>
            </div>
          ))}
        </div>

        {effective === null ? (
          <div className="wl-editor">
            <p className="wl-note">Pick an item to edit it, or add a new one.</p>
          </div>
        ) : (
          <Editor
            key={effective}
            item={current}
            revealed={data.revealed}
            onDirtyChange={(isDirty) => {
              dirty.current = isDirty
              // The "unsaved changes" warning is only about edits that still aren't saved.
              if (!isDirty) setPending(undefined)
            }}
            onSaved={async (id) => {
              await reload()
              setSelected(id)
            }}
            onDeleted={async () => {
              await reload()
              setSelected(null)
            }}
            reload={reload}
          />
        )}
      </div>
    </>
  )
}

interface Draft {
  name: string
  msrp: string
  expected: string
  max: string
  notes: string
  urls: WishUrl[]
}

const draftOf = (item: WishItem | null): Draft => ({
  name: item?.name ?? '',
  msrp: dollarsText(item?.msrpCents ?? null),
  expected: dollarsText(item?.expectedCents ?? null),
  max: dollarsText(item?.maxCents ?? null),
  notes: item?.notes ?? '',
  urls: item?.urls.map((u) => ({ ...u })) ?? [],
})

function Editor({
  item,
  revealed,
  onDirtyChange,
  onSaved,
  onDeleted,
  reload,
}: {
  item: WishItem | null
  revealed: boolean
  onDirtyChange: (dirty: boolean) => void
  onSaved: (id: string) => Promise<void>
  onDeleted: () => Promise<void>
  reload: () => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(item))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [askDelete, setAskDelete] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(item))
  // Tell the manager whether there is anything unsaved (it keeps the latest callback, so this only fires on a change).
  const report = useRef(onDirtyChange)
  report.current = onDirtyChange
  useEffect(() => {
    report.current(dirty)
  }, [dirty])
  useEffect(() => () => report.current(false), [])

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setMessage((m) => (m.endsWith('…') ? m : '')) // an old complaint goes away once you start fixing it
  }
  const setUrl = (i: number, patch: Partial<WishUrl>) => set({ urls: draft.urls.map((u, at) => (at === i ? { ...u, ...patch } : u)) })

  async function save() {
    const msrpCents = parseDollars(draft.msrp)
    const expectedCents = parseDollars(draft.expected)
    const maxCents = parseDollars(draft.max)
    if (!draft.name.trim()) return setMessage('Give the item a name.')
    if (msrpCents === undefined || expectedCents === undefined || maxCents === undefined) return setMessage('Prices look like 349.99. Leave one empty if it doesn’t apply.')
    const urls = draft.urls.filter((u) => u.url.trim() !== '').map((u) => ({ url: u.url.trim(), label: u.label.trim() }))
    setBusy(true)
    setMessage('')
    const body = { name: draft.name.trim(), msrpCents, expectedCents, maxCents, notes: draft.notes.trim(), urls }
    const r = item ? await call('PUT', `/items/${item.id}`, body) : await call('POST', '/items', body)
    setBusy(false)
    if (!r.ok) return setMessage(errorOf(r, 'That did not save. Try again.'))
    await onSaved(item ? item.id : String(r.data.id))
  }

  async function addPictures(files: FileList | null) {
    if (!item || !files || files.length === 0) return
    setBusy(true)
    const list = Array.from(files).slice(0, MAX_PICTURES - item.images.length)
    const problems: string[] = []
    for (const [n, file] of list.entries()) {
      setMessage(`Adding picture ${n + 1} of ${list.length}…`)
      try {
        const r = await call('POST', `/items/${item.id}/images`, await shrinkPicture(file))
        if (!r.ok) problems.push(`${file.name}: ${errorOf(r, 'could not be added.')}`)
      } catch (err) {
        problems.push(`${file.name}: ${err instanceof Error ? err.message : 'could not be added.'}`)
      }
    }
    if (fileInput.current) fileInput.current.value = ''
    await reload()
    setBusy(false)
    setMessage(problems.join(' '))
  }

  async function removePicture(imageId: string) {
    if (!item) return
    setBusy(true)
    await call('DELETE', `/items/${item.id}/images/${imageId}`)
    await reload()
    setBusy(false)
  }

  async function remove() {
    if (!item) return
    setBusy(true)
    const r = await call('DELETE', `/items/${item.id}`)
    setBusy(false)
    if (!r.ok) return setMessage('That did not delete. Try again.')
    await onDeleted()
  }

  return (
    <div className="wl-editor">
      {item?.claim && revealed && (
        <p className="wl-claimed-line">
          ✓ Bought by {item.claim.name} on {dateOf(item.claim.at)}
        </p>
      )}
      <label className="wl-field">
        <span>Item</span>
        <input type="text" value={draft.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} autoFocus={!item} />
      </label>
      <div className="wl-money">
        <label className="wl-field">
          <span>MSRP ($)</span>
          <input type="text" inputMode="decimal" value={draft.msrp} onChange={(e) => set({ msrp: e.target.value })} placeholder="list price" />
        </label>
        <label className="wl-field">
          <span>Expected price ($)</span>
          <input type="text" inputMode="decimal" value={draft.expected} onChange={(e) => set({ expected: e.target.value })} placeholder="what you'd expect to pay" />
        </label>
        <label className="wl-field">
          <span>Don’t pay over ($)</span>
          <input type="text" inputMode="decimal" value={draft.max} onChange={(e) => set({ max: e.target.value })} placeholder="optional" />
        </label>
      </div>

      <div className="wl-section">
        <span>Where to get it</span>
        {draft.urls.map((u, i) => (
          <div className="wl-url-row" key={i}>
            <input type="text" value={u.label} maxLength={60} onChange={(e) => setUrl(i, { label: e.target.value })} placeholder="Store (optional)" aria-label="Store name" />
            <input type="text" value={u.url} maxLength={2048} onChange={(e) => setUrl(i, { url: e.target.value })} placeholder="https://…" aria-label="Link" />
            <button className="xp-button wl-small" onClick={() => set({ urls: draft.urls.filter((_, at) => at !== i) })} aria-label="Remove this link">
              ✕
            </button>
          </div>
        ))}
        {draft.urls.length < 10 && (
          <button className="xp-button wl-small" onClick={() => set({ urls: [...draft.urls, { url: '', label: '' }] })}>
            + Add a link
          </button>
        )}
      </div>

      <label className="wl-field">
        <span>Notes</span>
        <textarea value={draft.notes} maxLength={2000} onChange={(e) => set({ notes: e.target.value })} placeholder="Size, colour, model number…" />
      </label>

      <div className="wl-section">
        <span>Pictures</span>
        {item ? (
          <>
            <div className="wl-thumbs">
              {item.images.map((id) => (
                <span className="wl-thumb" key={id}>
                  <LoadingImage src={imageUrl(id)} alt="" />
                  <button onClick={() => void removePicture(id)} disabled={busy} aria-label="Remove this picture">
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              disabled={busy || item.images.length >= MAX_PICTURES}
              onChange={(e) => void addPictures(e.target.files)}
            />
            <small>
              Up to {MAX_PICTURES}. They’re saved as soon as you add them, and shrunk first.
              {item.images.length >= MAX_PICTURES ? ' This item is full.' : ''}
            </small>
          </>
        ) : (
          <small>Save the item first, then you can add pictures.</small>
        )}
      </div>

      {busy ? <Spinner label={message.endsWith('…') ? message : 'Working…'} /> : message && <p className="wl-error">{message}</p>}

      <div className="wl-actions">
        <button className="xp-button wl-small" onClick={() => void save()} disabled={busy || (!!item && !dirty)}>
          {item ? 'Save changes' : 'Add to list'}
        </button>
        {item && dirty && (
          <button className="xp-button wl-small" onClick={() => setDraft(draftOf(item))} disabled={busy}>
            Undo changes
          </button>
        )}
        <span className="wl-spacer" />
        {item &&
          (askDelete ? (
            <span className="wl-confirm">
              <span>Delete “{item.name}”{revealed && item.claim ? ` (${item.claim.name} has bought it)` : ''}, and its pictures?</span>
              <button className="xp-button wl-small" onClick={() => void remove()} disabled={busy}>
                Delete
              </button>
              <button className="xp-button wl-small" onClick={() => setAskDelete(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button className="xp-button wl-small" onClick={() => setAskDelete(true)} disabled={busy}>
              Delete…
            </button>
          ))}
      </div>
    </div>
  )
}
