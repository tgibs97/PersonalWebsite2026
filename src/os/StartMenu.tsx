import { useApps } from '../apps/registry'
import { site } from '../site'
import { useCurrentUser } from './session'
import { AppIcon, Icon } from './icons'

interface StartMenuProps {
  onOpen: (id: string) => void
  onLogOff: () => void
  onTurnOff: () => void
}

export function StartMenu({ onOpen, onLogOff, onTurnOff }: StartMenuProps) {
  const user = useCurrentUser()
  const apps = useApps()
  const programs = apps.filter((a) => a.shortcut !== 'recycle')
  const system = apps.filter((a) => a.shortcut === 'recycle')

  return (
    <div className="start-menu" role="menu" aria-label="Start menu">
      <div className="start-header">
        <Icon name="user" size={42} className="start-avatar" />
        <span className="start-username">{user?.name ?? site.owner}</span>
      </div>

      <div className="start-body">
        <ul className="start-col start-col-left">
          {programs.map((app) => (
            <li key={app.id}>
              <button role="menuitem" className="start-item start-item-big" onClick={() => onOpen(app.id)}>
                <AppIcon icon={app.icon} size={32} />
                <span>{app.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <ul className="start-col start-col-right">
          {system.map((app) => (
            <li key={app.id}>
              <button role="menuitem" className="start-item" onClick={() => onOpen(app.id)}>
                <AppIcon icon={app.icon} size={22} />
                <span>{app.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="start-footer">
        <button className="start-power" onClick={onLogOff}>
          <span className="power-glyph power-glyph-logoff" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 10h9M11 6.5l3.5 3.5-3.5 3.5" />
            </svg>
          </span>
          Log Off
        </button>
        <button className="start-power" onClick={onTurnOff}>
          <span className="power-glyph power-glyph-off" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M10 4v6M6.2 6.5a5.5 5.5 0 1 0 7.6 0" />
            </svg>
          </span>
          Turn Off Computer
        </button>
      </div>
    </div>
  )
}
