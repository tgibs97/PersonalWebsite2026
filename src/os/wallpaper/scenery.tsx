import type { CSSProperties } from 'react'
import { seeded } from './geometry'

/**
 * Scenery drawn in the wallpaper's 1600x1000 box. Sky pieces (stars, sun, moon, rainbow, fireworks) go in a
 * theme's `back` layer, behind the clouds; land pieces (trees, pumpkins) go in `land`, on the hill.
 * Animated parts are small and only change opacity or transform, with the motion defined in wallpaper.css.
 */

const vars = (v: Record<string, string | number>) => v as CSSProperties

/* ------------------------------------------------------------------------------------------------ */
/* Sky                                                                                              */
/* ------------------------------------------------------------------------------------------------ */

export function Stars({ count = 48, seed = 5, maxY = 430, color = '#fff' }: { count?: number; seed?: number; maxY?: number; color?: string }) {
  const r = seeded(seed)
  const stars = Array.from({ length: count }, () => ({
    x: r() * 1600,
    y: 24 + r() * maxY,
    r: 0.8 + r() * 1.5,
    dur: 3 + r() * 4,
    delay: -r() * 6,
  }))
  return (
    <g fill={color}>
      {stars.map((s, i) => (
        <circle
          key={i}
          className="twinkle"
          cx={s.x}
          cy={s.y}
          r={s.r}
          style={vars({ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` })}
        />
      ))}
    </g>
  )
}

interface SunProps {
  x: number
  y: number
  r: number
  core?: string
  glow?: string
  rays?: boolean
}

/** A soft sun: a pulsing glow, and (optionally) rays that turn very slowly. */
export function Sun({ x, y, r, core = '#fffbe0', glow = '#fff2a8', rays = true }: SunProps) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <radialGradient id="fx-sun-glow">
          <stop offset="0" stopColor={glow} stopOpacity=".9" />
          <stop offset=".3" stopColor={glow} stopOpacity=".38" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="glow-pulse" r={r * 5} fill="url(#fx-sun-glow)" />
      {rays && (
        <g className="sun-rays" fill={core} opacity=".45">
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} transform={`rotate(${(i * 360) / 14})`} d={`M${-r * 0.22} ${-r * 1.5}L0 ${-r * 3.4}L${r * 0.22} ${-r * 1.5}Z`} />
          ))}
        </g>
      )}
      <circle r={r} fill={core} />
    </g>
  )
}

interface MoonProps {
  x: number
  y: number
  r: number
  crescent?: boolean
  color?: string
  glow?: string
}

export function Moon({ x, y, r, crescent = false, color = '#fff6d8', glow = '#fff0b8' }: MoonProps) {
  const box = r * 3.2
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <radialGradient id="fx-moon-glow">
          <stop offset="0" stopColor={glow} stopOpacity=".55" />
          <stop offset=".45" stopColor={glow} stopOpacity=".18" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <mask id="fx-moon-mask" maskUnits="userSpaceOnUse" x={-box / 2} y={-box / 2} width={box} height={box}>
          <rect x={-box / 2} y={-box / 2} width={box} height={box} fill="#fff" />
          <circle cx={r * 0.5} cy={-r * 0.12} r={r * 0.9} fill="#000" />
        </mask>
      </defs>
      <circle className="glow-pulse" r={r * 3.4} fill="url(#fx-moon-glow)" />
      <g mask={crescent ? 'url(#fx-moon-mask)' : undefined}>
        <circle r={r} fill={color} />
        {!crescent && (
          <g fill="#e6d49c" opacity=".5">
            <circle cx={-r * 0.3} cy={-r * 0.25} r={r * 0.2} />
            <circle cx={r * 0.35} cy={r * 0.2} r={r * 0.28} />
            <circle cx={-r * 0.1} cy={r * 0.5} r={r * 0.14} />
            <circle cx={r * 0.1} cy={-r * 0.55} r={r * 0.1} />
          </g>
        )}
      </g>
    </g>
  )
}

const RAINBOW = ['#ee4b3e', '#f6913d', '#f4d94a', '#6cc858', '#43a4ee', '#5b5fdc', '#9a55c9']

/** A soft rainbow that fades in and out over about a minute. Its ends tuck behind the hill. */
export function Rainbow({ cx = 880, cy = 930, r = 560, width = 12 }: { cx?: number; cy?: number; r?: number; width?: number }) {
  return (
    <g className="rainbow" filter="url(#wp-blur-soft)">
      {RAINBOW.map((color, i) => {
        const rr = r - i * width
        return (
          <path
            key={color}
            d={`M${cx - rr} ${cy}A${rr} ${rr} 0 0 1 ${cx + rr} ${cy}`}
            fill="none"
            stroke={color}
            strokeWidth={width + 1}
          />
        )
      })}
    </g>
  )
}

const AURORA: Array<{ d: string; top: string; mid: string; opacity: number; seconds: number; delay: number }> = [
  { d: 'M-100 250C150 120 380 330 650 210S1150 110 1700 240V340C1300 240 1000 340 650 310S200 270 -100 370Z', top: '#52ffb4', mid: '#2fd6c4', opacity: 0.55, seconds: 26, delay: 0 },
  { d: 'M-100 300C200 200 460 380 760 270S1240 190 1700 300V390C1300 310 1040 400 760 370S260 340 -100 420Z', top: '#8a6bff', mid: '#4fa8ff', opacity: 0.42, seconds: 32, delay: -9 },
  { d: 'M-100 200C220 90 520 260 820 160S1300 80 1700 190V270C1350 190 1080 280 820 250S300 210 -100 300Z', top: '#9dffc4', mid: '#43e0a0', opacity: 0.35, seconds: 38, delay: -17 },
]

/**
 * Northern lights: three soft curtains of light that sway, stretch and brighten very slowly. Each has its
 * own period, so the sky never repeats in an obvious loop.
 */
export function Aurora() {
  return (
    <g>
      <defs>
        {AURORA.map((a, i) => (
          <linearGradient key={i} id={`fx-aurora-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={a.top} stopOpacity="0" />
            <stop offset=".35" stopColor={a.top} stopOpacity="1" />
            <stop offset=".7" stopColor={a.mid} stopOpacity=".7" />
            <stop offset="1" stopColor={a.mid} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      <g filter="url(#wp-blur-wide)">
        {AURORA.map((a, i) => (
          <path
            key={i}
            className="aurora-curtain"
            d={a.d}
            fill={`url(#fx-aurora-${i})`}
            style={vars({ '--base': a.opacity, animationDuration: `${a.seconds}s`, animationDelay: `${a.delay}s` })}
          />
        ))}
      </g>
    </g>
  )
}

export interface BurstProps {
  /** Unique per burst (it names the glow gradient). */
  id: number | string
  x: number
  y: number
  /** Two or three colours; rays and dots take them in turn. */
  colors: string[]
  size?: number
  /** `peony`: rays; `ring`: concentric rings of sparks; `double`: a big burst around a smaller, turned one. */
  kind?: 'peony' | 'ring' | 'double'
  /** Seconds into the cycle at which this burst first fires. */
  delay?: number
  /** Length of the whole cycle; the burst itself lasts about a sixth of it. Vary it so bursts drift apart. */
  seconds?: number
}

const SPARKS = (count: number, radius: number, dot: number, color: string) =>
  Array.from({ length: count }, (_, i) => (
    <circle key={i} transform={`rotate(${(i * 360) / count})`} cy={-radius} r={dot} fill={color} />
  ))

/**
 * One firework: it expands and fades, then rests for the rest of its cycle. Bursts in one sky each get a
 * different delay and cycle length, so several can go off together and the pattern keeps shifting.
 */
export function Burst({ id, x, y, colors, size = 70, kind = 'peony', delay = 0, seconds = 14 }: BurstProps) {
  const color = (i: number) => colors[i % colors.length]
  const rays = (count: number, long: number, short: number, width: number, shift: number, offset: number) =>
    Array.from({ length: count }, (_, i) => (
      <g key={i} transform={`rotate(${shift + (i * 360) / count})`}>
        <line y1={-size * 0.26} y2={-size * (i % 2 ? short : long)} stroke={color(i + offset)} strokeWidth={width} strokeLinecap="round" />
        <circle cy={-size * ((i % 2 ? short : long) + 0.1)} r="3.2" fill={color(i + offset)} />
      </g>
    ))

  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <radialGradient id={`fx-burst-${id}`}>
          <stop offset="0" stopColor={color(0)} stopOpacity=".75" />
          <stop offset="1" stopColor={color(0)} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="burst" style={vars({ animationDuration: `${seconds}s`, animationDelay: `${delay}s` })}>
        <circle r={size * 1.5} fill={`url(#fx-burst-${id})`} />
        <circle r={size * 0.16} fill="#fff" opacity=".8" />
        {kind === 'peony' && (
          <>
            {rays(20, 1, 0.78, 3.4, 0, 0)}
            <g>{SPARKS(10, size * 0.5, 2.6, color(1))}</g>
          </>
        )}
        {kind === 'ring' && (
          <>
            {SPARKS(22, size * 0.98, 3.8, color(0))}
            {SPARKS(16, size * 0.66, 3.2, color(1))}
            {SPARKS(10, size * 0.34, 2.8, color(2))}
          </>
        )}
        {kind === 'double' && (
          <>
            {rays(16, 1, 0.84, 3.4, 0, 0)}
            <g transform="scale(.55)">{rays(12, 1, 0.8, 4.2, 15, 1)}</g>
          </>
        )}
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------------------------------------ */
/* Land: each piece stands with its base at (x, y)                                                  */
/* ------------------------------------------------------------------------------------------------ */

interface TreeProps {
  x: number
  y: number
  s?: number
}

const LIGHTS: Array<[number, number]> = [
  [-18, -22], [12, -28], [-32, -12], [26, -14], [-8, -50], [18, -56], [-22, -58], [2, -84], [-10, -100], [9, -108],
]

interface PineProps extends TreeProps {
  leaf?: string
  shade?: string
  snow?: boolean
  /** Colours for string lights. Give some and the tree blinks gently. */
  lights?: string[]
}

export function Pine({ x, y, s = 1, leaf = '#2f7a3a', shade = '#1f5a2a', snow = false, lights }: PineProps) {
  const tiers = ['M-44 -8L0 -66L44 -8Z', 'M-36 -44L0 -96L36 -44Z', 'M-26 -76L0 -128L26 -76Z']
  const halves = ['M0 -66L44 -8H0Z', 'M0 -96L36 -44H0Z', 'M0 -128L26 -76H0Z']
  const caps = ['M-20 -38L0 -66L20 -38Q0 -31 -20 -38Z', 'M-15 -70L0 -96L15 -70Q0 -63 -15 -70Z', 'M-11 -100L0 -128L11 -100Q0 -94 -11 -100Z']
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-5" y="-12" width="10" height="18" rx="2" fill="#5a3d24" />
      {tiers.map((d, i) => (
        <g key={i}>
          <path d={d} fill={leaf} />
          <path d={halves[i]} fill={shade} opacity=".55" />
          {snow && <path d={caps[i]} fill="#fff" />}
        </g>
      ))}
      {lights && (
        <g>
          {LIGHTS.map(([lx, ly], i) => (
            <circle
              key={i}
              className="tree-light"
              cx={lx}
              cy={ly}
              r="3.2"
              fill={lights[i % lights.length]}
              style={vars({ animationDelay: `${-(i * 0.37) % 3}s` })}
            />
          ))}
          <path className="tree-light" d="M0 -140L3.4 -131L13 -131L5.3 -125L8.2 -116L0 -121.5L-8.2 -116L-5.3 -125L-13 -131L-3.4 -131Z" fill="#ffe27a" />
        </g>
      )}
    </g>
  )
}

const TRUNK = 'M-7 0C-7 -26 -10 -44 -16 -66L-6 -70C-2 -52 0 -42 0 -34C2 -46 8 -58 18 -72L28 -66C16 -50 10 -30 8 0Z'
const CANOPY: Array<[number, number, number]> = [[-34, -88, 30], [0, -108, 38], [34, -90, 30], [-14, -68, 25], [20, -66, 26]]

interface DeciduousProps extends TreeProps {
  base: string
  light: string
  dark: string
}

function Deciduous({ x, y, s = 1, base, light, dark }: DeciduousProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={TRUNK} fill="#5d3b27" />
      {CANOPY.map(([cx, cy, r], i) => (
        <g key={i}>
          <circle cx={cx + 3} cy={cy + 4} r={r} fill={dark} />
          <circle cx={cx} cy={cy} r={r} fill={base} />
          <circle cx={cx - r * 0.28} cy={cy - r * 0.3} r={r * 0.5} fill={light} opacity=".85" />
        </g>
      ))}
    </g>
  )
}

export const BlossomTree = (p: TreeProps) => <Deciduous {...p} base="#f2a6c4" light="#fbd6e4" dark="#df7ea5" />
export const AutumnTree = (p: TreeProps & { tone?: 'orange' | 'red' | 'gold' }) => {
  const tones = {
    orange: { base: '#e8873a', light: '#f7b66a', dark: '#c0601f' },
    red: { base: '#cf4a30', light: '#ef8a62', dark: '#9e2f1c' },
    gold: { base: '#e8b83a', light: '#f8de7a', dark: '#c08e1c' },
  }
  return <Deciduous x={p.x} y={p.y} s={p.s} {...tones[p.tone ?? 'orange']} />
}

export function BareTree({ x, y, s = 1, color = '#3a2a1c' }: TreeProps & { color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={color} strokeLinecap="round">
      <path d="M0 4C0 -36 -2 -70 -4 -104" strokeWidth="9" />
      <path d="M-3 -62C-18 -76 -30 -86 -46 -108" strokeWidth="5" />
      <path d="M-2 -78C10 -94 22 -102 36 -126" strokeWidth="5" />
      <path d="M-4 -102C-8 -120 -6 -134 -12 -154" strokeWidth="4" />
      <path d="M-30 -86C-40 -88 -50 -86 -60 -92M-38 -96C-38 -110 -42 -118 -40 -128" strokeWidth="2.6" />
      <path d="M22 -102C34 -104 44 -100 54 -106M30 -114C36 -124 42 -128 46 -140" strokeWidth="2.6" />
      <path d="M-8 -126C2 -130 10 -128 16 -136" strokeWidth="2.4" />
    </g>
  )
}

/** A round hay bale, seen end-on, with its spiral of rolled hay. */
export function HayBale({ x, y, s = 1 }: TreeProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="2" cy="1" rx="20" ry="3.6" fill="#4a2a10" opacity=".35" />
      <circle cx="0" cy="-16" r="16" fill="#e4aa3e" stroke="#8f5a18" strokeWidth="1.6" />
      <g fill="none" stroke="#9a6418" strokeWidth="1.2" opacity=".9">
        <circle cx="0" cy="-16" r="11.5" />
        <circle cx="0" cy="-16" r="7" />
        <circle cx="0" cy="-16" r="2.8" />
      </g>
      <path d="M-11 -25Q0 -31 11 -25" stroke="#fbe08a" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".75" />
    </g>
  )
}

const FLAG_W = 64
const FLAG_H = 34
const FLAG_SLICES = 10

/** The thirteen stripes and starred canton of the U.S. flag, flat, in a 64x34 box. */
function FlagArt() {
  const stripe = FLAG_H / 13
  const cantonW = FLAG_W * 0.4
  const cantonH = stripe * 7
  const stars: Array<[number, number]> = []
  for (let row = 0; row < 9; row++) {
    const even = row % 2 === 0
    for (let col = 0; col < (even ? 6 : 5); col++) {
      stars.push([((even ? col + 0.5 : col + 1) * cantonW) / 6, ((row + 0.5) * cantonH) / 9])
    }
  }
  return (
    <g id="fx-flag">
      <rect width={FLAG_W} height={FLAG_H} fill="#fff" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={i * 2 * stripe} width={FLAG_W} height={stripe} fill="#b22234" />
      ))}
      <rect width={cantonW} height={cantonH} fill="#3c3b6e" />
      <g fill="#fff">
        {stars.map(([sx, sy], i) => (
          <circle key={i} cx={sx} cy={sy} r="0.75" />
        ))}
      </g>
    </g>
  )
}

/**
 * An American flag on a pole planted in the hill. The cloth is a row of thin vertical slices that each bob
 * a little later, and a little further, than the one nearer the pole, which reads as a gentle ripple.
 */
export function Flag({ x, y, s = 1 }: TreeProps) {
  const poleHeight = 150
  const sliceWidth = FLAG_W / FLAG_SLICES
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <defs>
        <FlagArt />
        {Array.from({ length: FLAG_SLICES }, (_, i) => (
          <clipPath key={i} id={`fx-flag-clip-${i}`}>
            <rect x={i * sliceWidth - 0.2} y={-8} width={sliceWidth + 0.4} height={FLAG_H + 16} />
          </clipPath>
        ))}
      </defs>
      <ellipse cx="0" cy="2" rx="28" ry="5" fill="#fff3b0" opacity=".14" />
      <ellipse cx="0" cy="1" rx="7" ry="2.4" fill="#0e1c10" opacity=".55" />
      <rect x="-1.3" y={-poleHeight} width="2.6" height={poleHeight} fill="#cdd5e2" />
      <rect x="-1.3" y={-poleHeight} width="0.9" height={poleHeight} fill="#fff" opacity=".55" />
      <circle cx="0" cy={-poleHeight - 2} r="2.8" fill="#ffd24a" />
      <g transform={`translate(1.3 ${-poleHeight + 3})`}>
        {Array.from({ length: FLAG_SLICES }, (_, i) => (
          <g key={i} clipPath={`url(#fx-flag-clip-${i})`}>
            <g className="flag-slice" style={vars({ '--amp': `${0.25 + i * 0.2}px`, animationDelay: `${-i * 0.3}s` })}>
              <use href="#fx-flag" />
            </g>
          </g>
        ))}
      </g>
    </g>
  )
}

const TAIL_FEATHERS: Array<[number, string]> = [
  [-64, '#7d3419'], [-43, '#b84f1c'], [-21, '#e08a2a'], [0, '#f0bd45'], [21, '#e08a2a'], [43, '#b84f1c'], [64, '#7d3419'],
]

/**
 * A turkey in profile, facing right, with a fanned tail. The tail sways a hair and the head pecks at the
 * grass every few seconds (both defined in wallpaper.css).
 */
export function Turkey({ x, y, s = 1 }: TreeProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="turkey-tail">
        {TAIL_FEATHERS.map(([angle, color], i) => (
          <g key={i} transform={`rotate(${angle - 8} -12 -30)`}>
            <ellipse cx="-12" cy="-58" rx="8.5" ry="29" fill={color} />
            <ellipse cx="-12" cy="-80" rx="5" ry="6" fill="#f6e3b4" />
          </g>
        ))}
      </g>
      <g stroke="#d98b2f" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M-7 -14V-1M-7 -1L-13 1M-7 -1L-1 1M-7 -1V2" />
        <path d="M7 -14V-1M7 -1L1 1M7 -1L13 1M7 -1V2" />
      </g>
      <ellipse cx="0" cy="-30" rx="23" ry="17" fill="#7a4a2a" />
      <ellipse cx="9" cy="-28" rx="13" ry="12" fill="#9a6238" />
      <path d="M-14 -34C-4 -44 12 -40 16 -28C8 -24 -6 -22 -14 -34Z" fill="#5a3320" />
      <path d="M-6 -34L8 -30M-4 -29L10 -27" stroke="#3e2314" strokeWidth="1.2" strokeLinecap="round" />
      <g className="turkey-head">
        <path d="M12 -36C20 -44 22 -54 25 -62" stroke="#8d5a3a" strokeWidth="8" strokeLinecap="round" fill="none" />
        <circle cx="27" cy="-66" r="6.5" fill="#c9907a" />
        <path d="M32 -67L41 -64.5L32 -62.5Z" fill="#f2a53a" />
        <path d="M30 -61C34 -60 34 -52 30 -52C26 -52 26 -59 30 -61Z" fill="#d63a2f" />
        <path d="M31 -72C33 -74.5 35.5 -72 34 -69.5Z" fill="#d63a2f" />
        <circle cx="29.5" cy="-67.5" r="1.3" fill="#1b0f08" />
      </g>
    </g>
  )
}

/** A pumpkin with a carved face whose candle flickers. */
export function Pumpkin({ x, y, s = 1 }: TreeProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <defs>
        <radialGradient id="fx-pumpkin-glow">
          <stop offset="0" stopColor="#ffd45a" stopOpacity=".7" />
          <stop offset="1" stopColor="#ffd45a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fx-pumpkin-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7a23a" />
          <stop offset="1" stopColor="#d96f17" />
        </linearGradient>
      </defs>
      <ellipse className="pumpkin-glow" cx="0" cy="-22" rx="52" ry="40" fill="url(#fx-pumpkin-glow)" />
      <g fill="url(#fx-pumpkin-body)" stroke="#b85a12" strokeWidth="1.4">
        <ellipse cx="-14" cy="-22" rx="17" ry="22" />
        <ellipse cx="14" cy="-22" rx="17" ry="22" />
        <ellipse cx="0" cy="-23" rx="17" ry="24" />
      </g>
      <path d="M-3 -44C-3 -52 0 -54 5 -57L8 -52C4 -51 3 -49 3 -44Z" fill="#4a5a1f" />
      <g className="pumpkin-face" fill="#ffd45a">
        <path d="M-12 -28L-4 -28L-8 -35Z" />
        <path d="M4 -28L12 -28L8 -35Z" />
        <path d="M-12 -16L-8 -12L-4 -16L0 -12L4 -16L8 -12L12 -16L10 -8H-10Z" />
      </g>
    </g>
  )
}
