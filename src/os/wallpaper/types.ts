import type { ReactNode } from 'react'
import type { ParticleSpec } from './particles'

/** Little dots scattered over the hill: flowers in spring, snow glints in winter, fallen leaves in autumn. */
export interface Speckle {
  colors: string[]
  count: number
  /** Dot radius range. */
  size: [number, number]
  /** Vertical band the dots fall in (they are always kept below the ridge line). */
  yRange: [number, number]
  opacity?: number
  seed?: number
}

/** Everything that makes one month look like itself. */
export interface Theme {
  month: number
  name: string
  /** Sky gradient, top to horizon. */
  sky: [string, string, string, string]
  /** Hill gradient, sunlit ridge to shaded base. */
  hill: [string, string, string, string]
  /** Soft highlight on the hill's sunny side. */
  hillGlow: { color: string; opacity: number }
  /** The nearer field along the bottom. */
  field: [string, string]
  /** Distant mountains on the right horizon. */
  far: [string, string]
  /** Dark line where the field meets the hill. */
  crease: string
  speckle: Speckle
  cloud: { fill: string; opacity: number }
  /** Sky scenery behind the clouds: sun, moon, stars, rainbow, aurora, fireworks. */
  back?: ReactNode
  /** Scenery standing on the hill: trees, pumpkins. */
  land?: ReactNode
  /** Creatures and mist moving above the hill, positioned by screen %. */
  movers?: ReactNode
  /** Falling or rising bits of weather. */
  particles?: ParticleSpec
}
