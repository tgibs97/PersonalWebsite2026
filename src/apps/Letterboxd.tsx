import { Browser, type Shortcut } from './browser/Browser'

const SHORTCUTS: Shortcut[] = [
  { id: 'reviews', title: 'Reviews', url: 'https://letterboxd.com/tgibs97/diary/', icon: 'diary' },
  { id: 'all-movies-ranked', title: 'All Movies Ranked', url: 'https://letterboxd.com/tgibs97/list/everything/', icon: 'trophy' },
  { id: 'mcu-ranked', title: 'MCU Ranked', url: 'https://letterboxd.com/tgibs97/list/mcu-ranked/', icon: 'bolt' },
  { id: 'nolan-ranked', title: 'Nolan Ranked', url: 'https://letterboxd.com/tgibs97/list/nolan-ranked/', icon: 'top' },
  { id: 'all-lists', title: 'All Lists', url: 'https://letterboxd.com/tgibs97/lists/', icon: 'lists' },
]

export function Letterboxd() {
  return <Browser startTitle="My Letterboxd" shortcuts={SHORTCUTS} />
}
