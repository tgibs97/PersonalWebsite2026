import { useEffect, useRef, useState } from 'react'
import { Spinner } from '../../os/Spinner'
import { BOARD_SIZE, fetchBoard, ordinal, removeScore, submitScore, type Entry, type Mode, type Submitted } from './arcade'

/*
 * Paper Toss's leaderboard screens, drawn as small Windows XP windows over the game: the High Scores list (a
 * list view with a tab for each difficulty), and the "New High Score" box shown when a run earns a place.
 */

const MODE_NAMES: Record<Mode, string> = { baby: "Baby's First Video Game", souls: 'Dark Souls' }

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

/** The XP close button, the same one the site's windows have. */
function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return (
    <div className="titlebar-buttons">
      <button className="tb-btn tb-close" aria-label={label} onClick={onClick} type="button">
        <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 6l9 9M15 6l-9 9" />
        </svg>
      </button>
    </div>
  )
}

const TrophyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="titlebar-icon">
    <path d="M4 2h8v4a4 4 0 0 1-8 0z" fill="#ffd24a" stroke="#a87b00" />
    <path d="M4 3.5H2.2c0 2 .8 3.2 2.3 3.6M12 3.5h1.8c0 2-.8 3.2-2.3 3.6" fill="none" stroke="#a87b00" />
    <path d="M8 10v2.5M5.5 14h5" stroke="#a87b00" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)

type Board = { status: 'loading' } | { status: 'error' } | { status: 'ready'; scores: Entry[]; admin: boolean }

/** The top ten for each difficulty. `highlight` selects a fresh entry, as if it had been clicked. */
export function Leaderboard({ mode: first, highlight, onClose }: { mode: Mode; highlight?: number; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(first)
  const [board, setBoard] = useState<Board>({ status: 'loading' })
  const [reload, setReload] = useState(0)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => root.current?.focus(), [])

  useEffect(() => {
    let live = true
    setBoard({ status: 'loading' })
    void fetchBoard(mode).then((b) => live && setBoard(b ? { status: 'ready', ...b } : { status: 'error' }))
    return () => {
      live = false
    }
  }, [mode, reload])

  const places = board.status === 'ready' ? board.scores : []
  const admin = board.status === 'ready' && board.admin

  return (
    <div className="hs-backdrop">
      <div
        className="window active hs-window"
        ref={root}
        tabIndex={-1}
        role="dialog"
        aria-label="High Scores"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      >
        <div className="titlebar">
          <TrophyIcon />
          <span className="titlebar-text">High Scores</span>
          <CloseButton onClick={onClose} />
        </div>

        <div className="hs-body">
          <div className="hs-tabs" role="tablist">
            {(Object.keys(MODE_NAMES) as Mode[]).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} className="hs-tab" onClick={() => setMode(m)}>
                {MODE_NAMES[m]}
              </button>
            ))}
          </div>

          <div className="hs-panel">
            {board.status === 'error' ? (
              <p className="hs-note">The scores can’t be reached right now.</p>
            ) : board.status === 'loading' ? (
              <Spinner block label="Loading scores…" />
            ) : (
              <table className="hs-table">
                <thead>
                  <tr>
                    <th>Place</th>
                    <th>Initials</th>
                    <th className="num">Streak</th>
                    <th>Date</th>
                    {admin && <th aria-label="Remove" />}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: BOARD_SIZE }, (_, i) => {
                    const e = places[i]
                    return (
                      <tr key={i} className={`${e && e.id === highlight ? 'selected' : ''}${e ? '' : ' empty'}`}>
                        <td>{ordinal(i + 1)}</td>
                        <td className="hs-initials">{e ? e.initials : ''}</td>
                        <td className="num">{e ? e.score : ''}</td>
                        <td>{e ? shortDate(e.at) : ''}</td>
                        {admin && (
                          <td className="num">
                            {e && (
                              <button
                                className="xp-button hs-remove"
                                title="Remove this entry"
                                aria-label={`Remove ${e.initials}’s entry`}
                                onClick={() => void removeScore(e.id).then(() => setReload((n) => n + 1))}
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {board.status === 'ready' && places.length === 0 && <p className="hs-note">No scores yet. Be the first!</p>}
          </div>

          <div className="hs-footer">
            <span>Streak = baskets in a row.</span>
            <button className="xp-button hs-ok" onClick={onClose} autoFocus>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The "New High Score" box: three letters, then OK. */
export function ScoreEntry({
  mode,
  streak,
  token,
  scores,
  onSaved,
  onSkip,
}: {
  mode: Mode
  streak: number
  token: string
  scores: Entry[]
  onSaved: (result: Extract<Submitted, { ok: true }>) => void
  onSkip: () => void
}) {
  const [initials, setInitials] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const place = 1 + scores.filter((s) => s.score >= streak).length

  async function save() {
    if (initials.length !== 3) return setError('Type three letters or numbers.')
    setBusy(true)
    setError('')
    const result = await submitScore(mode, token, initials, streak)
    setBusy(false)
    if (!result.ok) return setError(result.error)
    // The box can be shown from a board that is a moment out of date; the Worker has the final say.
    if (!result.ranked) return setError('Someone just took the last place, so this score didn’t make the top ten.')
    onSaved(result)
  }

  return (
    <div className="hs-backdrop">
      <form
        className="window active hs-window hs-entry"
        role="dialog"
        aria-label="New High Score"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onSkip()
        }}
      >
        <div className="titlebar">
          <TrophyIcon />
          <span className="titlebar-text">New High Score</span>
          <CloseButton onClick={onSkip} label="Skip" />
        </div>

        <div className="hs-body">
          <div className="hs-message">
            <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" className="hs-info">
              <defs>
                <radialGradient id="hs-info-ball" cx=".35" cy=".3" r=".8">
                  <stop offset="0" stopColor="#bcd8ff" />
                  <stop offset=".5" stopColor="#3b86f2" />
                  <stop offset="1" stopColor="#0a4bd1" />
                </radialGradient>
              </defs>
              <circle cx="17" cy="17" r="15" fill="url(#hs-info-ball)" stroke="#0a3aa0" strokeWidth="1.5" />
              <rect x="15" y="14" width="4" height="11" rx="1" fill="#fff" />
              <circle cx="17" cy="9.6" r="2.4" fill="#fff" />
            </svg>
            <p>
              You got <b>{streak} in a row</b> on {MODE_NAMES[mode]}. That’s <b>{ordinal(place)} place</b> on the board.
            </p>
          </div>

          <label className="hs-field">
            <span>Type your three initials:</span>
            <input
              className="hs-input"
              value={initials}
              maxLength={3}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label="Your three initials"
              onChange={(e) => {
                setError('')
                setInitials(e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 3))
              }}
            />
          </label>
          <p className="hs-error" role="alert">
            {error}
          </p>

          <div className="hs-buttons">
            <button className="xp-button hs-ok hs-default" type="submit" disabled={busy}>
              {busy ? <Spinner label="Saving…" /> : 'OK'}
            </button>
            <button className="xp-button hs-ok" type="button" onClick={onSkip} disabled={busy}>
              Skip
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
