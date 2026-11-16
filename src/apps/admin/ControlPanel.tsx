import { useCallback, useEffect, useState } from 'react'
import { useSwitchableApps } from '../registry'
import { AppIcon } from '../../os/icons'
import { Spinner } from '../../os/Spinner'
import type { AppDef } from '../../os/types'
import css from '../../styles/control-panel.css?inline'

/*
 * Control Panel (Trent only): for every other app, a checkbox for each user (Guests, Family & Friends, Trent).
 * An app that's off for a user disappears from that user's desktop, Start menu and address bar, and its API
 * refuses them. This window can't be switched off, so Trent can always get back in here.
 * The Worker side is worker/controls.ts.
 */

const USERS = [
  { id: 'guests', name: 'Guests' },
  { id: 'family', name: 'Family & Friends' },
  { id: 'trent', name: 'Trent' },
] as const
type UserId = (typeof USERS)[number]['id']

type Off = Record<UserId, Set<string>>
type Loaded = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; off: Off }

async function call(method: 'GET' | 'PUT', path: string, body?: unknown): Promise<Off | null> {
  try {
    const res = await fetch(`/api/controls${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; off?: Partial<Record<UserId, unknown>> }
    if (!res.ok || data.ok !== true || !data.off) return null
    const list = (u: UserId) => new Set(Array.isArray(data.off?.[u]) ? (data.off![u] as unknown[]).filter((id): id is string => typeof id === 'string') : [])
    return { guests: list('guests'), family: list('family'), trent: list('trent') }
  } catch {
    return null
  }
}

export function ControlPanel() {
  const { everyone, members, trentOnly } = useSwitchableApps()
  const [state, setState] = useState<Loaded>({ phase: 'loading' })
  /** Ids whose change is on its way to the Worker. */
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [problem, setProblem] = useState('')

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    const off = await call('GET', '')
    setState(off ? { phase: 'ready', off } : { phase: 'error' })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const memberIds = new Set(members.map((a) => a.id))
  const trentIds = new Set(trentOnly.map((a) => a.id))
  /** Guests never get the members-only apps, and only Trent gets his own, whatever is ticked. */
  const applies = (app: AppDef, user: UserId) =>
    !(user === 'guests' && (memberIds.has(app.id) || trentIds.has(app.id))) && !(user === 'family' && trentIds.has(app.id))

  async function change(changes: { app: AppDef; user: UserId; on: boolean }[]) {
    if (changes.length === 0) return
    const ids = [...new Set(changes.map((c) => c.app.id))]
    const apps: Record<string, Partial<Record<UserId, boolean>>> = {}
    for (const c of changes) (apps[c.app.id] ??= {})[c.user] = c.on
    setProblem('')
    setSaving((s) => new Set([...s, ...ids]))
    const off = await call('PUT', '/apps', { apps })
    setSaving((s) => new Set([...s].filter((id) => !ids.includes(id))))
    if (off) setState({ phase: 'ready', off })
    else setProblem('That didn’t save. Try again.')
  }

  const all = [...everyone, ...members, ...trentOnly]
  const off = state.phase === 'ready' ? state.off : null
  const busy = saving.size > 0
  const isOn = (app: AppDef, user: UserId) => !off?.[user].has(app.id)

  /** Flips a whole column: off if everything in it is on, otherwise on. */
  function flipColumn(user: UserId) {
    const cells = all.filter((a) => applies(a, user))
    const turnOn = cells.some((a) => !isOn(a, user))
    void change(cells.map((app) => ({ app, user, on: turnOn })))
  }

  const group = (title: string, note: string, apps: AppDef[]) =>
    apps.length > 0 && (
      <section className="cp-group">
        <h2>{title}</h2>
        <p className="cp-note">{note}</p>
        <ul role="list">
          {apps.map((app) => (
            <li key={app.id}>
              <AppIcon icon={app.icon} size={28} />
              <span className="cp-name">{app.title}</span>
              <span className="cp-saving">{saving.has(app.id) && <Spinner />}</span>
              {USERS.map((u) => (
                <span className="cp-cell" key={u.id}>
                  {applies(app, u.id) ? (
                    <input
                      type="checkbox"
                      checked={isOn(app, u.id)}
                      disabled={busy}
                      onChange={(e) => void change([{ app, user: u.id, on: e.target.checked }])}
                      aria-label={`Show ${app.title} to ${u.name}`}
                    />
                  ) : (
                    <input type="checkbox" checked={false} disabled aria-label={`${app.title} is not available to ${u.name}`} title={`Not available to ${u.name}`} />
                  )}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </section>
    )

  return (
    <div className="cp">
      <style>{css}</style>
      <div className="cp-head">
        <h1>Programs</h1>
        <p>
          Tick the people who should get each program. One that’s unticked disappears from that person’s desktop and Start menu, and stops working for them. You can untick yourself too.
        </p>
      </div>

      <div className="cp-body">
        {state.phase === 'loading' && <Spinner block label="Loading…" />}
        {state.phase === 'error' && (
          <div className="cp-center">
            <p>The settings can’t be reached right now.</p>
            <button className="xp-button cp-small" onClick={() => void load()}>
              Try again
            </button>
          </div>
        )}
        {state.phase === 'ready' && (
          <>
            <div className="cp-cols">
              <span className="cp-name" />
              <span className="cp-saving" />
              {USERS.map((u) => (
                <button key={u.id} className="cp-colhead" onClick={() => flipColumn(u.id)} disabled={busy || state.phase !== 'ready'} title={`Tick or untick everything for ${u.name}`}>
                  {u.name}
                </button>
              ))}
            </div>
            {group('Open to everyone', 'Guests, Family & Friends, and you, unless unticked.', everyone)}
            {group('Family & Friends only', 'Guests never get these, whatever is ticked.', members)}
            {group('Trent only', 'Only you ever get these.', trentOnly)}
          </>
        )}
      </div>

      <div className="cp-foot">
        <span className="cp-status" role="status">
          {busy ? <Spinner label="Saving…" /> : problem ? <span className="cp-error">{problem}</span> : 'Changes show up the next time a page loads.'}
        </span>
      </div>
    </div>
  )
}
