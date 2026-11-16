import { useMemo, type CSSProperties } from 'react'
import { lerp, seeded } from './geometry'

export type ParticleKind = 'snow' | 'rain' | 'petal' | 'leaf' | 'mote'

export interface ParticleSpec {
  kind: ParticleKind
  count: number
  colors?: string[]
  /** Size in px (rain: the streak's length). */
  size: [number, number]
  /** Seconds for one trip across the screen. Longer is calmer. */
  seconds: [number, number]
  /** Sideways travel during one trip, in % of the screen width (negative drifts left). */
  drift: [number, number]
  /** Side-to-side sway in px. */
  sway?: number
  opacity?: number
  seed?: number
}

const SHAPES: Partial<Record<ParticleKind, string>> = {
  petal: 'M12 2C16 5 19 11 17 16C15.5 20 13 22 12 22C11 22 8.5 20 7 16C5 11 8 5 12 2Z',
  leaf: 'M12 1C14 5 20 7 21 12C21.5 16 17 17.5 13 17V23H11V17C7 17.5 2.5 16 3 12C4 7 10 5 12 1Z',
}

/** These float up from the bottom; everything else falls from the top. */
const RISING = new Set<ParticleKind>(['mote'])

const vars = (v: Record<string, string | number>) => v as CSSProperties

/**
 * Drifting bits of weather: snow, petals, leaves... Each is a tiny element moved by the compositor
 * (transform only), so a screenful of them costs almost nothing. They start mid-fall (negative delays)
 * so the screen is never empty on load.
 */
export function Particles({ spec }: { spec: ParticleSpec }) {
  const items = useMemo(() => {
    const r = seeded(spec.seed ?? 11)
    const colors = spec.colors ?? ['#fff']
    const sway = spec.sway ?? 12
    return Array.from({ length: spec.count }, () => {
      const dur = lerp(spec.seconds, r())
      return {
        left: r() * 100,
        size: lerp(spec.size, r()),
        dur,
        delay: -r() * dur,
        drift: lerp(spec.drift, r()),
        sway: sway * (0.5 + r()),
        swayDur: 3 + r() * 3,
        spin: 20 + r() * 40,
        color: colors[Math.floor(r() * colors.length)],
      }
    })
  }, [spec])

  const path = SHAPES[spec.kind]

  return (
    <div className="particles">
      {items.map((p, i) => (
        <span
          key={i}
          className={`particle particle-${spec.kind}${RISING.has(spec.kind) ? ' rise' : ''}`}
          style={vars({
            left: `${p.left}%`,
            opacity: spec.opacity ?? 1,
            '--size': `${p.size}px`,
            '--dur': `${p.dur}s`,
            '--delay': `${p.delay}s`,
            '--drift': `${p.drift}cqw`,
            '--sway': `${p.sway}px`,
            '--sway-dur': `${p.swayDur}s`,
            '--spin': `${p.spin}deg`,
            '--color': p.color,
          })}
        >
          <i>
            {path && (
              <svg viewBox="0 0 24 24">
                <path d={path} fill="currentColor" />
              </svg>
            )}
          </i>
        </span>
      ))}
    </div>
  )
}
