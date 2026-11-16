import { useSyncExternalStore } from 'react'
import type { AppDef } from '../os/types'
import { About } from './About'
import { Backlogged } from './Backlogged'
import { Letterboxd } from './Letterboxd'
import { Photos } from './Photos'
import { Projects } from './Projects'
import { RecycleBin } from './RecycleBin'

/**
 * Every page on the site is an "app". Public apps are listed here; members-only apps (hidden from Guests)
 * live in ./private and join the list once loaded. Add an entry and it gets a desktop icon,
 * a Start menu item, a window, and its own URL (`/<id>`) with no other wiring.
 * Desktop icons stack down the left side in this order.
 */
const publicApps: AppDef[] = [
  {
    id: 'about',
    title: 'About Me',
    icon: 'user',
    size: { width: 520, height: 380 },
    shortcut: 'grid',
    component: About,
  },
  {
    id: 'projects',
    title: 'Projects',
    icon: 'folder',
    size: { width: 560, height: 400 },
    shortcut: 'grid',
    component: Projects,
  },
  {
    id: 'photos',
    title: 'Photos',
    icon: 'photos',
    size: { width: 720, height: 520 },
    shortcut: 'grid',
    component: Photos,
  },
  {
    id: 'letterboxd',
    title: 'Letterboxd',
    icon: 'film',
    size: { width: 760, height: 500 },
    shortcut: 'grid',
    component: Letterboxd,
  },
  {
    id: 'backlogged',
    title: 'Backlogged',
    icon: 'gamepad',
    size: { width: 560, height: 420 },
    shortcut: 'grid',
    component: Backlogged,
  },
  {
    id: 'recycle-bin',
    title: 'Recycle Bin',
    icon: 'recycle',
    size: { width: 640, height: 460 },
    shortcut: 'recycle',
    component: RecycleBin,
  },
]

/** Members-only apps slot into the desktop right after this one. (Their names never appear in this file.) */
const PRIVATE_APPS_AFTER = 'photos'

let privateApps: AppDef[] = []
/** Ids of apps switched off for whoever is logged on (from the Control Panel). Left out of the list. */
let switchedOff = new Set<string>()
let adminApps: AppDef[] = []
let allApps: AppDef[] = publicApps
const listeners = new Set<() => void>()

/** The apps this visitor can use right now. */
export const getApps = () => allApps
export const getApp = (id: string): AppDef | undefined => allApps.find((a) => a.id === id)

/** Live list of apps; re-renders when the members-only apps arrive. */
export const useApps = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getApps,
  )

let loading: Promise<void> | null = null

/** Rebuilds the list from the public apps plus whichever members-only and admin-only apps have arrived. */
function combine() {
  const at = publicApps.findIndex((a) => a.id === PRIVATE_APPS_AFTER) + 1
  const shown = (apps: AppDef[]) => apps.filter((a) => !switchedOff.has(a.id))
  allApps = [...shown(publicApps.slice(0, at)), ...shown(privateApps), ...shown(adminApps), ...shown(publicApps.slice(at))]
  for (const notify of listeners) notify()
}

/** Hides the apps switched off for this user. Called once, as soon as the Worker says who is logged on. */
export function setSwitchedOff(ids: string[]) {
  switchedOff = new Set(ids)
  combine()
}

/** The apps the Control Panel can switch: every app (even ones switched off for Trent) except the Control Panel itself. */
export const useSwitchableApps = () => {
  useApps() // re-render when the members-only apps arrive
  return { everyone: publicApps, members: privateApps, trentOnly: adminApps.filter((a) => a.id !== 'control-panel') }
}

/** Fetches the members-only apps. Only call this for Trent or Family & Friends: the Worker refuses guests. */
export function loadPrivateApps(): Promise<void> {
  loading ??= import('./private/registry')
    .then((m) => {
      privateApps = m.privateApps
      combine()
    })
    .catch(() => {
      loading = null
    })
  return loading
}

let loadingAdmin: Promise<void> | null = null

/** Fetches the admin-only apps. Only call this for the admin: the Worker refuses everyone else. */
export function loadAdminApps(): Promise<void> {
  loadingAdmin ??= import('./admin/registry')
    .then((m) => {
      adminApps = m.adminApps
      combine()
    })
    .catch(() => {
      loadingAdmin = null
    })
  return loadingAdmin
}

/** The app named in the address when the page loaded (e.g. "wishlist" for /wishlist), read before anything rewrites it. */
export const INITIAL_SLUG = window.location.pathname.replace(/^\/+|\/+$/g, '')
