import { Icon } from './icons'
import { useCurrentUser, useLoggingOff } from './session'

/**
 * A small "Logging off…" window over a dimmed screen, shown from the moment Log Off is chosen until the page
 * moves on to the log-on screen. Nothing in it can be clicked: the dim layer takes every click.
 */
export function LogOffDialog() {
  const loggingOff = useLoggingOff()
  const user = useCurrentUser()
  if (!loggingOff) return null

  return (
    <div className="logoff-backdrop">
      <div className="window active logoff-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logoff-title" aria-describedby="logoff-text">
        <div className="titlebar">
          <span className="titlebar-text" id="logoff-title">
            Log Off
          </span>
        </div>
        <div className="logoff-content">
          <div className="logoff-body">
            <Icon name="user" size={40} />
            <div id="logoff-text" role="status">
              <strong>Logging off{user ? ` ${user.name}` : ''}…</strong>
              <p>See you next time.</p>
            </div>
          </div>
          <div className="logoff-progress" aria-hidden="true">
            <i />
          </div>
        </div>
      </div>
    </div>
  )
}
