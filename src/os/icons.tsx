import type { ReactElement } from 'react'
import { LogoArt } from './logo-art'
import type { IconArt } from './types'

export type IconName =
  | 'user'
  | 'folder'
  | 'photos'
  | 'film'
  | 'gamepad'
  | 'recycle'
  | 'tgos'

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

/** Points for a five-pointed star, for an SVG <polygon>. */
export const starPoints = (cx: number, cy: number, outer: number, inner: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const [x, y] = polar(cx, cy, i % 2 ? inner : outer, -90 + i * 36)
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')

/** Three green arrows chasing each other, the recycling mark. */
function RecycleArrows() {
  const cx = 24
  const cy = 28
  const r = 6.5
  return (
    <g>
      {[0, 120, 240].map((offset) => {
        const start = offset - 70
        const end = offset + 15
        const [x1, y1] = polar(cx, cy, r, start)
        const [x2, y2] = polar(cx, cy, r, end)
        const rad = (end * Math.PI) / 180
        const u = [Math.cos(rad), Math.sin(rad)]
        const t = [-Math.sin(rad), Math.cos(rad)]
        const tip = [x2 + t[0] * 5, y2 + t[1] * 5]
        const head = `${x2 + u[0] * 3.6},${y2 + u[1] * 3.6} ${x2 - u[0] * 3.6},${y2 - u[1] * 3.6} ${tip[0]},${tip[1]}`
        return (
          <g key={offset}>
            <path d={`M${x1} ${y1}A${r} ${r} 0 0 1 ${x2} ${y2}`} fill="none" stroke="#2d9a2d" strokeWidth="2.6" strokeLinecap="round" />
            <polygon points={head} fill="#2d9a2d" />
          </g>
        )
      })}
    </g>
  )
}

const art: Record<IconName, ReactElement> = {
  user: (
    <>
      <defs>
        <linearGradient id="ic-user-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fc2fa" />
          <stop offset="1" stopColor="#2a6bd6" />
        </linearGradient>
        <linearGradient id="ic-user-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbe3c4" />
          <stop offset="1" stopColor="#e9b985" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="42" height="42" rx="5" fill="#fff" stroke="#9fb0cf" />
      <rect x="6" y="6" width="36" height="36" rx="3" fill="url(#ic-user-bg)" />
      <path d="M9 42c0-11 7-14 15-14s15 3 15 14z" fill="#f4f7fc" />
      <path d="M20 28.5c1 2 7 2 8 0l1.5 3.5c-3 2-8 2-11 0z" fill="#d8e3f5" />
      <circle cx="24" cy="19" r="7.5" fill="url(#ic-user-skin)" stroke="#b98a56" strokeWidth=".8" />
      <path d="M16.5 18c0-6 4-8 8-8s7.5 2 7.5 7.5c-2-3-5-4-8-4s-5 1-7.5 4.5z" fill="#6b4423" />
    </>
  ),
  folder: (
    <>
      <defs>
        <linearGradient id="ic-folder-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6c35a" />
          <stop offset="1" stopColor="#c4951c" />
        </linearGradient>
        <linearGradient id="ic-folder-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0a0" />
          <stop offset="1" stopColor="#f0b938" />
        </linearGradient>
      </defs>
      <path d="M4 12a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="url(#ic-folder-back)" stroke="#9a7211" />
      <path d="M4 19a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="url(#ic-folder-front)" stroke="#b58516" />
      <path d="M6 20.5h36" stroke="#fffbe0" strokeWidth="1.2" opacity=".8" />
    </>
  ),
  photos: (
    <>
      <defs>
        <linearGradient id="ic-photos-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f9bf0" />
          <stop offset="1" stopColor="#bfe0ff" />
        </linearGradient>
        <linearGradient id="ic-photos-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc24a" />
          <stop offset="1" stopColor="#3f8f22" />
        </linearGradient>
      </defs>
      <g transform="rotate(-9 24 24)">
        <rect x="7" y="8" width="30" height="26" rx="2" fill="#fff" stroke="#9aa7bd" />
        <rect x="10" y="11" width="24" height="16" fill="#8fb7ee" />
      </g>
      <rect x="10" y="11" width="31" height="29" rx="2" fill="#fff" stroke="#7d8aa3" />
      <rect x="13" y="14" width="25" height="19" fill="url(#ic-photos-sky)" />
      <circle cx="32" cy="19.5" r="3" fill="#ffd84a" />
      <path d="M13 33V28L21 21L27 27L31 24L38 30V33Z" fill="url(#ic-photos-hill)" />
    </>
  ),
  film: (
    <>
      <rect x="6" y="20" width="36" height="22" rx="2" fill="#2b323d" stroke="#11151b" />
      <path d="M10 28h12M10 33h18M10 38h8" stroke="#8c97a8" strokeWidth="1.4" strokeLinecap="round" />
      <polygon points={starPoints(35, 34, 5.5, 2.4)} fill="#ffcc33" stroke="#c99200" strokeWidth=".5" />
      <g transform="rotate(-14 6 20)">
        <rect x="6" y="12" width="36" height="8" rx="1.5" fill="#fff" stroke="#11151b" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M${8 + i * 7.4} 12l4.6 0-3 8-4.6 0z`} fill="#11151b" />
        ))}
      </g>
    </>
  ),
  gamepad: (
    <>
      <defs>
        <linearGradient id="ic-pad-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9aa3b8" />
          <stop offset="1" stopColor="#555e75" />
        </linearGradient>
      </defs>
      <path
        d="M13 14H35C40 14 43 17 44 23L46 33C47 38 43 40 39 37L34 33H14L9 37C5 40 1 38 2 33L4 23C5 17 8 14 13 14Z"
        fill="url(#ic-pad-body)"
        stroke="#2f3646"
        strokeLinejoin="round"
      />
      <path d="M11 15.5H37" stroke="#cdd4e2" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
      <path d="M12.5 20.5h3v2.8h2.8v3h-2.8v2.8h-3v-2.8H9.7v-3h2.8z" fill="#222833" />
      <circle cx="35.5" cy="20.4" r="2.1" fill="#ffd24a" stroke="#8a6a00" strokeWidth=".5" />
      <circle cx="39.2" cy="24.4" r="2.1" fill="#e0453a" stroke="#7d1810" strokeWidth=".5" />
      <circle cx="35.5" cy="28.4" r="2.1" fill="#3b86f2" stroke="#173f86" strokeWidth=".5" />
      <circle cx="31.8" cy="24.4" r="2.1" fill="#4ac85a" stroke="#1b6a28" strokeWidth=".5" />
      <circle cx="19.5" cy="30" r="2.4" fill="#2a3040" />
      <circle cx="28.5" cy="30" r="2.4" fill="#2a3040" />
    </>
  ),
  recycle: (
    <>
      <defs>
        <linearGradient id="ic-bin-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f2f7fd" />
          <stop offset=".55" stopColor="#c8d7ea" />
          <stop offset="1" stopColor="#97aecb" />
        </linearGradient>
      </defs>
      <rect x="19" y="4.5" width="10" height="5" rx="2" fill="none" stroke="#6f86a8" strokeWidth="1.8" />
      <path d="M11 14h26l-3 28H14z" fill="url(#ic-bin-body)" stroke="#6f86a8" strokeLinejoin="round" />
      <rect x="8.5" y="9" width="31" height="6" rx="2.5" fill="#dbe6f4" stroke="#6f86a8" />
      <path d="M17 18l1 20M24 18v20M31 18l-1 20" stroke="#a7bad4" strokeWidth="1.2" />
      <RecycleArrows />
    </>
  ),
  tgos: <LogoArt />,
}

/** Icons not drawn in the default 48x48 box. */
const viewBoxes: Partial<Record<IconName, string>> = {
  tgos: '0 0 96 96',
}

/** An app's icon: one of the shared icons by name, or its own art (drawn in a 48x48 box unless it says otherwise). */
export function AppIcon({ icon, size = 32, className }: { icon: IconName | IconArt; size?: number; className?: string }) {
  if (typeof icon === 'string') return <Icon name={icon} size={size} className={className} />
  return (
    <svg className={className} width={size} height={size} viewBox={icon.viewBox ?? '0 0 48 48'} aria-hidden="true" focusable="false">
      {icon.art}
    </svg>
  )
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

/** Original XP-flavoured icon set, drawn as SVG so it scales cleanly and carries no borrowed artwork. */
export function Icon({ name, size = 32, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={viewBoxes[name] ?? '0 0 48 48'}
      aria-hidden="true"
      focusable="false"
    >
      {art[name]}
    </svg>
  )
}
