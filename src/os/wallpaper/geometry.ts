/** The wallpaper is drawn in a 1600x1000 box and cropped ("slice") to fit the screen. */
export const VIEW_W = 1600
export const VIEW_H = 1000

export const HILL_PATH = 'M0 590C200 560 380 540 600 545C950 552 1300 620 1600 705V1000H0Z'
export const FIELD_PATH = 'M0 872C500 848 1100 842 1600 884V1000H0Z'
export const FIELD_EDGE = 'M0 872C500 848 1100 842 1600 884'

type Point = [number, number]
type Cubic = [Point, Point, Point, Point]

/** The hill's ridge line: the same two curves as HILL_PATH, so scenery can sit exactly on the hill. */
const RIDGE: [Cubic, Cubic] = [
  [[0, 590], [200, 560], [380, 540], [600, 545]],
  [[600, 545], [950, 552], [1300, 620], [1600, 705]],
]

const bezier = (c: Cubic, axis: 0 | 1, t: number) => {
  const u = 1 - t
  return u * u * u * c[0][axis] + 3 * u * u * t * c[1][axis] + 3 * u * t * t * c[2][axis] + t * t * t * c[3][axis]
}

/** Y of the hill's ridge at a given x (0..1600). */
export function ridgeY(x: number): number {
  const clamped = Math.min(Math.max(x, 0), VIEW_W)
  const curve = clamped <= 600 ? RIDGE[0] : RIDGE[1]
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (bezier(curve, 0, mid) < clamped) lo = mid
    else hi = mid
  }
  return bezier(curve, 1, (lo + hi) / 2)
}

/** A point `depth` units below the ridge: where to plant a tree or pumpkin so it stands on the hill. */
export const onHill = (x: number, depth: number) => ridgeY(x) + depth

/** Small deterministic random generator, so scenery never shifts between renders. */
export function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

export const lerp = ([a, b]: [number, number], t: number) => a + (b - a) * t
