/*
 * The rules of the Paper Toss leaderboard. Kept apart from arcade.ts (no imports) so they can be tested alone.
 *
 * The score is reported by the player's own browser, so it can't be fully trusted. These rules make cheating
 * awkward rather than impossible: a score needs a run token the Worker signed when the run began, enough real
 * time to have passed to throw that many baskets, and it can be handed in once. Anything that still gets
 * through is visible in Trent's Analytics window, and he can remove an entry from the board.
 */

export const MODES = ['baby', 'souls'] as const
export type Mode = (typeof MODES)[number]
export const isMode = (value: unknown): value is Mode => typeof value === 'string' && (MODES as readonly string[]).includes(value)

/** How many places are shown (and can be earned) on each board. */
export const BOARD_SIZE = 10
/** Entries below this rank are tidied away. */
export const KEEP_RANKS = 50
/** One browser may hold at most this many places on one board. */
export const MAX_PER_VISITOR = 3
/** A streak this long isn't believed. */
export const MAX_STREAK = 500
/** The fastest a real basket can be: a quick aim, the flight, and the pause while it drops into the bin. */
export const MIN_MS_PER_BASKET = 1400
/** A run token is good for this long. */
export const RUN_MAX_AGE_MS = 6 * 3_600_000

/** Combinations that don't go on the board. Arcade boards have always needed this. */
const BLOCKED = new Set(['ASS', 'CNT', 'CUM', 'DIK', 'FAG', 'FCK', 'FUK', 'KKK', 'NAZ', 'NIG', 'SEX', 'SHT', 'TIT', 'XXX'])

/** Exactly three letters or digits, upper-cased, and not one of the blocked combinations. Otherwise null. */
export function cleanInitials(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const initials = value.trim().toUpperCase()
  if (!/^[A-Z0-9]{3}$/.test(initials)) return null
  return BLOCKED.has(initials) ? null : initials
}

/** Whether a streak is believable for a run that has lasted `elapsedMs`. */
export function plausible(streak: unknown, elapsedMs: number): streak is number {
  return (
    typeof streak === 'number' &&
    Number.isInteger(streak) &&
    streak >= 1 &&
    streak <= MAX_STREAK &&
    elapsedMs >= streak * MIN_MS_PER_BASKET
  )
}
