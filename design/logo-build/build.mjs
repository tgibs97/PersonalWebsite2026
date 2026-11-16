// Builds the tgOS logo (the "Orbit" mark, option B2) and writes it everywhere the site uses it.
//
//   node design/logo-build/build.mjs
//
// Outputs:
//   public/favicon.svg                    the mark, as the browser-tab icon
//   src/os/logo-art.tsx                   the mark as a React fragment (the Start button icon)
//   login.html                            the lockup, inlined between the `logo:start`/`logo:end` markers
//   design/logos/final/tgos-mark.svg      standalone mark
//   design/logos/final/tgos-lockup.svg    standalone lockup (light text, made for the blue log-on screen)
//
// The lettering is outlined: glyph shapes come from Franklin Gothic Medium Italic (see
// outline-text.py, which produced glyphs.json), so the logo looks identical on every device
// instead of depending on which fonts are installed. Chromium fakes the bold weight on this
// font by stroking the outline, and `fakeBold` below reproduces that.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const glyphs = JSON.parse(readFileSync(join(here, 'glyphs.json'), 'utf8'))

const r1 = (n) => Math.round(n * 10) / 10

/** The chosen design: B2, "larger letters, roomier sphere". */
const ORBIT = { r: 37, ringRx: 47, ringRy: 12, tilt: -20, ringStroke: 4.2, font: 46 }
/** The wordmark is just "OS": the orb already says "tg". `x` is where the "O" starts, clear of the ring. */
const WORDMARK = { x: 130, size: 60 }
const COLORS = { white: '#fff', orange: '#ffb13b', ink: '#052a86' }

/** Skia's synthetic-bold outline growth: 1/24 of the font size at 9px down to 1/32 at 36px and up. */
const fakeBold = (size) => (size >= 36 ? size / 32 : size / 24)

/**
 * A run of outlined glyphs, optionally a slice of them, baseline at `y`. `x` is the run's origin, or
 * its centre with anchor 'middle', or (anchor 'slice') the left edge of the first glyph in the slice.
 */
function outlined(runKey, { x, y, anchor = 'start', fill, from = 0, to, attrs = '' }) {
  const run = glyphs.runs[runKey]
  const startX = anchor === 'middle' ? x - run.width / 2 : anchor === 'slice' ? x - run.glyphs[from].x : x
  const width = fakeBold(run.size).toFixed(3).replace(/0+$/, '')
  const paths = run.glyphs
    .slice(from, to)
    .map((g) => `<path transform="translate(${r1(startX + g.x)} ${y})" d="${g.d}"/>`)
    .join('')
  return `<g fill="${fill}" stroke="${fill}" stroke-width="${width}" stroke-linejoin="round"${attrs}>${paths}</g>`
}

const shadowFilter = (p) =>
  `<filter id="${p}shadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#021a66" flood-opacity=".45"/></filter>`

const textShadowFilter = (p) =>
  `<filter id="${p}tshadow" x="-10%" y="-20%" width="130%" height="150%"><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.5" flood-color="#021a66" flood-opacity=".5"/></filter>`

/** The mark: a Luna-blue sphere with a tilted orange ring and a large "tg". ids are prefixed with `p`. */
function mark(p) {
  const { r, ringRx, ringRy, tilt, ringStroke, font } = ORBIT
  const cx = 48
  const cy = 46
  const baseline = r1(cy + 0.3 * font)
  const half = (sweep) => `M${-ringRx} 0A${ringRx} ${ringRy} 0 0 ${sweep} ${ringRx} 0`
  const ringPath = (sweep, opacity) =>
    `<path d="${half(sweep)}" fill="none" stroke="#a8500c" stroke-width="${ringStroke + 1.5}" stroke-linecap="round" opacity="${opacity}"/>` +
    `<path d="${half(sweep)}" fill="none" stroke="url(#${p}ring)" stroke-width="${ringStroke}" stroke-linecap="round"/>`
  const ringTransform = `translate(48 47) rotate(${tilt})`

  const defs = `
    <radialGradient id="${p}body" cx=".5" cy=".3" r=".8">
      <stop offset="0" stop-color="#9fd0ff"/><stop offset=".4" stop-color="#3b86f2"/>
      <stop offset=".8" stop-color="#1250d4"/><stop offset="1" stop-color="#0a37ad"/>
    </radialGradient>
    <linearGradient id="${p}gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${p}ring" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffd36b"/><stop offset=".5" stop-color="#f58a2c"/><stop offset="1" stop-color="#c4600f"/>
    </linearGradient>
    <radialGradient id="${p}glow" cx=".5" cy="1" r=".7">
      <stop offset="0" stop-color="#7dff7d" stop-opacity=".6"/><stop offset="1" stop-color="#7dff7d" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="${p}clip"><circle cx="${cx}" cy="${cy}" r="${r - 1.5}"/></clipPath>
    ${shadowFilter(p)}`

  const body = `
    <g transform="${ringTransform}">${ringPath(1, 0.5)}</g>
    <g filter="url(#${p}shadow)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${p}body)" stroke="#fff" stroke-width="3"/></g>
    <circle cx="${cx}" cy="${cy}" r="${r + 1.5}" fill="none" stroke="#0831d9" stroke-width="1"/>
    <g clip-path="url(#${p}clip)">
      <rect x="0" y="${r1(cy + r * 0.15)}" width="96" height="60" fill="url(#${p}glow)"/>
      <ellipse cx="${cx}" cy="${r1(cy - r * 0.5)}" rx="${r1(r * 0.74)}" ry="${r1(r * 0.42)}" fill="url(#${p}gloss)" opacity=".85"/>
    </g>
    <g transform="${ringTransform}">${ringPath(0, 0.45)}</g>
    ${outlined('tg46', { x: cx + 1.5, y: r1(baseline + 1.8), anchor: 'middle', fill: COLORS.ink, attrs: ' opacity=".6"' })}
    ${outlined('tg46', { x: cx, y: baseline, anchor: 'middle', fill: COLORS.white })}`

  return { defs, body }
}

/**
 * The lockup: the orb followed by a large orange "OS", for blue backgrounds. The orb is scaled up until
 * the "tg" inside it is the same size as "OS", and both sit on one baseline, so the pair reads "tgOS".
 */
const OS_RUN = glyphs.runs.tgOS60
const OS_WIDTH = OS_RUN.glyphs[3].x - OS_RUN.glyphs[2].x + OS_RUN.glyphs[3].advance
const LOCKUP_SCALE = WORDMARK.size / ORBIT.font
const LOCKUP_W = Math.ceil(WORDMARK.x + OS_WIDTH + 6)
const LOCKUP_H = Math.ceil(96 * LOCKUP_SCALE)
const LOCKUP_VIEWBOX = `0 0 ${LOCKUP_W} ${LOCKUP_H}`
/** Matches .brand-logo's width in src/login/login.css. */
const LOGIN_LOGO_WIDTH = 290

function lockup(p) {
  const m = mark(p)
  const markBaseline = 46 + 0.3 * ORBIT.font // where the orb's own "tg" sits, in mark units
  const baseline = r1(markBaseline * LOCKUP_SCALE)
  const word =
    `<g filter="url(#${p}tshadow)">` +
    outlined('tgOS60', { x: WORDMARK.x, y: baseline, anchor: 'slice', fill: COLORS.orange, from: 2 }) +
    `</g>`
  return {
    defs: m.defs + textShadowFilter(p),
    body: `<g transform="scale(${LOCKUP_SCALE.toFixed(4)})">${m.body}</g>` + word,
  }
}

const tidy = (s) => s.replace(/\s*\n\s*/g, '').replace(/>\s+</g, '><').trim()

const markSvg = (p, extra = '') => {
  const m = mark(p)
  return tidy(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"${extra}><defs>${m.defs}</defs>${m.body}</svg>`)
}

const lockupSvg = (p, extra = '') => {
  const l = lockup(p)
  return tidy(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOCKUP_VIEWBOX}"${extra}><defs>${l.defs}</defs>${l.body}</svg>`)
}

/** SVG markup to JSX: hyphenated presentation attributes become camelCase. */
const jsx = (s) => s.replace(/\s([a-z]+(?:-[a-z]+)+)=/g, (_, name) => ` ${name.replace(/-([a-z])/g, (_m, c) => c.toUpperCase())}=`)

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  console.log('wrote', path.replace(root, '').replace(/\\/g, '/').replace(/^\//, ''))
}

// 1. Standalone SVGs and the favicon.
write(join(root, 'design/logos/final/tgos-mark.svg'), markSvg('tgos-') + '\n')
write(join(root, 'design/logos/final/tgos-lockup.svg'), lockupSvg('tgos-') + '\n')
write(join(root, 'public/favicon.svg'), markSvg('tgos-') + '\n')

// 2. React fragment for the Start button icon (drawn in a 96x96 box).
{
  const m = mark('ic-tgos-')
  write(
    join(root, 'src/os/logo-art.tsx'),
    `// Generated by design/logo-build/build.mjs from the tgOS logo. Do not edit by hand.
/** The tgOS mark, drawn in a 96x96 box. */
export function LogoArt() {
  return (
    <>
      <defs>${jsx(tidy(m.defs))}</defs>
      ${jsx(tidy(m.body))}
    </>
  )
}
`,
  )
}

// 3. The log-on screen: the lockup, inlined as the page's <h1>.
{
  const loginPath = join(root, 'login.html')
  const html = readFileSync(loginPath, 'utf8')
  const start = '<!-- logo:start'
  const end = '<!-- logo:end -->'
  const a = html.indexOf(start)
  const b = html.indexOf(end)
  if (a === -1 || b === -1) throw new Error('login.html is missing its logo:start / logo:end markers')
  const startLineEnd = html.indexOf('-->', a) + 3
  const indent = '          '
  const block =
    `\n${indent}<h1 class="brand-title">` +
    // width/height are the size before CSS loads (the stylesheet then sizes it responsively).
    lockupSvg('tgos-', ` class="brand-logo" width="${LOGIN_LOGO_WIDTH}" height="${Math.round((LOGIN_LOGO_WIDTH * LOCKUP_H) / LOCKUP_W)}" role="img" aria-label="tgOS"`) +
    `</h1>\n${indent}`
  write(loginPath, html.slice(0, startLineEnd) + block + html.slice(b))
}
