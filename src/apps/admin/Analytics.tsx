import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Spinner } from '../../os/Spinner'
import css from '../../styles/analytics.css?inline'
import { useApps } from '../registry'

/*
 * Trent's Analytics window: where visitors go, and who keeps coming back. All of it comes from
 * /api/desk/report, which only his login can read (see worker/analytics.ts for what is recorded).
 */

type Audience = 'guests' | 'family' | 'both'
type Tab = 'overview' | 'visitors' | 'signins'

interface VisitorRow {
  visitor: string
  users: string[]
  visits: number
  returning: boolean
  firstSeen: number
  lastSeen: number
  events: number
  /** Seconds between the visitor's moves, leaving out quiet stretches of over 10 minutes. */
  timeOnSiteSeconds: number
  ips: number
  ip: string
  country: string
  city: string
  org: string
  browser: string
  os: string
  device: string
  flags: string[]
  /** Other visitor ids on the same IP address with the same browser and system: probably the same person. */
  likely: { visitor: string }[]
}

interface Report {
  now: number
  days: number
  keepDays: number
  summary: { user: string; visits: number; visitors: number; avgSeconds: number }[]
  returningVisitors: number
  perDay: { day: string; visits: number; visitors: number }[]
  apps: { app: string; opens: number; visitors: number; avgSeconds: number }[]
  outbound: { link: string; clicks: number; visitors: number }[]
  games: { mode: string; runs: number; best: number; average: number }[]
  albums: { album: string; title: string; views: number; visitors: number }[]
  funnel: Record<string, number>
  visitors: VisitorRow[]
  wrongPasswords: { at: number; visitor: string | null; user: string; ip: string; country: string; ua: string }[]
  wrongPasswordIps: { ip: string; attempts: number; last: number; visitors: number }[]
}

interface Detail {
  visitor: string
  visits: {
    id: string
    user: string
    startedAt: number
    lastAt: number
    ip: string
    country: string
    region: string
    city: string
    asn: number | null
    org: string
    ua: string
    browser: string
    os: string
    device: string
    events: { at: number; kind: string; target: string; detail: string }[]
  }[]
  logins: { at: number; user: string; outcome: string; ip: string }[]
  sameIp: { visitor: string; ip: string; visits: number; lastSeen: number; sameBrowser: boolean }[]
}

/** The spinner shows for at least this long, so a refresh that finishes in a blink still visibly happens. */
const MIN_SPIN_MS = 600

const AUDIENCES: Record<Audience, string> = { guests: 'Guests', family: 'Family & Friends', both: 'Both' }
const WHO: Record<string, string> = { guests: 'Guest', family: 'Family' }
const MODES: Record<string, string> = { baby: "Baby's First Video Game", souls: 'Dark Souls' }
const OUTCOMES: Record<string, string> = { guest_ok: 'logged on as a guest', pw_ok: 'logged on', pw_wrong: 'wrong password' }

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = (await res.json()) as T & { ok?: boolean }
    return data.ok === false ? null : data
  } catch {
    return null
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

function duration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m ${pad(seconds % 60)}s`
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`
}

function ago(then: number, now: number): string {
  const s = Math.max(0, Math.round((now - then) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86_400)} d ago`
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const stamp = (ms: number) => new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const place = (v: { city?: string; country?: string }) => [v.city, v.country].filter(Boolean).join(', ') || 'unknown'

/** Seconds between a visit's moves, leaving out quiet stretches of over 10 minutes (the same measure the Worker uses). */
function timeSpent(events: { at: number }[]): number {
  let ms = 0
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].at - events[i - 1].at
    if (gap <= 10 * 60_000) ms += gap
  }
  return Math.round(ms / 1000)
}

function parseDetail(text: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function Analytics() {
  const apps = useApps()
  const titles = useMemo(() => new Map(apps.map((a) => [a.id, a.title])), [apps])
  const title = (id: string) => titles.get(id) ?? id

  const [days, setDays] = useState(7)
  const [audience, setAudience] = useState<Audience>('guests')
  const [tab, setTab] = useState<Tab>('overview')
  const [report, setReport] = useState<Report | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null | 'loading'>(null)
  const [tick, setTick] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const busy = loadingReport || loadingDetail
  const haveReport = useRef(false)
  const shownVisitor = useRef<string | null>(null)

  const query = `days=${days}&audience=${audience}`
  useEffect(() => {
    let current = true
    const started = Date.now()
    setLoadingReport(true)
    void getJson<Report>(`/api/desk/report?${query}`).then((r) => {
      if (!current) return
      window.setTimeout(() => current && setLoadingReport(false), Math.max(0, MIN_SPIN_MS - (Date.now() - started)))
      if (r) {
        haveReport.current = true
        setReport(r)
        setFailed(false)
        setUpdatedAt(Date.now())
      } else if (!haveReport.current) {
        // A refresh that fails keeps the last good numbers on screen; only a first load with nothing to show is an error.
        setFailed(true)
      }
    })
    return () => {
      current = false
    }
  }, [query, tick])

  useEffect(() => {
    if (!picked) {
      shownVisitor.current = null
      return
    }
    let current = true
    // "Loading…" only when a different visitor is opened, not each time Refresh reloads the one being read.
    if (shownVisitor.current !== picked) {
      shownVisitor.current = picked
      setDetail('loading')
    }
    const started = Date.now()
    setLoadingDetail(true)
    void getJson<Detail>(`/api/desk/report?visitor=${encodeURIComponent(picked)}`).then((d) => {
      if (!current) return
      setDetail((previous) => d ?? (previous === 'loading' ? null : previous))
      window.setTimeout(() => current && setLoadingDetail(false), Math.max(0, MIN_SPIN_MS - (Date.now() - started)))
    })
    return () => {
      current = false
    }
  }, [picked, tick])


  const open = useCallback((visitor: string) => {
    setPicked(visitor)
    setTab('visitors')
  }, [])

  const totalVisits = report?.summary.reduce((n, s) => n + s.visits, 0) ?? 0
  const totalVisitors = report ? new Set(report.visitors.map((v) => v.visitor)).size : 0
  const avgSeconds = report && totalVisits ? Math.round(report.summary.reduce((n, s) => n + s.avgSeconds * s.visits, 0) / totalVisits) : 0

  return (
    <div className="an">
      <style>{css}</style>
      <div className="an-bar">
        <label>
          Show
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Time range">
            <option value={1}>today</option>
            <option value={7}>the last 7 days</option>
            <option value={30}>the last 30 days</option>
            <option value={90}>the last 90 days</option>
            <option value={365}>the last year</option>
          </select>
        </label>
        <label>
          for
          <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} aria-label="Who">
            {Object.entries(AUDIENCES).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="xp-button an-small" onClick={() => setTick((n) => n + 1)} disabled={busy}>
          Refresh
        </button>
        <span className="an-muted" role="status" aria-live="polite">
          {busy ? (
            <Spinner label="Refreshing…" />
          ) : updatedAt ? (
            `Updated ${clock(updatedAt)}`
          ) : (
            ''
          )}
        </span>
        <span className="an-grow" />
        <span className="an-muted">Your own visits aren’t counted. Details are kept {report?.keepDays ?? 365} days.</span>
      </div>

      <div className="an-tabs" role="tablist">
        {(['overview', 'visitors', 'signins'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            className="an-tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id)
              if (id !== 'visitors') setPicked(null)
            }}
          >
            {id === 'overview' ? 'Overview' : id === 'visitors' ? 'Visitors' : 'Sign-ins'}
          </button>
        ))}
      </div>

      <div className="an-body">
        {failed && <p className="an-note">The numbers can’t be reached right now.</p>}
        {!failed && !report && <Spinner block label="Loading…" />}

        {report && tab === 'overview' && (
          <>
            <div className="an-cards">
              <div className="an-card">
                <b>{totalVisits}</b>
                <span>visits</span>
              </div>
              <div className="an-card">
                <b>{totalVisitors}</b>
                <span>different visitors</span>
              </div>
              <div className="an-card">
                <b>{report.returningVisitors}</b>
                <span>came back</span>
              </div>
              <div className="an-card">
                <b>{duration(avgSeconds)}</b>
                <span>average visit</span>
              </div>
              <div className="an-card">
                <b>{report.wrongPasswords.length}</b>
                <span>wrong passwords</span>
              </div>
            </div>

            <h3>Visits per day</h3>
            {report.perDay.length === 0 ? (
              <p className="an-muted">No visits in this time.</p>
            ) : (
              <div className="an-days">
                {report.perDay.map((d) => {
                  const most = Math.max(...report.perDay.map((x) => x.visits))
                  return (
                    <div className="an-day" key={d.day} title={`${d.day}: ${d.visits} visits, ${d.visitors} visitors`}>
                      <i style={{ height: `${Math.max(3, (d.visits / most) * 70)}px` }} />
                      <small>{d.day.slice(5)}</small>
                    </div>
                  )
                })}
              </div>
            )}

            <h3>Getting in (everyone who reached the log-on screen)</h3>
            <div className="an-funnel">
              <div className="an-card">
                <b>{report.funnel.login_page ?? 0}</b>
                <span>saw the log-on screen</span>
              </div>
              <span className="arrow">→</span>
              <div className="an-card">
                <b>{report.funnel.bot_passed ?? 0}</b>
                <span>passed the bot check</span>
              </div>
              <span className="arrow">→</span>
              <div className="an-card">
                <b>{report.funnel.desktop ?? 0}</b>
                <span>reached the desktop</span>
              </div>
              <div className="an-card">
                <b>{report.funnel.bot_failed ?? 0}</b>
                <span>failed the bot check</span>
              </div>
            </div>
            <p className="an-muted">Counted in batches, so the last 20 seconds or so may be missing.</p>

            <div className="an-two">
              <div>
                <h3>Where they go</h3>
                {report.apps.length === 0 ? (
                  <p className="an-muted">Nothing opened yet.</p>
                ) : (
                  <table className="an-table">
                    <thead>
                      <tr>
                        <th>Window</th>
                        <th className="num">Opened</th>
                        <th className="num">By</th>
                        <th className="num">Average time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.apps.map((a) => (
                        <tr key={a.app}>
                          <td>{title(a.app)}</td>
                          <td className="num">{a.opens}</td>
                          <td className="num">{a.visitors}</td>
                          <td className="num">{a.avgSeconds ? duration(a.avgSeconds) : '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div>
                <h3>Links they follow</h3>
                {report.outbound.length === 0 ? (
                  <p className="an-muted">None yet.</p>
                ) : (
                  <table className="an-table">
                    <thead>
                      <tr>
                        <th>Address</th>
                        <th className="num">Clicks</th>
                        <th className="num">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.outbound.map((o) => (
                        <tr key={o.link}>
                          <td className="an-url">{o.link}</td>
                          <td className="num">{o.clicks}</td>
                          <td className="num">{o.visitors}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <h3>Paper Toss</h3>
                {report.games.length === 0 ? (
                  <p className="an-muted">No games finished yet.</p>
                ) : (
                  <table className="an-table">
                    <thead>
                      <tr>
                        <th>Difficulty</th>
                        <th className="num">Runs</th>
                        <th className="num">Best streak</th>
                        <th className="num">Average</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.games.map((g) => (
                        <tr key={g.mode}>
                          <td>{MODES[g.mode] ?? g.mode}</td>
                          <td className="num">{g.runs}</td>
                          <td className="num">{g.best}</td>
                          <td className="num">{g.average}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <h3>Photo albums opened</h3>
                {report.albums.length === 0 ? (
                  <p className="an-muted">None yet.</p>
                ) : (
                  <table className="an-table">
                    <thead>
                      <tr>
                        <th>Album</th>
                        <th className="num">Opened</th>
                        <th className="num">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.albums.map((a) => (
                        <tr key={a.album}>
                          <td>{a.title || a.album}</td>
                          <td className="num">{a.views}</td>
                          <td className="num">{a.visitors}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {report && tab === 'visitors' && !picked && (
          <>
            <p className="an-muted">
              Each row is one browser, recognised between visits by the cookie it was given at log-on. Click one to see everything it did.
              Time on site adds up the time between a visitor’s moves, so a tab left open for hours doesn’t count. Showing the {report.visitors.length} most recent.
            </p>
            {report.visitors.length === 0 ? (
              <p className="an-note">No visitors in this time.</p>
            ) : (
              <table className="an-table">
                <thead>
                  <tr>
                    <th>Visitor</th>
                    <th>Seen</th>
                    <th className="num">Visits</th>
                    <th className="num" title="Time between their moves. A quiet stretch of over 10 minutes isn't counted.">Time on site</th>
                    <th>From</th>
                    <th>On</th>
                    <th className="num">Moves</th>
                    <th>Worth a look</th>
                  </tr>
                </thead>
                <tbody>
                  {report.visitors.map((v) => (
                    <tr key={v.visitor} className="pick" onClick={() => open(v.visitor)}>
                      <td>
                        <span className="an-id">{v.visitor.slice(0, 7)}</span> <small>{v.users.map((u) => WHO[u] ?? u).join(', ')}</small>
                        {v.returning && <small> · returning</small>}
                      </td>
                      <td>{ago(v.lastSeen, report.now)}</td>
                      <td className="num">{v.visits}</td>
                      <td className="num">{v.timeOnSiteSeconds > 0 ? duration(v.timeOnSiteSeconds) : '–'}</td>
                      <td>
                        <span className="an-id">{v.ip}</span>
                        <br />
                        <small>
                          {place(v)}
                          {v.org ? ` · ${v.org}` : ''}
                        </small>
                      </td>
                      <td>
                        {v.browser}
                        <br />
                        <small>
                          {v.os} · {v.device}
                        </small>
                      </td>
                      <td className="num">{v.events}</td>
                      <td>
                        {v.likely.map((l) => (
                          <button
                            key={l.visitor}
                            className="an-flag an-link"
                            title="Same IP address, same browser and system. Click to look at that visitor."
                            onClick={(e) => {
                              e.stopPropagation()
                              open(l.visitor)
                            }}
                          >
                            probably the same person as <span className="an-id">{l.visitor.slice(0, 7)}</span>
                          </button>
                        ))}
                        {v.flags.map((f) => (
                          <span key={f} className={`an-flag${/wrong|bot/.test(f) ? ' bad' : ''}`}>
                            {f}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {report && tab === 'visitors' && picked && (
          <>
            <button className="xp-button an-small an-back" onClick={() => setPicked(null)}>
              ‹ All visitors
            </button>
            {detail === 'loading' && <Spinner block label="Loading…" />}
            {detail === null && <p className="an-note">That visitor can’t be loaded.</p>}
            {detail && detail !== 'loading' && (
              <VisitorDetail detail={detail} now={report.now} title={title} onOpen={open} />
            )}
          </>
        )}

        {report && tab === 'signins' && (
          <>
            <h3>Wrong passwords, by address</h3>
            {report.wrongPasswordIps.length === 0 ? (
              <p className="an-muted">None in this time. Nobody has guessed a password.</p>
            ) : (
              <table className="an-table">
                <thead>
                  <tr>
                    <th>IP address</th>
                    <th className="num">Attempts</th>
                    <th className="num">Browsers</th>
                    <th>Last</th>
                  </tr>
                </thead>
                <tbody>
                  {report.wrongPasswordIps.map((w) => (
                    <tr key={w.ip}>
                      <td className="an-id">{w.ip}</td>
                      <td className="num">{w.attempts}</td>
                      <td className="num">{w.visitors}</td>
                      <td>{ago(w.last, report.now)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <h3>Every wrong password</h3>
            {report.wrongPasswords.length > 0 && (
              <table className="an-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Account</th>
                    <th>From</th>
                    <th>Browser</th>
                  </tr>
                </thead>
                <tbody>
                  {report.wrongPasswords.map((w, i) => (
                    <tr key={i} className={w.visitor ? 'pick' : undefined} onClick={() => w.visitor && open(w.visitor)}>
                      <td>{stamp(w.at)}</td>
                      <td>{w.user}</td>
                      <td>
                        <span className="an-id">{w.ip}</span> <small>{w.country}</small>
                      </td>
                      <td>
                        <span className="an-ua">{w.ua}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function VisitorDetail({ detail, now, title, onOpen }: { detail: Detail; now: number; title: (id: string) => string; onOpen: (visitor: string) => void }) {
  const line = (e: Detail['visits'][number]['events'][number]): string => {
    const d = parseDetail(e.detail)
    switch (e.kind) {
      case 'load': {
        const bits = [d.ref ? `from ${String(d.ref)}` : 'directly', d.w ? `${String(d.w)}×${String(d.h)} screen` : '', d.lang ? String(d.lang) : '', d.tz ? String(d.tz) : ''].filter(Boolean)
        return `Opened the site (${bits.join(' · ')})`
      }
      case 'open':
        return `Opened ${title(e.target)}`
      case 'close':
        return `Closed ${title(e.target)} after ${duration(Number(e.detail) || 0)}`
      case 'out':
        return `Followed the link ${e.target}`
      case 'game':
        return `Paper Toss: a run ended at ${String(d.streak)} (${MODES[String(d.mode)] ?? String(d.mode)})`
      case 'album':
        return `Opened the album “${e.detail || e.target}”`
      case 'photo':
        return `Looked at photo ${Number(e.detail) + 1}`
      case 'leave':
        return `Left the site after ${duration(Number(d.s) || 0)}`
      default:
        return e.kind
    }
  }

  return (
    <>
      <h3>
        Visitor <span className="an-id">{detail.visitor}</span>
      </h3>
      {detail.sameIp.length > 0 && (
        <p>
          Other visitors seen on the same IP address:{' '}
          {detail.sameIp.map((s) => (
            <button key={s.visitor + s.ip} className="xp-button an-small" onClick={() => onOpen(s.visitor)} style={{ marginRight: 4 }}>
              <span className="an-id">{s.visitor.slice(0, 7)}</span> on {s.ip}, {ago(s.lastSeen, now)}
              {s.sameBrowser ? ' · same browser, probably the same person' : ' · different browser'}
            </button>
          ))}
        </p>
      )}
      {detail.logins.length > 0 && (
        <p>
          Sign-ins: {detail.logins.map((l) => `${stamp(l.at)} ${OUTCOMES[l.outcome] ?? l.outcome} (${l.user}, ${l.ip})`).join(' · ')}
        </p>
      )}
      <h3>Visits, newest first</h3>
      {detail.visits.map((v) => (
        <section className="an-visit" key={v.id}>
          <header>
            <b>{stamp(v.startedAt)}</b> · {duration(timeSpent(v.events))} on the site · {WHO[v.user] ?? v.user}
            <br />
            <span className="an-id">{v.ip}</span> · {place(v)}
            {v.org ? ` · ${v.org}` : ''}
            {v.asn ? ` (AS${v.asn})` : ''}
            <br />
            {v.browser} on {v.os} ({v.device})
            <span className="an-ua">{v.ua}</span>
          </header>
          {v.events.length === 0 ? (
            <p className="an-muted">Nothing recorded.</p>
          ) : (
            <ul className="an-timeline">
              {v.events.map((e, i) => (
                <li key={i}>
                  <time>{clock(e.at)}</time> {line(e)}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  )
}
