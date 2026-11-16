import type { ComponentType, ReactElement } from 'react'
import type { IconName } from './icons'

/** A "program" on the desktop. Add one to src/apps/registry.tsx to give the site a new page. */
export interface AppDef {
  /** Doubles as the URL slug: `/about` opens the About window. */
  id: string
  title: string
  icon: IconName | IconArt
  /** Default window size in px. */
  size: { width: number; height: number }
  /** Where the shortcut lives on the desktop. Omit to keep it off the desktop. */
  shortcut?: 'grid' | 'recycle'
  component: ComponentType
}

/** An icon drawn by the app itself rather than taken from the shared set in icons.tsx. */
export interface IconArt {
  art: ReactElement
  /** Defaults to "0 0 48 48". */
  viewBox?: string
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** One open window. There is at most one window per app, so `id` is the app id. */
export interface WindowState extends Rect {
  id: string
  minimized: boolean
  maximized: boolean
  z: number
}
