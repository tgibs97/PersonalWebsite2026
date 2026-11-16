import type { AppDef } from '../../os/types'
import { Cruise } from './Cruise'
import { cruiseIcon, giftIcon, mothershipIcon } from './icons'
import { Mothership } from './Mothership'
import { Wishlist } from './Wishlist'

/**
 * Members-only apps: hidden from the Guests account. Everything in this folder is built into its own file
 * (assets/private/...) that the Worker refuses to send to a guest session, so guests can't see these apps
 * even by digging through the site's JavaScript. Add a members-only app here, not in ../registry.tsx.
 */
export const privateApps: AppDef[] = [
  { id: 'wishlist', title: 'Wishlist', icon: giftIcon, size: { width: 780, height: 540 }, shortcut: 'grid', component: Wishlist },
  { id: 'cruise', title: 'Cruise', icon: cruiseIcon, size: { width: 540, height: 400 }, shortcut: 'grid', component: Cruise },
  { id: 'mothership', title: 'Mothership', icon: mothershipIcon, size: { width: 580, height: 420 }, shortcut: 'grid', component: Mothership },
]
