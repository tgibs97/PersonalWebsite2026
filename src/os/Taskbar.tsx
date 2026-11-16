import { useEffect, useRef, useState } from 'react'
import { useApps } from '../apps/registry'
import { ClockMenu } from './ClockMenu'
import { AppIcon, Icon } from './icons'
import { logOff, useCurrentUser } from './session'
import { StartMenu } from './StartMenu'
import { useWindows } from './windows'

function useClock() {
  const format = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const [time, setTime] = useState(format)
  useEffect(() => {
    const id = window.setInterval(() => setTime(format()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  return time
}

interface TaskbarProps {
  onTurnOff: () => void
}

export function Taskbar({ onTurnOff }: TaskbarProps) {
  const { windows, activeId, open, taskbarClick, closeAll } = useWindows()
  // One menu at a time: opening the clock menu closes the Start menu, and vice versa.
  const [menu, setMenu] = useState<'start' | 'clock' | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const time = useClock()
  const user = useCurrentUser()
  const apps = useApps()
  const getApp = (id: string) => apps.find((a) => a.id === id)
  const toggle = (which: 'start' | 'clock') => setMenu((current) => (current === which ? null : which))

  // Dismiss a menu on any press outside the taskbar, or on Escape. Capture phase so nothing can swallow it.
  useEffect(() => {
    if (!menu) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenu(null)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menu])

  return (
    <div className="taskbar-root" ref={rootRef}>
      {menu === 'start' && (
        <StartMenu
          onOpen={(id) => {
            open(id)
            setMenu(null)
          }}
          onLogOff={() => {
            closeAll()
            setMenu(null)
            void logOff()
          }}
          onTurnOff={() => {
            setMenu(null)
            onTurnOff()
          }}
        />
      )}
      {menu === 'clock' && <ClockMenu />}

      <div className="taskbar">
        <button
          className={`start-button${menu === 'start' ? ' pressed' : ''}`}
          aria-label="Start"
          aria-expanded={menu === 'start'}
          onClick={() => toggle('start')}
        >
          <Icon name="tgos" size={26} />
          {user && (
            <span className="start-user" title={`Logged on as ${user.name}`}>
              {user.name}
            </span>
          )}
        </button>

        <div className="task-buttons">
          {windows.map((w) => {
            const app = getApp(w.id)
            if (!app) return null
            return (
              <button
                key={w.id}
                className={`task-button${activeId === w.id ? ' active' : ''}`}
                onClick={() => taskbarClick(w.id)}
                title={app.title}
              >
                <AppIcon icon={app.icon} size={16} />
                <span>{app.title}</span>
              </button>
            )
          })}
        </div>

        <button
          className={`tray${menu === 'clock' ? ' pressed' : ''}`}
          aria-expanded={menu === 'clock'}
          aria-haspopup="dialog"
          title="Click to change the desktop theme"
          onClick={() => toggle('clock')}
        >
          {time}
        </button>
      </div>
    </div>
  )
}
