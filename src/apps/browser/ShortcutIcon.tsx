import type { ReactElement } from 'react'
import { starPoints } from '../../os/icons'

export type ShortcutIconName = 'diary' | 'trophy' | 'bolt' | 'top' | 'lists'

const art: Record<ShortcutIconName, ReactElement> = {
  /** A film diary: a notebook with a star. */
  diary: (
    <>
      <rect x="9" y="6" width="30" height="36" rx="2.5" fill="#2f6bd6" stroke="#1b3f86" />
      <rect x="13" y="6" width="26" height="36" rx="1.5" fill="#fff" stroke="#9aa7bd" />
      <path d="M18 15h16M18 21h16M18 27h10" stroke="#b6c1d6" strokeWidth="1.8" strokeLinecap="round" />
      <polygon points={starPoints(33, 34, 7, 3)} fill="#ffcc33" stroke="#c99200" strokeWidth=".6" />
    </>
  ),
  /** The "everything ranked" list: a trophy. */
  trophy: (
    <>
      <defs>
        <linearGradient id="bp-trophy" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset=".55" stopColor="#f5b932" />
          <stop offset="1" stopColor="#c98a14" />
        </linearGradient>
      </defs>
      <path d="M14 11H7v5c0 5 3 8 8 8M34 11h7v5c0 5-3 8-8 8" fill="none" stroke="#c98a14" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M13 7h22v11c0 7-5 11-11 11S13 25 13 18z" fill="url(#bp-trophy)" stroke="#9a6a0c" />
      <rect x="21" y="29" width="6" height="6" fill="#d89a1c" stroke="#9a6a0c" />
      <rect x="15" y="35" width="18" height="6" rx="1.5" fill="#8a5a10" stroke="#5a3a08" />
      <polygon points={starPoints(24, 17, 5, 2.2)} fill="#fff6c8" opacity=".9" />
    </>
  ),
  /** A generic hero badge: a gold shield with a lightning bolt. */
  bolt: (
    <>
      <defs>
        <linearGradient id="bp-badge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd96b" />
          <stop offset="1" stopColor="#d9941c" />
        </linearGradient>
      </defs>
      <path d="M24 4L40 10V24C40 33 33 40 24 44C15 40 8 33 8 24V10Z" fill="url(#bp-badge)" stroke="#8a5a10" strokeLinejoin="round" />
      <path d="M24 8L36 12.5V24C36 31 31 36.5 24 40C17 36.5 12 31 12 24V12.5Z" fill="#1f4fb8" />
      <path d="M26 13L17 26H23L21 36L31 22H25Z" fill="#fff1a8" stroke="#ffd24a" strokeWidth=".6" strokeLinejoin="round" />
    </>
  ),
  /** A spinning top, for a director fond of dreams within dreams. */
  top: (
    <>
      <defs>
        <linearGradient id="bp-top" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f2f5fa" />
          <stop offset=".5" stopColor="#aab4c8" />
          <stop offset="1" stopColor="#6b7794" />
        </linearGradient>
      </defs>
      <g transform="rotate(-10 24 42)">
        <rect x="22.5" y="3" width="3" height="9" rx="1.5" fill="#6b7388" />
        <path d="M9 14C11 27 19 34 24 43C29 34 37 27 39 14Z" fill="url(#bp-top)" stroke="#556078" strokeLinejoin="round" />
        <ellipse cx="24" cy="14" rx="15" ry="5.5" fill="#d6dce8" stroke="#6b7388" />
        <ellipse cx="24" cy="13.5" rx="10" ry="3" fill="#fff" opacity=".7" />
        <path d="M13 21C20 25 28 25 35 21" fill="none" stroke="#556078" strokeWidth="1.2" opacity=".6" />
      </g>
    </>
  ),
  /** A stack of lists. */
  lists: (
    <>
      {[7, 19.5, 32].map((y) => (
        <g key={y}>
          <rect x="7" y={y} width="34" height="10" rx="2" fill="#fff" stroke="#7d8aa3" />
          <circle cx="13" cy={y + 5} r="2.4" fill="#3b86f2" />
          <path d={`M19 ${y + 5}h16`} stroke="#b6c1d6" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
    </>
  ),
}

/** Little illustrations for browser shortcuts, drawn to match the desktop icons. */
export function ShortcutIcon({ name, size = 48 }: { name: ShortcutIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {art[name]}
    </svg>
  )
}
