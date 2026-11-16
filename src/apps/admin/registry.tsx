import type { AppDef } from '../../os/types'
import { Analytics } from './Analytics'
import { ControlPanel } from './ControlPanel'
import { chartIcon, controlPanelIcon } from './icons'

/**
 * Admin-only apps: for the site's owner and nobody else. Everything in this folder is built into its own
 * file (assets/admin/...) that the Worker refuses to every other session, and the desktop only asks for it
 * when it's the owner logged on. Add an admin-only app here, not in ../registry.tsx or ../private.
 */
export const adminApps: AppDef[] = [
  { id: 'analytics', title: 'Analytics', icon: chartIcon, size: { width: 940, height: 600 }, shortcut: 'grid', component: Analytics },
  { id: 'control-panel', title: 'Control Panel', icon: controlPanelIcon, size: { width: 660, height: 600 }, shortcut: 'grid', component: ControlPanel },
]
