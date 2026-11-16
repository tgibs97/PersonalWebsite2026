import { chooseWallpaperMonth, currentMonth, useWallpaperChoice } from './wallpaper/month'
import { THEMES } from './wallpaper/themes'

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * The panel that opens when the taskbar clock is clicked: pick any month's wallpaper theme. The choice is held
 * in memory only (see wallpaper/month.ts), so it lasts until the page is refreshed and never persists.
 */
export function ClockMenu() {
  const choice = useWallpaperChoice()
  const today = currentMonth()
  const dateText = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="clock-menu" role="dialog" aria-label="Desktop theme">
      <div className="clock-menu-title">Date and Time Properties</div>
      <div className="clock-menu-body">
        <p className="clock-menu-date">{dateText}</p>
        <p className="clock-menu-hint">Pick a desktop theme. It lasts until you refresh the page.</p>

        <div className="theme-grid">
          {THEMES.map((theme) => {
            const selected = choice === theme.month
            return (
              <button
                key={theme.month}
                className={`xp-button theme-button${selected ? ' selected' : ''}`}
                aria-pressed={selected}
                onClick={() => chooseWallpaperMonth(theme.month)}
              >
                <span
                  className="theme-swatch"
                  style={{ background: `linear-gradient(to bottom, ${theme.sky[1]} 0 55%, ${theme.hill[1]} 55% 100%)` }}
                />
                <span className="theme-text">
                  <b>
                    {MONTH_ABBR[theme.month - 1]}
                    {theme.month === today && <i> · today</i>}
                  </b>
                  <small>{theme.name}</small>
                </span>
              </button>
            )
          })}
        </div>

        <button
          className={`xp-button theme-auto${choice === null ? ' selected' : ''}`}
          aria-pressed={choice === null}
          onClick={() => chooseWallpaperMonth(null)}
        >
          Follow today's date
        </button>
      </div>
    </div>
  )
}
