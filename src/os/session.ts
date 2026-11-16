import { useEffect, useState, useSyncExternalStore } from 'react'
import { setSwitchedOff } from '../apps/registry'

/** The "Logging off…" message stays up at least this long, so it can be read even when the sign-out is instant. */
const LOGOFF_MESSAGE_MS = 1300
/** If the sign-out request hangs, give up waiting and carry on to the log-on screen. */
const LOGOFF_TIMEOUT_MS = 8000

let loggingOff = false
const logOffWatchers = new Set<() => void>()

/** True from the moment log off starts until the page leaves. Drives the "Logging off…" dialog. */
export const useLoggingOff = () =>
  useSyncExternalStore(
    (listener) => {
      logOffWatchers.add(listener)
      return () => {
        logOffWatchers.delete(listener)
      }
    },
    () => loggingOff,
  )

/** Shows "Logging off…", ends the session (the Worker clears the cookie) and returns to the log-on screen. */
export async function logOff(): Promise<void> {
  if (loggingOff) return
  loggingOff = true
  for (const notify of logOffWatchers) notify()
  const started = Date.now()
  try {
    await fetch('/api/logoff', { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(LOGOFF_TIMEOUT_MS) })
  } catch {
    // Whether or not the request landed, carry on: the Worker decides what the next page is.
  }
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, LOGOFF_MESSAGE_MS - (Date.now() - started))))
  window.location.assign('/')
}

export interface CurrentUser {
  id: string
  name: string
  /** The site's owner: the only one who gets the admin-only apps. */
  admin: boolean
}

let current: Promise<CurrentUser | null> | null = null

/** Asks the Worker who is logged on (the session cookie itself is hidden from scripts). Fetched once per page. */
export function fetchCurrentUser(): Promise<CurrentUser | null> {
  current ??= fetch('/api/whoami', { credentials: 'same-origin' })
    .then((r) => (r.ok ? (r.json() as Promise<CurrentUser & { ok: boolean; off?: unknown }>) : null))
    .then((data) => {
      if (!data) return null
      // Before anyone is told who is logged on, drop the apps switched off for this user, so their icons never flash up.
      setSwitchedOff(Array.isArray(data.off) ? data.off.filter((id): id is string => typeof id === 'string') : [])
      return { id: data.id, name: data.name, admin: data.admin === true }
    })
    .catch(() => null)
  return current
}

/** The logged-on user, or null until it is known. */
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null)
  useEffect(() => {
    let live = true
    void fetchCurrentUser().then((u) => live && setUser(u))
    return () => {
      live = false
    }
  }, [])
  return user
}
