import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { getApp } from '../apps/registry'
import { site } from '../site'
import { track, trackLeave } from './track'
import type { AppDef, Rect, WindowState } from './types'

/**
 * The taskbar's height right now. It is 30px, plus the home-indicator gap on a phone (see --taskbar-h in global.css),
 * so it is measured rather than assumed.
 */
export const taskbarHeight = () => document.querySelector('.taskbar')?.getBoundingClientRect().height || 30

/**
 * A phone (or a phone turned sideways): windows fill the screen, because a draggable window is no use there.
 * The same condition is in luna.css under "Small screens", which does the actual filling, so keep the two in step.
 */
export const COMPACT_QUERY = '(max-width: 700px), (pointer: coarse) and (max-height: 500px)'
const isCompact = () => window.matchMedia(COMPACT_QUERY).matches

interface State {
  windows: WindowState[]
  /** How many windows have ever been opened; drives the cascade offset. */
  opened: number
}

type Viewport = { width: number; height: number }

type Action =
  | { type: 'open'; id: string; viewport: Viewport }
  | { type: 'focus'; id: string }
  | { type: 'close'; id: string }
  | { type: 'minimize'; id: string }
  | { type: 'toggleMaximize'; id: string }
  | { type: 'taskbarClick'; id: string }
  | { type: 'setRect'; id: string; rect: Partial<Rect> }
  | { type: 'closeAll' }

const viewport = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight })

/** The topmost window that is not minimized, or null. */
function topWindowId(windows: WindowState[]): string | null {
  let top: WindowState | null = null
  for (const w of windows) if (!w.minimized && (!top || w.z > top.z)) top = w
  return top?.id ?? null
}

/** Bring a window to the front (restoring it if minimized) and renumber z-indices 1..n. */
function raise(windows: WindowState[], id: string): WindowState[] {
  const order = windows
    .filter((w) => w.id !== id)
    .sort((a, b) => a.z - b.z)
    .map((w) => w.id)
    .concat(id)
  return windows.map((w) => ({
    ...w,
    z: order.indexOf(w.id) + 1,
    minimized: w.id === id ? false : w.minimized,
  }))
}

function createWindow(app: AppDef, index: number, vp: Viewport): WindowState {
  const width = Math.min(app.size.width, vp.width - 16)
  const height = Math.min(app.size.height, vp.height - taskbarHeight() - 16)
  const step = (index % 8) * 28
  return {
    id: app.id,
    // 110px clears the desktop icon column on the left.
    x: Math.max(0, Math.min(110 + step, vp.width - width)),
    y: Math.max(0, Math.min(40 + step, vp.height - taskbarHeight() - height)),
    width,
    height,
    minimized: false,
    maximized: isCompact(),
    z: 0,
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'open': {
      if (state.windows.some((w) => w.id === action.id)) {
        return { ...state, windows: raise(state.windows, action.id) }
      }
      const app = getApp(action.id)
      if (!app) return state
      const win = createWindow(app, state.opened, action.viewport)
      return {
        opened: state.opened + 1,
        windows: raise([...state.windows, win], win.id),
      }
    }
    case 'focus':
      return { ...state, windows: raise(state.windows, action.id) }
    case 'close':
      return { ...state, windows: state.windows.filter((w) => w.id !== action.id) }
    case 'minimize':
      return {
        ...state,
        windows: state.windows.map((w) => (w.id === action.id ? { ...w, minimized: true } : w)),
      }
    case 'toggleMaximize':
      return {
        ...state,
        windows: raise(
          state.windows.map((w) => (w.id === action.id ? { ...w, maximized: !w.maximized } : w)),
          action.id,
        ),
      }
    case 'taskbarClick': {
      const win = state.windows.find((w) => w.id === action.id)
      if (!win) return state
      // Like XP: clicking the active window's button minimizes it, anything else brings it up.
      if (!win.minimized && topWindowId(state.windows) === action.id) {
        return {
          ...state,
          windows: state.windows.map((w) => (w.id === action.id ? { ...w, minimized: true } : w)),
        }
      }
      return { ...state, windows: raise(state.windows, action.id) }
    }
    case 'setRect':
      return {
        ...state,
        windows: state.windows.map((w) => (w.id === action.id ? { ...w, ...action.rect } : w)),
      }
    case 'closeAll':
      return { ...state, windows: [] }
  }
}

/** Deep links: loading `/about` opens the About window straight away. */
function init(): State {
  const empty: State = { windows: [], opened: 0 }
  const slug = window.location.pathname.replace(/^\/+|\/+$/g, '')
  return getApp(slug) ? reducer(empty, { type: 'open', id: slug, viewport: viewport() }) : empty
}

interface WindowsApi {
  windows: WindowState[]
  /** Id of the focused window, or null when the desktop is showing. */
  activeId: string | null
  open: (id: string) => void
  focus: (id: string) => void
  close: (id: string) => void
  minimize: (id: string) => void
  toggleMaximize: (id: string) => void
  taskbarClick: (id: string) => void
  setRect: (id: string, rect: Partial<Rect>) => void
  closeAll: () => void
}

const WindowsContext = createContext<WindowsApi | null>(null)

export function WindowsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)
  const activeId = topWindowId(state.windows)
  const startedAt = useRef(Date.now())
  const openSince = useRef(new Map<string, number>())

  // Note which windows get opened, and for how long (see track.ts).
  useEffect(() => {
    const now = Date.now()
    const open = openSince.current
    const ids = new Set(state.windows.map((w) => w.id))
    for (const id of ids) {
      if (!open.has(id)) {
        open.set(id, now)
        track('open', id)
      }
    }
    for (const [id, since] of open) {
      if (!ids.has(id)) {
        open.delete(id)
        track('close', id, String(Math.round((now - since) / 1000)))
      }
    }
  }, [state.windows])

  // When the page is left, say how long the visit lasted and how long each window had been open.
  useEffect(() => {
    const onLeave = () => trackLeave(startedAt.current, Object.fromEntries(openSince.current))
    window.addEventListener('pagehide', onLeave)
    return () => window.removeEventListener('pagehide', onLeave)
  }, [])

  // Keep the address bar and tab title in step with the focused window.
  useEffect(() => {
    const app = activeId ? getApp(activeId) : undefined
    const path = app ? `/${app.id}` : '/'
    if (window.location.pathname !== path) window.history.replaceState(null, '', path)
    document.title = app ? `${app.title} - ${site.title}` : site.title
  }, [activeId])

  const api = useMemo<Omit<WindowsApi, 'windows' | 'activeId'>>(
    () => ({
      open: (id) => dispatch({ type: 'open', id, viewport: viewport() }),
      focus: (id) => dispatch({ type: 'focus', id }),
      close: (id) => dispatch({ type: 'close', id }),
      minimize: (id) => dispatch({ type: 'minimize', id }),
      toggleMaximize: (id) => dispatch({ type: 'toggleMaximize', id }),
      taskbarClick: (id) => dispatch({ type: 'taskbarClick', id }),
      setRect: (id, rect) => dispatch({ type: 'setRect', id, rect }),
      closeAll: () => dispatch({ type: 'closeAll' }),
    }),
    [],
  )

  const value = useMemo(
    () => ({ ...api, windows: state.windows, activeId }),
    [api, state.windows, activeId],
  )

  return <WindowsContext.Provider value={value}>{children}</WindowsContext.Provider>
}

export function useWindows(): WindowsApi {
  const ctx = useContext(WindowsContext)
  if (!ctx) throw new Error('useWindows must be used inside <WindowsProvider>')
  return ctx
}
