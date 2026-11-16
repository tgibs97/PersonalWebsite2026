import { useState } from 'react'
import { track } from '../../os/track'
import { ShortcutIcon, type ShortcutIconName } from './ShortcutIcon'

export interface Shortcut {
  /** Unique within one browser. */
  id: string
  title: string
  /** The real address. Clicking the tile opens it in a new tab of the visitor's own browser. */
  url: string
  icon: ShortcutIconName
}

interface BrowserProps {
  /** Heading on the start page. */
  startTitle: string
  shortcuts: Shortcut[]
}

const START_URL = 'about:home'

/** `https://letterboxd.com/tgibs97/diary/` -> `letterboxd.com/tgibs97/diary/` */
function displayUrl(url: string) {
  const { host, pathname } = new URL(url)
  return `${host}${pathname}`
}

const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" fill="#4a9af5" stroke="#1f5fb8" />
    <path d="M4 5.5c1.5-.5 2.5.5 3 1.5s-1 2-1.5 3c-1 .5-2-.5-2-1.5zM9.5 3.5c1 0 2.5.5 3 1.5l-.5 2.5c-1 .5-2-.5-2-1.5z" fill="#5dbb4a" />
  </svg>
)

/**
 * A make-believe web browser in the style of Windows XP's Internet Explorer, showing a start page of
 * shortcuts. Each tile is a real link: it opens the real address in a new tab of the visitor's own browser,
 * and hovering one shows its address in the status bar, as a real browser would. (Sites like Letterboxd
 * refuse to be shown inside other sites, so there is nothing to display in here beyond the start page.)
 * Give it a list of shortcuts and it does the rest.
 */
export function Browser({ startTitle, shortcuts }: BrowserProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div className="bp">
      <div className="bp-address">
        <span className="bp-address-label">Address</span>
        <div className="bp-address-field">
          <GlobeIcon />
          <span className="bp-url">{START_URL}</span>
        </div>
      </div>

      <div className="bp-tabs">
        <div className="bp-tab">
          <GlobeIcon />
          <span className="bp-tab-title">Start Page</span>
        </div>
      </div>

      <div className="bp-view">
        <header className="bp-home-header">
          <h1>{startTitle}</h1>
          <p>Pick a shortcut. It opens in a new tab of your browser.</p>
        </header>
        <ul className="bp-shortcuts">
          {shortcuts.map((s) => (
            <li key={s.id}>
              <a
                className="bp-tile"
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('out', s.url)}
                onMouseEnter={() => setHovered(s.url)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(s.url)}
                onBlur={() => setHovered(null)}
              >
                <ShortcutIcon name={s.icon} size={52} />
                <span className="bp-tile-title">{s.title}</span>
                <span className="bp-tile-url">{displayUrl(s.url)}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="bp-status">
        <span className="bp-status-text">{hovered ?? 'Done'}</span>
        <span className="bp-zone">
          <GlobeIcon />
          Internet
        </span>
      </div>
    </div>
  )
}
