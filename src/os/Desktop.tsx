import { useEffect, useRef, useState } from 'react'
import { INITIAL_SLUG, loadAdminApps, loadPrivateApps, useApps } from '../apps/registry'
import { AppIcon } from './icons'
import { LogOffDialog } from './LogOffDialog'
import { useCurrentUser } from './session'
import type { AppDef } from './types'
import { Taskbar } from './Taskbar'
import { Wallpaper } from './Wallpaper'
import { Window } from './Window'
import { useWindows } from './windows'

interface DesktopIconProps {
  app: AppDef
  selected: boolean
  onSelect: () => void
  onOpen: () => void
}

function DesktopIcon({ app, selected, onSelect, onOpen }: DesktopIconProps) {
  const pointerType = useRef('mouse')
  return (
    <button
      className={`desktop-icon${selected ? ' selected' : ''}`}
      onPointerDown={(e) => {
        pointerType.current = e.pointerType
      }}
      onClick={() => {
        onSelect()
        // Touch has no double-click, so a single tap opens the app.
        if (pointerType.current === 'touch') onOpen()
      }}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
    >
      <AppIcon icon={app.icon} size={48} />
      <span>{app.title}</span>
    </button>
  )
}

export function Desktop() {
  const { windows, open, close } = useWindows()
  const [selected, setSelected] = useState<string | null>(null)
  const [poweredOff, setPoweredOff] = useState(false)
  const user = useCurrentUser()
  const apps = useApps()
  const deepLink = useRef(INITIAL_SLUG)

  // Members get the members-only apps; Guests never ask for them (and the Worker would refuse anyway).
  useEffect(() => {
    if (user && user.id !== 'guests') void loadPrivateApps()
    if (user?.admin) void loadAdminApps()
  }, [user])

  // A link straight to an app Trent has switched off (/photos) opens its window before the switches are known: close it.
  useEffect(() => {
    if (!user) return
    for (const w of windows) if (!apps.some((a) => a.id === w.id)) close(w.id)
  }, [user, apps, windows, close])

  // A link straight to a members-only app (/wishlist) can only open once those apps have arrived.
  useEffect(() => {
    const slug = deepLink.current
    if (slug && apps.some((a) => a.id === slug)) {
      deepLink.current = ''
      if (!windows.some((w) => w.id === slug)) open(slug)
    }
  }, [apps, windows, open])

  if (poweredOff) {
    return (
      <div className="power-off">
        {/* Only this button turns the computer back on: clicking the black screen does nothing. */}
        <button className="power-button" onClick={() => setPoweredOff(false)} aria-label="Turn the computer on" title="Power" autoFocus>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" aria-hidden="true">
            <path d="M17 5v11" />
            <path d="M10.2 9.6a11 11 0 1 0 13.6 0" />
          </svg>
        </button>
      </div>
    )
  }

  const renderIcons = (slot: AppDef['shortcut']) =>
    (user ? apps : [])
      .filter((a) => a.shortcut === slot)
      .map((app) => (
        <DesktopIcon
          key={app.id}
          app={app}
          selected={selected === app.id}
          onSelect={() => setSelected(app.id)}
          onOpen={() => open(app.id)}
        />
      ))

  return (
    <div
      className="desktop"
      onPointerDown={(e) => {
        if (!(e.target as HTMLElement).closest('.desktop-icon')) setSelected(null)
      }}
    >
      <Wallpaper />
      <div className="desktop-icons">{renderIcons('grid')}</div>
      <div className="desktop-recycle">{renderIcons('recycle')}</div>

      {windows.map((w) => (
        <Window key={w.id} win={w} />
      ))}

      <Taskbar onTurnOff={() => setPoweredOff(true)} />
      <LogOffDialog />
    </div>
  )
}
