import type { CSSProperties } from 'react'
import { lerp, seeded } from './geometry'

/**
 * Things that travel across the screen: balloons, geese, bats, butterflies, fireflies, fog. They are
 * positioned as a % of the screen (not the artwork), so they work at any window shape, and they only
 * ever change transform or opacity. The motion itself lives in wallpaper.css.
 */

const vars = (v: Record<string, string | number>) => v as CSSProperties

/* ---------- Hot-air balloons ---------- */

const BALLOONS = [
  { top: 13, seconds: 220, delay: -40, size: 1, colors: ['#e94b3c', '#f6d24a'] },
  { top: 26, seconds: 300, delay: -170, size: 0.78, colors: ['#2a9d8f', '#f4f1de'] },
  { top: 8, seconds: 360, delay: -290, size: 0.66, colors: ['#7b4fd0', '#ffd166'] },
]

export function Balloons() {
  return (
    <>
      {BALLOONS.map((b, i) => (
        <div
          key={i}
          className="mover balloon"
          style={vars({ top: `${b.top}%`, '--dur': `${b.seconds}s`, '--delay': `${b.delay}s`, '--scale': b.size })}
        >
          <div className="bob" style={vars({ '--bob-delay': `${-i * 2.3}s` })}>
            <svg viewBox="0 0 60 84">
              <defs>
                <clipPath id={`fx-balloon-${i}`}>
                  <path d="M30 2C12 2 4 16 6 28C8 40 20 52 24 58H36C40 52 52 40 54 28C56 16 48 2 30 2Z" />
                </clipPath>
              </defs>
              <g clipPath={`url(#fx-balloon-${i})`}>
                {Array.from({ length: 6 }, (_, k) => (
                  <rect key={k} x={k * 10} y="0" width="10" height="62" fill={b.colors[k % 2]} />
                ))}
                <ellipse cx="22" cy="20" rx="8" ry="14" fill="#fff" opacity=".22" />
                <path d="M30 2C12 2 4 16 6 28C8 40 20 52 24 58H36C40 52 52 40 54 28C56 16 48 2 30 2Z" fill="#000" opacity=".1" transform="translate(5 0)" />
              </g>
              <path d="M24 58L26.5 67M36 58L33.5 67" stroke="#5a3d24" strokeWidth="1" />
              <rect x="25" y="67" width="10" height="7" rx="1.2" fill="#8a5a2a" />
            </svg>
          </div>
        </div>
      ))}
    </>
  )
}

/* ---------- Geese ---------- */

const V: Array<[number, number]> = [[100, 10], [78, 26], [122, 26], [56, 42], [144, 42], [34, 58], [166, 58]]

/** One V of geese crossing the sky now and then, wings beating slowly. */
export function Geese() {
  return (
    <div className="mover mover-sparse geese" style={vars({ top: '17%', '--dur': '170s', '--delay': '-20s' })}>
      <svg viewBox="0 0 200 80">
        {V.map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path
              className="flap"
              d="M-9 -3Q-4.5 -8 0 0Q4.5 -8 9 -3"
              fill="none"
              stroke="#2a3550"
              strokeWidth="2.2"
              strokeLinecap="round"
              style={vars({ animationDelay: `${-i * 0.18}s` })}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}

/* ---------- Santa ---------- */

function Reindeer({ x, y, redNose = false }: { x: number; y: number; redNose?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g stroke="#7d4f2b" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M8 4L18 12M5 5L14 14" />
        <path d="M-9 4L-19 10M-6 5L-14 13" />
        <path d="M-14 -3L-20 -6" />
      </g>
      <ellipse cx="0" cy="0" rx="14" ry="7.5" fill="#9a6238" />
      <ellipse cx="0" cy="3.5" rx="10" ry="3" fill="#c08a5a" opacity=".6" />
      <path d="M9 -3C13 -8 15 -11 17 -13" stroke="#9a6238" strokeWidth="6" strokeLinecap="round" fill="none" />
      <ellipse cx="21" cy="-14" rx="6.5" ry="4.2" transform="rotate(24 21 -14)" fill="#9a6238" />
      <path d="M19 -18L17 -27M17 -23L13 -26M17 -27L21 -31" stroke="#5a3a20" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      {redNose ? (
        <>
          <circle className="twinkle" cx="26.5" cy="-11.5" r="5.5" fill="#ff4040" opacity=".35" style={vars({ animationDuration: '2.2s' })} />
          <circle cx="26.5" cy="-11.5" r="2.2" fill="#ff3b3b" />
        </>
      ) : (
        <circle cx="26.5" cy="-11.5" r="2" fill="#3a2a20" />
      )}
      <circle cx="22.5" cy="-15.5" r="1" fill="#1b0f08" />
    </g>
  )
}

const TRAIL: Array<[number, number, number]> = [[8, 52, 2.2], [22, 46, 1.6], [34, 56, 2.6], [48, 48, 1.8], [58, 58, 1.4]]

/** Santa's sleigh and two reindeer, drifting across the night sky now and then with a gentle up-and-down arc. */
export function Santa() {
  return (
    <div className="mover mover-sparse santa" style={vars({ top: '13%', '--dur': '140s', '--delay': '-18s' })}>
      <div className="fly">
        <svg viewBox="0 0 300 90">
          <g fill="#fff6c0">
            {TRAIL.map(([x, y, r], i) => (
              <circle key={i} className="twinkle" cx={x} cy={y} r={r} style={vars({ animationDelay: `${-i * 0.6}s`, animationDuration: '2.4s' })} />
            ))}
          </g>
          <path d="M118 32C150 38 170 42 188 47M188 47C206 45 222 43 239 43" stroke="#c9a36a" strokeWidth="1" fill="none" />
          <g transform="translate(70 44)">
            <path d="M-4 14H42C50 14 52 8 48 3" stroke="#ffd24a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M6 14V8M30 14V8" stroke="#ffd24a" strokeWidth="1.6" />
            <path d="M0 -2H44C44 6 36 10 22 10C10 10 2 6 0 -2Z" fill="#d8362f" />
            <path d="M44 -2C52 -4 54 -12 48 -16" stroke="#d8362f" strokeWidth="3" fill="none" strokeLinecap="round" />
            <ellipse cx="9" cy="-8" rx="9" ry="8" fill="#a06b3a" />
            <ellipse cx="27" cy="-8" rx="8" ry="9" fill="#d8362f" />
            <path d="M33 -8L48 -12" stroke="#d8362f" strokeWidth="3" strokeLinecap="round" />
            <circle cx="27" cy="-21" r="5.5" fill="#f4cfae" />
            <ellipse cx="27" cy="-17.5" rx="5" ry="4" fill="#fff" />
            <path d="M21 -23Q24 -37 36 -30Q32 -30 33 -24Z" fill="#d8362f" />
            <rect x="21" y="-25" width="12" height="3" rx="1.5" fill="#fff" />
            <circle cx="36" cy="-30" r="2.4" fill="#fff" />
          </g>
          <Reindeer x={178} y={50} />
          <Reindeer x={230} y={46} redNose />
        </svg>
      </div>
    </div>
  )
}

/* ---------- Bats ---------- */

const BATS = [
  { top: 12, delay: -6, scale: 1 },
  { top: 21, delay: -15, scale: 0.8 },
  { top: 16, delay: -26, scale: 0.9 },
]

export function Bats() {
  return (
    <>
      {BATS.map((b, i) => (
        <div
          key={i}
          className="mover mover-sparse bat"
          style={vars({ top: `${b.top}%`, '--dur': '70s', '--delay': `${b.delay}s`, '--scale': b.scale })}
        >
          <svg viewBox="0 0 40 20">
            <path
              className="flap-fast"
              d="M20 10C14 2 6 4 0 10C6 8 10 10 12 14C14 12 17 12 20 15C23 12 26 12 28 14C30 10 34 8 40 10C34 4 26 2 20 10Z"
              fill="#150a28"
            />
          </svg>
        </div>
      ))}
    </>
  )
}

/* ---------- Butterflies ---------- */

const BUTTERFLIES = [
  { left: 18, top: 66, seconds: 46, delay: -5, path: 'a', wing: '#ffd23f', accent: '#ff8c1a' },
  { left: 52, top: 74, seconds: 58, delay: -22, path: 'b', wing: '#ffffff', accent: '#b8d8ff' },
  { left: 72, top: 64, seconds: 52, delay: -30, path: 'c', wing: '#6bb8ff', accent: '#3a6fe0' },
  { left: 34, top: 82, seconds: 64, delay: -12, path: 'a', wing: '#ff8fc0', accent: '#e0508c' },
  { left: 86, top: 78, seconds: 50, delay: -40, path: 'b', wing: '#ffb84a', accent: '#e06a1a' },
]

export function Butterflies() {
  return (
    <>
      {BUTTERFLIES.map((b, i) => (
        <div
          key={i}
          className={`mover-wander butterfly wander-${b.path}`}
          style={vars({ left: `${b.left}%`, top: `${b.top}%`, '--dur': `${b.seconds}s`, '--delay': `${b.delay}s` })}
        >
          <svg viewBox="0 0 32 26">
            <g className="wings" style={vars({ animationDelay: `${-i * 0.2}s` })}>
              <path d="M16 12C10 2 1 2 2 10C3 15 10 16 16 13Z" fill={b.wing} />
              <path d="M16 13C11 15 6 22 10 24C14 25 16 18 16 13Z" fill={b.accent} />
              <path d="M16 12C22 2 31 2 30 10C29 15 22 16 16 13Z" fill={b.wing} />
              <path d="M16 13C21 15 26 22 22 24C18 25 16 18 16 13Z" fill={b.accent} />
            </g>
            <rect x="15.2" y="8" width="1.6" height="12" rx=".8" fill="#2a2a2a" />
            <path d="M15.6 8C14 4 12 3 11 2M16.4 8C18 4 20 3 21 2" stroke="#2a2a2a" strokeWidth=".7" fill="none" />
          </svg>
        </div>
      ))}
    </>
  )
}

/* ---------- Fireflies ---------- */

export function Fireflies({ count = 12, seed = 4 }: { count?: number; seed?: number }) {
  const r = seeded(seed)
  const flies = Array.from({ length: count }, () => ({
    left: lerp([4, 96], r()),
    top: lerp([60, 92], r()),
    blink: lerp([3, 6], r()),
    wander: lerp([7, 12], r()),
    wx: lerp([-3, 3], r()),
    wy: lerp([-3, 3], r()),
    delay: -r() * 8,
  }))
  return (
    <>
      {flies.map((f, i) => (
        <span
          key={i}
          className="firefly"
          style={vars({
            left: `${f.left}%`,
            top: `${f.top}%`,
            '--blink': `${f.blink}s`,
            '--wander': `${f.wander}s`,
            '--wx': `${f.wx}cqw`,
            '--wy': `${f.wy}cqh`,
            '--delay': `${f.delay}s`,
          })}
        />
      ))}
    </>
  )
}

/* ---------- Fog ---------- */

const FOG = [
  { bottom: 1, height: 24, seconds: 90, delay: -20, opacity: 0.85 },
  { bottom: 7, height: 22, seconds: 120, delay: -70, opacity: 0.6 },
  { bottom: 0, height: 14, seconds: 100, delay: -45, opacity: 0.7 },
]

/**
 * Banks of mist that sway slowly back and forth along the foot of the hill, below anything standing on it.
 * `tint` is the mist's colour as "r, g, b" (white by default; a warm tint makes golden haze) and `strength`
 * scales how thick it is.
 */
export function Fog({ tint = '255, 255, 255', strength = 1 }: { tint?: string; strength?: number }) {
  return (
    <>
      {FOG.map((f, i) => (
        <div
          key={i}
          className="fog"
          style={vars({
            bottom: `${f.bottom}%`,
            height: `${f.height}%`,
            opacity: f.opacity * strength,
            '--fog-rgb': tint,
            '--dur': `${f.seconds}s`,
            '--delay': `${f.delay}s`,
          })}
        />
      ))}
    </>
  )
}
