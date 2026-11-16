import type { PointerEvent as ReactPointerEvent } from 'react'
import { useApps } from '../apps/registry'
import { AppIcon } from './icons'
import type { WindowState } from './types'
import { taskbarHeight, useWindows } from './windows'

const MIN_WIDTH = 220
const MIN_HEIGHT = 140
/** How much of a window must stay on screen so it can always be dragged back. */
const GRAB_MARGIN = 80
const TITLEBAR_HEIGHT = 30

const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const
type Handle = (typeof HANDLES)[number]

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/** Follow a pointer drag from the element that received `pointerdown`, reporting the offset from the start. */
function trackDrag(e: ReactPointerEvent<HTMLElement>, onMove: (dx: number, dy: number) => void) {
  const el = e.currentTarget
  const startX = e.clientX
  const startY = e.clientY
  el.setPointerCapture(e.pointerId)

  const move = (ev: PointerEvent) => onMove(ev.clientX - startX, ev.clientY - startY)
  const end = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', end)
    el.removeEventListener('pointercancel', end)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', end)
  el.addEventListener('pointercancel', end)
}

export function Window({ win }: { win: WindowState }) {
  const { activeId, focus, close, minimize, toggleMaximize, setRect } = useWindows()
  const app = useApps().find((a) => a.id === win.id)
  if (!app) return null

  const AppContent = app.component
  const active = activeId === win.id

  function startMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    focus(win.id)
    if (win.maximized) return
    trackDrag(e, (dx, dy) => {
      setRect(win.id, {
        x: clamp(win.x + dx, GRAB_MARGIN - win.width, window.innerWidth - GRAB_MARGIN),
        y: clamp(win.y + dy, 0, window.innerHeight - taskbarHeight() - TITLEBAR_HEIGHT),
      })
    })
  }

  function startResize(e: ReactPointerEvent<HTMLDivElement>, handle: Handle) {
    if (e.button !== 0) return
    focus(win.id)
    const { x, y, width, height } = win
    trackDrag(e, (dx, dy) => {
      const next = { x, y, width, height }
      if (handle.includes('e')) next.width = Math.max(MIN_WIDTH, width + dx)
      if (handle.includes('s')) next.height = Math.max(MIN_HEIGHT, height + dy)
      if (handle.includes('w')) {
        next.width = Math.max(MIN_WIDTH, width - dx)
        next.x = x + width - next.width
      }
      if (handle.includes('n')) {
        next.height = Math.max(MIN_HEIGHT, height - dy)
        next.y = Math.max(0, y + height - next.height)
        next.height = y + height - next.y
      }
      setRect(win.id, next)
    })
  }

  const classes = ['window', active && 'active', win.maximized && 'maximized', win.minimized && 'minimized']
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      role="dialog"
      aria-label={app.title}
      style={
        win.maximized
          ? { zIndex: win.z }
          : { left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.z }
      }
      onPointerDownCapture={() => {
        if (!active) focus(win.id)
      }}
    >
      <div className="titlebar" onPointerDown={startMove} onDoubleClick={() => toggleMaximize(win.id)}>
        <AppIcon icon={app.icon} size={16} className="titlebar-icon" />
        <span className="titlebar-text">{app.title}</span>
        <div className="titlebar-buttons" onDoubleClick={(e) => e.stopPropagation()}>
          <button className="tb-btn" aria-label="Minimize" onClick={() => minimize(win.id)}>
            <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true">
              <rect x="5" y="13" width="8" height="3" fill="#fff" />
            </svg>
          </button>
          <button
            className="tb-btn tb-maximize"
            aria-label={win.maximized ? 'Restore' : 'Maximize'}
            onClick={() => toggleMaximize(win.id)}
          >
            <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true" fill="none" stroke="#fff">
              {win.maximized ? (
                <>
                  <path d="M8.5 5.5h7v6h-1.5" strokeWidth="1.5" />
                  <path d="M8.5 5.5v1" strokeWidth="2" />
                  <rect x="5.5" y="8.5" width="7" height="6" strokeWidth="1.5" />
                  <path d="M5 8.5h8" strokeWidth="2.5" />
                </>
              ) : (
                <>
                  <rect x="5.5" y="5.5" width="10" height="10" strokeWidth="1.5" />
                  <path d="M5 6h11" strokeWidth="2.5" />
                </>
              )}
            </svg>
          </button>
          <button className="tb-btn tb-close" aria-label="Close" onClick={() => close(win.id)}>
            <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l9 9M15 6l-9 9" />
            </svg>
          </button>
        </div>
      </div>

      <div className="window-body">
        <AppContent />
      </div>

      {!win.maximized &&
        HANDLES.map((h) => (
          <div key={h} className={`resize resize-${h}`} onPointerDown={(e) => startResize(e, h)} />
        ))}
    </div>
  )
}
