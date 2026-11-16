import { useEffect, useState, useSyncExternalStore } from 'react'

const NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** A month named in the address, for sharing a preview: `?month=10` or `?month=oct`. */
function startingChoice(): number | null {
  const asked = new URLSearchParams(window.location.search).get('month')?.trim().toLowerCase()
  if (!asked) return null
  const n = Number(asked)
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n
  const i = NAMES.findIndex((name) => asked.startsWith(name))
  return i === -1 ? null : i + 1
}

/**
 * The theme the visitor picked from the clock menu, or null to follow the calendar.
 *
 * This lives in memory ONLY, on purpose: it is never written to localStorage, a cookie, or the address
 * bar. Refresh the page and it is gone, and the wallpaper goes back to today's theme. (A `?month=` in the
 * address just sets the starting choice, as if that month had been picked on load.)
 */
let choice: number | null = startingChoice()
const listeners = new Set<() => void>()

/** Pick a month's theme (1-12), or pass null to follow today's date again. */
export function chooseWallpaperMonth(month: number | null) {
  if (month === choice) return
  choice = month
  for (const notify of listeners) notify()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The visitor's pick, or null when the wallpaper is following the date. */
export const useWallpaperChoice = () => useSyncExternalStore(subscribe, () => choice)

/** The visitor's own calendar month, from their device's clock. */
export const currentMonth = () => new Date().getMonth() + 1

/** Milliseconds until a second past the next local midnight. (Never longer than a day, so no timer overflow.) */
function msUntilMidnight(): number {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
  return next.getTime() - now.getTime()
}

/**
 * Today's month, kept current: it re-checks at every midnight, and again whenever the tab becomes visible
 * (a laptop that slept through midnight, or a background tab whose timers were paused).
 */
function useToday(): number {
  const [today, setToday] = useState(currentMonth)

  useEffect(() => {
    let timer: number
    const check = () => setToday(currentMonth())
    const schedule = () => {
      timer = window.setTimeout(() => {
        check()
        schedule()
      }, msUntilMidnight())
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }

    schedule()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return today
}

/** Which month's wallpaper to show: the visitor's pick if they made one, otherwise today's month. */
export function useWallpaperMonth(): number {
  const picked = useWallpaperChoice()
  const today = useToday()
  return picked ?? today
}
