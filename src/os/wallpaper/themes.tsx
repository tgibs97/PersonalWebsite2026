import { onHill } from './geometry'
import { Balloons, Bats, Butterflies, Fireflies, Fog, Geese, Santa } from './movers'
import {
  Aurora, AutumnTree, BareTree, BlossomTree, Burst, Flag, HayBale, Moon, Pine, Pumpkin, Rainbow, Stars, Sun, Turkey,
  type BurstProps,
} from './scenery'
import type { Theme } from './types'

const RED = '#ff4d4d'
const WHITE = '#ffffff'
const BLUE = '#4da6ff'
const GOLD = '#ffd36b'
const ORANGE = '#ff9a3d'
const MAGENTA = '#ff5ec8'
const GREEN = '#7dff8a'
const CYAN = '#5ee8ff'
const PURPLE = '#b388ff'

/**
 * July's show. Delays are grouped into small clusters (around 0s, 4-5s, 8-9s, 11-12s) so three or four go
 * off together, and every cycle length differs a little, so the clusters drift and never settle into a loop.
 */
const FIREWORKS: Array<Omit<BurstProps, 'id'>> = [
  { x: 230, y: 210, size: 81, kind: 'peony', colors: [RED, WHITE, BLUE], delay: 0, seconds: 14.2 },
  { x: 470, y: 120, size: 71, kind: 'ring', colors: [GOLD, ORANGE, WHITE], delay: 0.4, seconds: 15 },
  { x: 700, y: 260, size: 92, kind: 'double', colors: [MAGENTA, WHITE], delay: 0.9, seconds: 14.6 },
  { x: 950, y: 130, size: 78, kind: 'peony', colors: [CYAN, BLUE, WHITE], delay: 4.2, seconds: 13.8 },
  { x: 1180, y: 240, size: 87, kind: 'peony', colors: [GOLD, RED], delay: 4.6, seconds: 15.4 },
  { x: 1420, y: 150, size: 74, kind: 'ring', colors: [GREEN, WHITE, CYAN], delay: 5.2, seconds: 14 },
  { x: 120, y: 320, size: 64, kind: 'peony', colors: [ORANGE, GOLD], delay: 7.8, seconds: 15.8 },
  { x: 580, y: 330, size: 69, kind: 'double', colors: [BLUE, WHITE, RED], delay: 8.2, seconds: 13.6 },
  { x: 860, y: 335, size: 83, kind: 'peony', colors: [PURPLE, MAGENTA], delay: 8.6, seconds: 14.4 },
  { x: 1310, y: 335, size: 67, kind: 'ring', colors: [CYAN, GREEN, GOLD], delay: 9, seconds: 15.2 },
  { x: 360, y: 70, size: 62, kind: 'peony', colors: [WHITE, GOLD], delay: 11, seconds: 14.8 },
  { x: 1060, y: 60, size: 64, kind: 'double', colors: [RED, WHITE, BLUE], delay: 11.4, seconds: 13.9 },
  { x: 1510, y: 280, size: 71, kind: 'ring', colors: [MAGENTA, CYAN, WHITE], delay: 12, seconds: 15.6 },
]

/**
 * One theme per month, January first. To change a month, edit its entry; to add scenery, build it from the
 * pieces in scenery.tsx / movers.tsx. Trees and pumpkins are placed with onHill(x, depth): `depth` is how far
 * below the ridge the base sits (bigger = nearer the viewer, so scale those up a little).
 */
export const THEMES: Theme[] = [
  /* ---------------------------------------------------------------- January: snowfall */
  {
    month: 1,
    name: 'Snowfall',
    sky: ['#4a7ac0', '#86abdc', '#bcd5ee', '#e8f1fa'],
    hill: ['#ffffff', '#f1f6fc', '#d9e6f4', '#b6cbe4'],
    hillGlow: { color: '#ffffff', opacity: 0.6 },
    field: ['#eef4fb', '#d6e3f2'],
    far: ['#9db2cf', '#cbd9ea'],
    crease: '#b3c6df',
    speckle: { colors: ['#ffffff', '#dbe8f8'], count: 120, size: [1, 2.4], yRange: [900, 992], opacity: 0.9 },
    cloud: { fill: '#f4f8fd', opacity: 0.95 },
    land: (
      <>
        <Pine x={140} y={onHill(140, 22)} s={1.15} snow leaf="#3b7a5a" shade="#2a5a44" />
        <Pine x={262} y={onHill(262, 18)} s={0.8} snow leaf="#3b7a5a" shade="#2a5a44" />
        <Pine x={1010} y={onHill(1010, 20)} s={0.8} snow leaf="#3b7a5a" shade="#2a5a44" />
        <Pine x={1190} y={onHill(1190, 30)} s={1.05} snow leaf="#3b7a5a" shade="#2a5a44" />
        <Pine x={1420} y={onHill(1420, 40)} s={1.3} snow leaf="#3b7a5a" shade="#2a5a44" />
      </>
    ),
    particles: { kind: 'snow', count: 46, colors: ['#ffffff'], size: [3, 7], seconds: [14, 26], drift: [-4, 6], sway: 10, opacity: 0.9, seed: 3 },
  },

  /* ---------------------------------------------------------------- February: northern lights */
  {
    month: 2,
    name: 'Northern Lights',
    sky: ['#030c26', '#0a2652', '#164a78', '#2a7192'],
    hill: ['#a6c8c6', '#74a0a2', '#43747c', '#264a54'],
    hillGlow: { color: '#bff5ff', opacity: 0.22 },
    field: ['#4f808a', '#36626c'],
    far: ['#173a62', '#3a6a8a'],
    crease: '#264a54',
    speckle: { colors: ['#e8fbff', '#bff0ff', '#ffffff'], count: 130, size: [0.9, 2], yRange: [640, 992], opacity: 0.9, seed: 9 },
    cloud: { fill: '#2a5a86', opacity: 0.4 },
    back: (
      <>
        <Stars count={60} seed={8} maxY={360} />
        <Aurora />
      </>
    ),
    land: (
      <>
        <Pine x={150} y={onHill(150, 22)} s={1.1} snow leaf="#25586a" shade="#173d4c" />
        <Pine x={268} y={onHill(268, 18)} s={0.75} snow leaf="#25586a" shade="#173d4c" />
        <Pine x={1030} y={onHill(1030, 20)} s={0.85} snow leaf="#25586a" shade="#173d4c" />
        <Pine x={1360} y={onHill(1360, 38)} s={1.25} snow leaf="#25586a" shade="#173d4c" />
      </>
    ),
  },

  /* ---------------------------------------------------------------- March: spring showers */
  {
    month: 3,
    name: 'Spring Showers',
    sky: ['#2a5fbf', '#5a90dc', '#9bc3ea', '#d6e8f6'],
    hill: ['#a6e25e', '#5dbf2c', '#2f8e1b', '#1d6711'],
    hillGlow: { color: '#e6ffa8', opacity: 0.5 },
    field: ['#4cb524', '#329418'],
    far: ['#7390b0', '#a9c3da'],
    crease: '#1d6a10',
    speckle: { colors: ['#fff6a0', '#ffffff'], count: 70, size: [1.2, 2.4], yRange: [900, 992], opacity: 0.85 },
    cloud: { fill: '#eef3f8', opacity: 0.95 },
    back: <Rainbow />,
    particles: { kind: 'rain', count: 18, colors: ['#dff0ff'], size: [10, 18], seconds: [1.1, 1.8], drift: [-4, -2], opacity: 0.35, seed: 5 },
  },

  /* ---------------------------------------------------------------- April: cherry blossoms */
  {
    month: 4,
    name: 'Cherry Blossoms',
    sky: ['#2c74dc', '#69a6ec', '#a9cff4', '#e2f0fb'],
    hill: ['#9bdc58', '#58b52e', '#2f8a1c', '#1c6410'],
    hillGlow: { color: '#f6ffb0', opacity: 0.5 },
    field: ['#4fb028', '#37931a'],
    far: ['#7f9bbc', '#b4cbe0'],
    crease: '#1f6a0e',
    speckle: { colors: ['#f8b8d0', '#ffffff', '#fbd3e1'], count: 130, size: [1.4, 2.8], yRange: [880, 992], opacity: 0.9 },
    cloud: { fill: '#ffffff', opacity: 0.94 },
    land: (
      <>
        <BlossomTree x={170} y={onHill(170, 26)} s={1.2} />
        <BlossomTree x={336} y={onHill(336, 20)} s={0.8} />
        <BlossomTree x={1080} y={onHill(1080, 22)} s={0.9} />
        <BlossomTree x={1330} y={onHill(1330, 34)} s={1.15} />
      </>
    ),
    particles: { kind: 'petal', count: 30, colors: ['#f8b8d0', '#fbd3e1', '#f39bbd'], size: [9, 16], seconds: [16, 28], drift: [6, 18], sway: 16, opacity: 0.9, seed: 7 },
  },

  /* ---------------------------------------------------------------- May: wildflowers */
  {
    month: 5,
    name: 'Wildflowers',
    sky: ['#0f4fd0', '#3a85ee', '#8bc2f8', '#d2e9fc'],
    hill: ['#92d84e', '#52b52a', '#2c8a18', '#1b6310'],
    hillGlow: { color: '#e8ffb0', opacity: 0.5 },
    field: ['#4db226', '#36941a'],
    far: ['#6f8fb3', '#a8c3dc'],
    crease: '#1f6a0e',
    speckle: {
      colors: ['#ff6b9d', '#ffffff', '#ffd84a', '#b07cf0', '#ff8a4a', '#6bb8ff'],
      count: 320,
      size: [1.8, 3.6],
      yRange: [650, 992],
      opacity: 0.95,
      seed: 12,
    },
    cloud: { fill: '#ffffff', opacity: 0.94 },
    movers: <Butterflies />,
  },

  /* ---------------------------------------------------------------- June: summer sun */
  {
    month: 6,
    name: 'Summer Sun',
    sky: ['#0636b8', '#2a78ee', '#7fbcfb', '#cde8ff'],
    hill: ['#9ee04e', '#55bb28', '#2b8c16', '#17600c'],
    hillGlow: { color: '#fff3a0', opacity: 0.65 },
    field: ['#50b524', '#349618'],
    far: ['#6c8cb2', '#a9c4de'],
    crease: '#1c6a0e',
    speckle: { colors: ['#ffe14a', '#ffffff', '#ffc233'], count: 100, size: [1.6, 3], yRange: [860, 992], opacity: 0.92 },
    cloud: { fill: '#ffffff', opacity: 0.94 },
    back: <Sun x={330} y={190} r={46} />,
    particles: { kind: 'mote', count: 14, colors: ['#ffe9a0', '#ffd96b'], size: [3, 6], seconds: [24, 40], drift: [-4, 6], sway: 20, opacity: 0.7, seed: 21 },
  },

  /* ---------------------------------------------------------------- July: fireworks night */
  {
    month: 7,
    name: 'Fireworks Night',
    sky: ['#040824', '#0b1a58', '#1b3d8e', '#3b62b0'],
    hill: ['#2f6b38', '#205a2b', '#144622', '#0a2f16'],
    hillGlow: { color: '#9bd4ff', opacity: 0.18 },
    field: ['#1d5a2a', '#124a20'],
    far: ['#1b2c5c', '#35508a'],
    crease: '#0a2f16',
    speckle: { colors: ['#bfe4ff'], count: 50, size: [1, 2], yRange: [880, 992], opacity: 0.5 },
    cloud: { fill: '#2a3d7a', opacity: 0.45 },
    back: (
      <>
        <Stars count={50} seed={14} maxY={380} />
        {FIREWORKS.map((firework, i) => (
          <Burst key={i} id={i} {...firework} />
        ))}
      </>
    ),
    land: <Flag x={1130} y={onHill(1130, 44)} s={1.35} />,
    movers: <Fireflies count={10} seed={6} />,
  },

  /* ---------------------------------------------------------------- August: golden hour */
  {
    month: 8,
    name: 'Golden Hour',
    sky: ['#2c2a78', '#9c4f8e', '#f08c58', '#ffd08a'],
    hill: ['#dcd35a', '#a3ac36', '#5f8420', '#35520f'],
    hillGlow: { color: '#ffe08a', opacity: 0.55 },
    field: ['#8fb02e', '#5f8a1c'],
    far: ['#8c5c8e', '#d49a8a'],
    crease: '#35520f',
    speckle: { colors: ['#ffe08a', '#ffb84a'], count: 90, size: [1.4, 2.8], yRange: [880, 992], opacity: 0.85 },
    cloud: { fill: '#ffc9a0', opacity: 0.85 },
    back: <Sun x={380} y={575} r={74} core="#fff0c0" glow="#ffb347" rays={false} />,
    movers: (
      <>
        <Balloons />
        <Fireflies count={8} seed={9} />
      </>
    ),
  },

  /* ---------------------------------------------------------------- September: early autumn */
  {
    month: 9,
    name: 'Early Autumn',
    sky: ['#1c5cc0', '#5896e0', '#a2c9ee', '#e6f1f8'],
    hill: ['#c9da5c', '#93b53a', '#5d8723', '#37570f'],
    hillGlow: { color: '#fff0a0', opacity: 0.5 },
    field: ['#8cb02c', '#62882a'],
    far: ['#7a92b4', '#b6c9de'],
    crease: '#35520f',
    speckle: { colors: ['#e8873a', '#d9a030', '#c8472f'], count: 110, size: [1.6, 3], yRange: [850, 992], opacity: 0.9 },
    cloud: { fill: '#ffffff', opacity: 0.94 },
    land: (
      <>
        <AutumnTree x={190} y={onHill(190, 26)} s={1.2} tone="orange" />
        <AutumnTree x={345} y={onHill(345, 20)} s={0.8} tone="gold" />
        <AutumnTree x={1050} y={onHill(1050, 22)} s={0.9} tone="red" />
        <AutumnTree x={1300} y={onHill(1300, 34)} s={1.1} tone="orange" />
      </>
    ),
    movers: <Geese />,
    particles: { kind: 'leaf', count: 16, colors: ['#e8873a', '#d1432d', '#e8b83a', '#b8641f'], size: [14, 24], seconds: [18, 30], drift: [4, 14], sway: 20, opacity: 0.95, seed: 17 },
  },

  /* ---------------------------------------------------------------- October: harvest moon */
  {
    month: 10,
    name: 'Harvest Moon',
    sky: ['#120838', '#3a1a6a', '#9a4472', '#f08a3c'],
    hill: ['#66761f', '#465716', '#2c3b0f', '#18230a'],
    hillGlow: { color: '#ffb060', opacity: 0.2 },
    field: ['#3a4a12', '#26340c'],
    far: ['#2a1a4e', '#5a3a78'],
    crease: '#18230a',
    speckle: { colors: ['#f08a24', '#c8631a'], count: 50, size: [1.4, 2.6], yRange: [880, 992], opacity: 0.7 },
    cloud: { fill: '#3a2060', opacity: 0.55 },
    back: (
      <>
        <Stars count={36} seed={22} maxY={300} />
        <Moon x={1180} y={200} r={64} color="#ffd98a" glow="#ffb35a" />
      </>
    ),
    land: (
      <>
        <BareTree x={1420} y={onHill(1420, 44)} s={1.4} color="#12081f" />
        <Pumpkin x={210} y={onHill(210, 44)} s={1.1} />
        <Pumpkin x={330} y={onHill(330, 36)} s={0.8} />
        <Pumpkin x={1030} y={onHill(1030, 40)} s={0.95} />
        <Pumpkin x={1250} y={onHill(1250, 52)} s={1.25} />
      </>
    ),
    movers: <Bats />,
  },

  /* ---------------------------------------------------------------- November: golden harvest */
  {
    month: 11,
    name: 'Golden Harvest',
    sky: ['#6f8fd6', '#a9bde4', '#f6cfa4', '#ffe9c4'],
    hill: ['#f2c552', '#dba03a', '#b06c24', '#743f16'],
    hillGlow: { color: '#fff3b8', opacity: 0.6 },
    field: ['#c4802c', '#94591e'],
    far: ['#8e7bb0', '#e0b8b4'],
    crease: '#7a4416',
    speckle: { colors: ['#e0612f', '#f0a030', '#c8402a', '#ffd25a'], count: 130, size: [1.6, 3.2], yRange: [860, 992], opacity: 0.9 },
    cloud: { fill: '#fff0dc', opacity: 0.94 },
    back: <Sun x={1290} y={470} r={58} core="#fff6d0" glow="#ffc878" rays={false} />,
    land: (
      <>
        <AutumnTree x={160} y={onHill(160, 26)} s={1.25} tone="red" />
        <AutumnTree x={300} y={onHill(300, 20)} s={0.9} tone="orange" />
        <AutumnTree x={1100} y={onHill(1100, 24)} s={1} tone="gold" />
        <AutumnTree x={1410} y={onHill(1410, 40)} s={1.3} tone="red" />
        <HayBale x={500} y={onHill(500, 62)} s={1.7} />
        <HayBale x={950} y={onHill(950, 84)} s={2.2} />
        <HayBale x={1020} y={onHill(1020, 80)} s={1.5} />
        <Turkey x={720} y={onHill(720, 84)} s={1.55} />
      </>
    ),
    movers: <Fog tint="255, 226, 176" strength={0.6} />,
    particles: { kind: 'leaf', count: 24, colors: ['#d1432d', '#e8873a', '#e8b83a', '#b8641f', '#a02c1c', '#f0a030'], size: [14, 24], seconds: [16, 28], drift: [4, 14], sway: 20, opacity: 0.95, seed: 31 },
  },

  /* ---------------------------------------------------------------- December: winter night */
  {
    month: 12,
    name: 'Winter Night',
    sky: ['#030820', '#0a1c52', '#1b3c84', '#365fae'],
    hill: ['#eaf2fc', '#cddcf0', '#a0b9da', '#7490b9'],
    hillGlow: { color: '#bcd8ff', opacity: 0.25 },
    field: ['#c9d9ee', '#9db6d8'],
    far: ['#1b2d5e', '#3a557f'],
    crease: '#7490b9',
    speckle: { colors: ['#ffffff', '#cfe2ff'], count: 110, size: [1, 2.4], yRange: [880, 992], opacity: 0.9 },
    cloud: { fill: '#26407a', opacity: 0.4 },
    back: (
      <>
        <Stars count={60} seed={33} maxY={400} />
        <Moon x={1210} y={170} r={46} crescent />
      </>
    ),
    land: (
      <>
        <Pine x={170} y={onHill(170, 22)} s={0.9} snow leaf="#2a5a50" shade="#1a3d38" />
        <Pine x={288} y={onHill(288, 18)} s={0.65} snow leaf="#2a5a50" shade="#1a3d38" />
        <Pine x={1040} y={onHill(1040, 20)} s={0.75} snow leaf="#2a5a50" shade="#1a3d38" />
        <Pine x={1260} y={onHill(1260, 40)} s={1.75} snow leaf="#2a5a50" shade="#1a3d38" lights={['#ff5a5a', '#ffd24a', '#5ac8ff', '#7dff7d']} />
      </>
    ),
    movers: <Santa />,
    particles: { kind: 'snow', count: 26, colors: ['#ffffff'], size: [3, 6], seconds: [18, 30], drift: [-3, 5], sway: 8, opacity: 0.85, seed: 41 },
  },
]
