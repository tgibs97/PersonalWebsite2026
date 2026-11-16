import { useMemo, type ReactNode } from 'react'
import { FIELD_EDGE, FIELD_PATH, HILL_PATH, lerp, ridgeY, seeded } from './wallpaper/geometry'
import { useWallpaperMonth } from './wallpaper/month'
import { Particles } from './wallpaper/particles'
import { THEMES } from './wallpaper/themes'
import type { Speckle } from './wallpaper/types'

/** [x, y, scale] for each puffy cloud. Every cloud must sit fully inside x = 0..1600 so the drift tiles cleanly. */
const CLOUDS: Array<[number, number, number]> = [
  [150, 60, 1.2],
  [1380, 60, 1.5],
  [1180, 175, 0.8],
  [880, 340, 1.1],
  [1030, 300, 0.7],
  [1420, 330, 0.9],
  [300, 270, 0.55],
  [610, 410, 0.45],
  [1500, 440, 0.6],
]

/** Bigger clouds read as closer, so they drift faster than the small, distant ones. */
const NEAR_CLOUDS = CLOUDS.filter(([, , scale]) => scale >= 0.9)
const FAR_CLOUDS = CLOUDS.filter(([, , scale]) => scale < 0.9)

/** Seconds for a layer to travel one full screen width, left to right. High, thin wisps are slowest. */
const DRIFT_SECONDS = { wisps: 400, far: 240, near: 150 }

/** Overlapping ellipses [dx, dy, rx, ry] that read as one cumulus cloud once blurred. */
const PUFFS: Array<[number, number, number, number]> = [
  [0, 0, 95, 28],
  [-62, 8, 62, 22],
  [64, 7, 72, 24],
  [-18, -16, 56, 28],
  [34, -13, 46, 22],
]

interface CloudPaint {
  fill: string
  opacity: number
}

function Puffs({ clouds, paint }: { clouds: typeof CLOUDS; paint: CloudPaint }) {
  return (
    <g fill={paint.fill} filter="url(#wp-blur)" opacity={paint.opacity}>
      {clouds.map(([cx, cy, s]) => (
        <g key={`${cx}-${cy}`} transform={`translate(${cx} ${cy}) scale(${s})`}>
          {PUFFS.map(([dx, dy, rx, ry]) => (
            <ellipse key={`${dx}-${dy}`} cx={dx} cy={dy} rx={rx} ry={ry} />
          ))}
        </g>
      ))}
    </g>
  )
}

function Wisps({ paint }: { paint: CloudPaint }) {
  return (
    <g fill={paint.fill} filter="url(#wp-blur-wide)" opacity={paint.opacity * 0.58}>
      <ellipse cx="760" cy="150" rx="320" ry="14" transform="rotate(14 760 150)" />
      <ellipse cx="1080" cy="470" rx="230" ry="10" />
      <ellipse cx="420" cy="215" rx="150" ry="9" transform="rotate(-8 420 215)" />
    </g>
  )
}

/**
 * One drifting layer. The track is two identical tiles side by side, each exactly one screen wide, and it
 * slides right by one tile before restarting, so the loop is seamless. Because only this element moves,
 * the browser rasterises the (blurry) clouds once and animates them on the GPU.
 */
function CloudLayer({ seconds, children }: { seconds: number; children: ReactNode }) {
  return (
    <div className="cloud-track" style={{ animationDuration: `${seconds}s` }}>
      <svg className="cloud-tile" viewBox="0 0 1600 1000">{children}</svg>
      <svg className="cloud-tile" viewBox="0 0 1600 1000">{children}</svg>
    </div>
  )
}

/** Scatters a theme's dots over the hill, keeping every one below the ridge line. */
function scatter(spec: Speckle) {
  const r = seeded(spec.seed ?? 7)
  return Array.from({ length: spec.count }, () => {
    const x = r() * 1600
    const y = Math.max(lerp(spec.yRange, Math.pow(r(), 0.85)), ridgeY(x) + 12)
    return { x, y, r: lerp(spec.size, r()), color: spec.colors[Math.floor(r() * spec.colors.length)] }
  })
}

/**
 * A Bliss-style hillside drawn from scratch in SVG: original artwork, resolution independent, and cropped
 * with `slice` so it always fills the screen. Its look changes with the month (see wallpaper/themes.tsx).
 * Layers, back to front: sky, sky scenery, clouds (drifting), the hill and what stands on it, creatures and
 * mist, then falling weather.
 */
export function Wallpaper() {
  const month = useWallpaperMonth()
  const theme = THEMES[month - 1]
  const dots = useMemo(() => scatter(theme.speckle), [theme])
  const [sky0, sky1, sky2, sky3] = theme.sky
  const [hill0, hill1, hill2, hill3] = theme.hill

  return (
    // Keyed by month so picking a new theme rebuilds every layer, and all animations start fresh.
    <div className="wallpaper" key={theme.month} aria-hidden="true" data-theme={theme.name}>
      {/* Filters shared by the cloud tiles and scenery. Kept out of the tiles so ids aren't duplicated. */}
      <svg className="wallpaper-defs" width="0" height="0" focusable="false">
        <defs>
          <filter id="wp-blur" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id="wp-blur-wide" x="-30%" y="-200%" width="160%" height="500%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="wp-blur-soft" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
      </svg>

      <svg className="wallpaper-layer" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="wp-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky0} />
            <stop offset=".38" stopColor={sky1} />
            <stop offset=".6" stopColor={sky2} />
            <stop offset=".72" stopColor={sky3} />
          </linearGradient>
        </defs>
        <rect width="1600" height="1000" fill="url(#wp-sky)" />
      </svg>

      {theme.back && (
        <div className="stage">
          <svg className="stage-svg" viewBox="0 0 1600 1000">
            {theme.back}
          </svg>
        </div>
      )}

      <div className="stage">
        <CloudLayer seconds={DRIFT_SECONDS.wisps}>
          <Wisps paint={theme.cloud} />
        </CloudLayer>
        <CloudLayer seconds={DRIFT_SECONDS.far}>
          <Puffs clouds={FAR_CLOUDS} paint={theme.cloud} />
        </CloudLayer>
        <CloudLayer seconds={DRIFT_SECONDS.near}>
          <Puffs clouds={NEAR_CLOUDS} paint={theme.cloud} />
        </CloudLayer>
      </div>

      <svg className="wallpaper-layer" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="wp-hill" x1=".15" y1="0" x2=".85" y2="1">
            <stop offset="0" stopColor={hill0} />
            <stop offset=".3" stopColor={hill1} />
            <stop offset=".7" stopColor={hill2} />
            <stop offset="1" stopColor={hill3} />
          </linearGradient>
          <radialGradient id="wp-sun" cx=".25" cy=".1" r=".55">
            <stop offset="0" stopColor={theme.hillGlow.color} stopOpacity={theme.hillGlow.opacity} />
            <stop offset="1" stopColor={theme.hillGlow.color} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="wp-field" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={theme.field[0]} />
            <stop offset="1" stopColor={theme.field[1]} />
          </linearGradient>
          <linearGradient id="wp-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={theme.far[0]} />
            <stop offset="1" stopColor={theme.far[1]} />
          </linearGradient>
        </defs>

        <path d="M1380 730 1470 688 1525 696 1600 676V760H1380Z" fill="url(#wp-far)" opacity=".85" />
        <path d={HILL_PATH} fill="url(#wp-hill)" />
        <path d={HILL_PATH} fill="url(#wp-sun)" />
        <path d={FIELD_PATH} fill="url(#wp-field)" />
        <path d={FIELD_EDGE} fill="none" stroke={theme.crease} strokeWidth="3" opacity=".55" />

        <g opacity={theme.speckle.opacity ?? 0.85}>
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.color} />
          ))}
        </g>

        {theme.land}
      </svg>

      {theme.movers && <div className="movers">{theme.movers}</div>}
      {theme.particles && <Particles spec={theme.particles} />}
    </div>
  )
}
