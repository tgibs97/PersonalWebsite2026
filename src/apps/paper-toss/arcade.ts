/*
 * Paper Toss's side of the leaderboard (see worker/arcade.ts for the rules). Everything here talks to this
 * site only, and nothing is kept in the browser.
 */

export type Mode = 'baby' | 'souls'

export interface Entry {
  id: number
  rank: number
  initials: string
  score: number
  at: number
}

/** The board's size. Must match the Worker's. */
export const BOARD_SIZE = 10

async function call(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> } | null> {
  try {
    const res = await fetch(`/api/arcade${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as Record<string, unknown> }
  } catch {
    return null
  }
}

/** The top ten for a difficulty, and whether the viewer may remove entries (Trent). Null if it can't be reached. */
export async function fetchBoard(mode: Mode): Promise<{ scores: Entry[]; admin: boolean } | null> {
  const r = await call('GET', `/scores?mode=${mode}`)
  return r?.ok ? { scores: r.data.scores as Entry[], admin: r.data.admin === true } : null
}

/** Asks for the signed token that lets this run's score be handed in. Null if it can't be had (then no score is offered). */
export async function startRun(mode: Mode): Promise<string | null> {
  const r = await call('POST', '/start', { mode })
  return r?.ok && typeof r.data.token === 'string' ? r.data.token : null
}

export type Submitted = { ok: true; ranked: boolean; id?: number; rank?: number; scores: Entry[] } | { ok: false; error: string }

export async function submitScore(mode: Mode, token: string, initials: string, streak: number): Promise<Submitted> {
  const r = await call('POST', '/scores', { mode, token, initials, streak })
  if (!r) return { ok: false, error: 'Couldn’t reach the board. Try again.' }
  if (!r.ok) return { ok: false, error: typeof r.data.error === 'string' ? r.data.error : 'That didn’t go through.' }
  return { ok: true, ranked: r.data.ranked === true, id: r.data.id as number | undefined, rank: r.data.rank as number | undefined, scores: r.data.scores as Entry[] }
}

export async function removeScore(id: number): Promise<boolean> {
  const r = await call('DELETE', `/scores/${id}`)
  return r?.ok === true
}

/** Whether a streak would earn a place: the board has room, or it beats the last place (ties go to the earlier score). */
export const qualifies = (scores: Entry[], streak: number) =>
  streak >= 1 && (scores.length < BOARD_SIZE || streak > scores[scores.length - 1].score)

export const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
