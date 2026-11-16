import { useEffect, useRef, useState } from 'react'
import { track } from '../../os/track'
import { fetchBoard, qualifies, startRun, type Entry } from './arcade'
import { ITEMS, itemImage, pickItem } from './items'
import { Leaderboard, ScoreEntry } from './Leaderboard'

/*
 * Paper Toss: swipe up to throw a parody desktop icon (a new random one each throw, see items.ts) into the
 * Recycle Bin. The thrown icon moves and bounces as a circle of BALL_R; the art is only drawn over it. The bin
 * moves after every basket and one miss ends the run. On Dark Souls, wind changes every throw and grows with your streak;
 * Baby's First Video Game has no wind and shows where the throw will land.
 *
 * The world is measured in "heights": the window is 1 unit tall and `aspect` units wide, so the game plays
 * the same at any window size. Everything is drawn on one canvas.
 */

const GRAVITY = 1.8
/** Converts swipe speed (screen heights per second) into throw speed. */
const FLICK = 0.45
const MAX_SPEED = 2.6
const BALL_R = 0.045
/** How big the thrown icon is drawn (it hits things as a circle of BALL_R). */
const ITEM_SIZE = 0.11
const FLOOR = 0.93
const BIN_H = 0.25
const BIN_TOP_W = 0.21
const BIN_BOTTOM_W = 0.15
const RIM_R = 0.012
/** Sideways push per unit of wind. */
const WIND_ACCEL = 0.18
const BOUNCE = 0.45

/**
 * Baby's First Video Game: no wind, and a dotted line shows where the throw will go.
 * Dark Souls: the original game, with wind that grows as your streak does.
 */
type Difficulty = 'baby' | 'souls'

const DIFFICULTIES: Array<{ id: Difficulty; label: string }> = [
  { id: 'baby', label: "Baby's First Video Game" },
  { id: 'souls', label: 'Dark Souls' },
]

/** Each difficulty keeps its own best. Dark Souls keeps the original key, so earlier bests carry over. */
const BEST_KEYS: Record<Difficulty, string> = {
  baby: 'tgos-paper-toss-best-baby',
  souls: 'tgos-paper-toss-best',
}

/** How far along its path the aim line reaches before it has faded out completely. */
const AIM_LENGTH = 1.1
/** Baby mode: throw speed per unit dragged. It aims by distance, not speed, so a mouse can take its time. */
const AIM_POWER = 5

type Phase = 'ready' | 'flying' | 'scored' | 'missed'

interface Hud {
  phase: Phase
  streak: number
  best: number
  wind: number
  throws: number
  /** The name of what's being thrown. */
  item: string
  /** This run beat the previous best. */
  newBest: boolean
}

function readBest(mode: Difficulty): number {
  try {
    return Number(localStorage.getItem(BEST_KEYS[mode])) || 0
  } catch {
    return 0
  }
}

function saveBest(mode: Difficulty, best: number) {
  try {
    localStorage.setItem(BEST_KEYS[mode], String(best))
  } catch {
    // Private windows can refuse storage; the best score then lasts until refresh.
  }
}

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  hidden: boolean
}

/** Distance from point p to segment ab, and the closest point on it. */
function closestOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return { cx, cy, dist: Math.hypot(px - cx, py - cy) }
}

export function PaperToss() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('baby')
  const [hud, setHud] = useState<Hud>({ phase: 'ready', streak: 0, best: readBest('baby'), wind: 0, throws: 0, item: '', newBest: false })
  const restartRef = useRef<() => void>(() => {})
  /** Asks the Worker to start a run (for the leaderboard). Called on a run's first throw. */
  const runStartRef = useRef<(mode: Difficulty) => void>(() => {})
  /** The signed token that lets this run's score be handed in. */
  const runToken = useRef<{ token: string; mode: Difficulty } | null>(null)
  /** The board as it was when this run began, so the "New High Score" box needn't wait for the network. */
  const boardCache = useRef<{ mode: Difficulty; scores: Entry[] } | null>(null)
  const [board, setBoard] = useState<{ mode: Difficulty; highlight?: number } | null>(null)
  const [entry, setEntry] = useState<{ mode: Difficulty; streak: number; token: string; scores: Entry[] } | null>(null)
  const setModeRef = useRef<(mode: Difficulty) => void>(() => {})

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 1
    let height = 1
    let aspect = 1
    let phase: Phase = 'ready'
    let streak = 0
    let mode: Difficulty = 'baby'
    let best = readBest(mode)
    let throws = 0
    let newBest = false
    let wind = 0
    let binX = 0.7
    let timer = 0
    /** Whether this run has asked the Worker for its leaderboard token yet. */
    let runStarted = false
    let runStartedAt = 0
    let item = -1
    ITEMS.forEach((_, i) => itemImage(i)) // start every icon loading now, so none is blank when its turn comes
    const ball: Ball = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, spin: 0, hidden: false }
    const trail: Array<{ x: number; y: number; t: number }> = []
    /** Baby mode: the throw the swipe so far would make, drawn as the aim line. */
    let aim: { vx: number; vy: number } | null = null
    let swiping = false

    const startX = () => Math.min(0.3, Math.max(0.12, 0.14 * aspect))
    const publish = () => setHud({ phase, streak, best, wind, throws, item: ITEMS[item]?.name ?? '', newBest })

    function placeBall() {
      ball.x = startX()
      ball.y = FLOOR - BALL_R - 0.01
      ball.vx = ball.vy = ball.spin = ball.angle = 0
      ball.hidden = false
    }

    /** New bin spot and wind for the next throw. In Dark Souls the wind grows with the streak. */
    function nextRound() {
      const min = startX() + 0.35
      const max = Math.max(min + 0.05, aspect - BIN_TOP_W * 0.6)
      binX = min + Math.random() * (max - min)
      const windMax = Math.min(0.6 + streak * 0.35, 3)
      wind = mode === 'souls' ? Math.round((Math.random() * 2 - 1) * windMax * 10) / 10 : 0
      item = pickItem(item)
      placeBall()
      phase = 'ready'
      publish()
    }

    function restart() {
      streak = 0
      newBest = false
      runStarted = false
      nextRound()
    }
    restartRef.current = restart

    /** Switching difficulty starts a fresh run, against that difficulty's best. */
    setModeRef.current = (next: Difficulty) => {
      mode = next
      best = readBest(next)
      throws = 0
      aim = null
      trail.length = 0
      swiping = false
      restart()
    }

    function resize() {
      const rect = wrap!.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      aspect = width / height
      const dpr = window.devicePixelRatio || 1
      canvas!.width = Math.round(width * dpr)
      canvas!.height = Math.round(height * dpr)
      canvas!.style.width = `${width}px`
      canvas!.style.height = `${height}px`
      ctx!.setTransform(dpr * height, 0, 0, dpr * height, 0, 0)
      if (phase === 'ready') {
        binX = Math.min(binX, aspect - BIN_TOP_W * 0.6)
        placeBall()
      }
    }

    const binGeometry = () => {
      const top = FLOOR - BIN_H
      return {
        top,
        bottom: FLOOR,
        lTop: binX - BIN_TOP_W / 2,
        rTop: binX + BIN_TOP_W / 2,
        lBot: binX - BIN_BOTTOM_W / 2,
        rBot: binX + BIN_BOTTOM_W / 2,
      }
    }

    function collideSegment(ax: number, ay: number, bx: number, by: number) {
      const { cx, cy, dist } = closestOnSegment(ball.x, ball.y, ax, ay, bx, by)
      if (dist >= BALL_R || dist === 0) return
      const nx = (ball.x - cx) / dist
      const ny = (ball.y - cy) / dist
      ball.x = cx + nx * BALL_R
      ball.y = cy + ny * BALL_R
      const vn = ball.vx * nx + ball.vy * ny
      if (vn < 0) {
        ball.vx -= (1 + BOUNCE) * vn * nx
        ball.vy -= (1 + BOUNCE) * vn * ny
      }
    }

    function collideRim(rx: number, ry: number) {
      const dx = ball.x - rx
      const dy = ball.y - ry
      const dist = Math.hypot(dx, dy)
      const min = BALL_R + RIM_R
      if (dist >= min || dist === 0) return
      const nx = dx / dist
      const ny = dy / dist
      ball.x = rx + nx * min
      ball.y = ry + ny * min
      const vn = ball.vx * nx + ball.vy * ny
      if (vn < 0) {
        ball.vx -= (1 + BOUNCE) * vn * nx
        ball.vy -= (1 + BOUNCE) * vn * ny
        ball.spin *= -0.6
      }
    }

    function step(dt: number) {
      if (phase === 'flying') {
        ball.vy += GRAVITY * dt
        ball.vx += wind * WIND_ACCEL * dt
        ball.x += ball.vx * dt
        ball.y += ball.vy * dt
        ball.angle += ball.spin * dt

        const g = binGeometry()
        collideRim(g.lTop, g.top)
        collideRim(g.rTop, g.top)
        collideSegment(g.lTop, g.top, g.lBot, g.bottom)
        collideSegment(g.rTop, g.top, g.rBot, g.bottom)

        // In: below the rim and between the walls.
        if (ball.y > g.top + BALL_R * 0.6) {
          const f = (ball.y - g.top) / BIN_H
          const left = g.lTop + (g.lBot - g.lTop) * f
          const right = g.rTop + (g.rBot - g.rTop) * f
          if (ball.x > left && ball.x < right) {
            phase = 'scored'
            timer = 0
            streak += 1
            throws += 1
            if (streak > best) {
              best = streak
              newBest = true
              saveBest(mode, best)
            }
            publish()
            return
          }
        }

        const out = ball.x < -0.3 || ball.x > aspect + 0.3
        if (ball.y + BALL_R >= FLOOR || out) {
          ball.y = Math.min(ball.y, FLOOR - BALL_R)
          phase = 'missed'
          throws += 1
          timer = 0
          track('game', 'paper-toss', JSON.stringify({ mode, streak }))
          publish()
        }
      } else if (phase === 'scored') {
        // Drop the ball down into the bin, then serve the next throw.
        timer += dt
        const g = binGeometry()
        ball.vx *= 0.8
        ball.vy = Math.max(ball.vy, 0.6)
        ball.x += (binX - ball.x) * Math.min(1, dt * 8)
        ball.y = Math.min(ball.y + ball.vy * dt, g.bottom - BALL_R * 1.2)
        if (timer > 0.25) ball.hidden = true
        if (timer > 0.7) nextRound()
      } else if (phase === 'missed' && streak === 0) {
        // Missing before scoring anything isn't worth a message: after a beat, serve the next throw. (The run
        // carries on, so there's no new leaderboard token to ask for.)
        timer += dt
        if (timer > 0.6) nextRound()
      }
    }

    /* ---------- Drawing ---------- */

    function drawBin() {
      const g = binGeometry()
      const c = ctx!
      // Shadow
      c.fillStyle = 'rgba(60, 50, 30, 0.18)'
      c.beginPath()
      c.ellipse(binX, FLOOR, BIN_BOTTOM_W * 0.75, 0.018, 0, 0, Math.PI * 2)
      c.fill()
      // Body
      const body = c.createLinearGradient(g.lTop, 0, g.rTop, 0)
      body.addColorStop(0, '#f2f7fd')
      body.addColorStop(0.55, '#c8d7ea')
      body.addColorStop(1, '#97aecb')
      c.fillStyle = body
      c.strokeStyle = '#6f86a8'
      c.lineWidth = 0.006
      c.beginPath()
      c.moveTo(g.lTop, g.top)
      c.lineTo(g.rTop, g.top)
      c.lineTo(g.rBot, g.bottom)
      c.lineTo(g.lBot, g.bottom)
      c.closePath()
      c.fill()
      c.stroke()
      // Ribs
      c.strokeStyle = 'rgba(111, 134, 168, 0.45)'
      c.lineWidth = 0.004
      for (const f of [0.28, 0.5, 0.72]) {
        c.beginPath()
        c.moveTo(g.lTop + (g.rTop - g.lTop) * f, g.top + 0.02)
        c.lineTo(g.lBot + (g.rBot - g.lBot) * f, g.bottom - 0.015)
        c.stroke()
      }
      // Recycling arrows
      const cx = binX
      const cy = g.top + BIN_H * 0.55
      const r = BIN_TOP_W * 0.2
      c.strokeStyle = '#2d9a2d'
      c.fillStyle = '#2d9a2d'
      c.lineWidth = 0.011
      c.lineCap = 'round'
      for (let i = 0; i < 3; i++) {
        const start = (i * 2 * Math.PI) / 3 - Math.PI / 2 + 0.25
        const end = start + 1.45
        c.beginPath()
        c.arc(cx, cy, r, start, end)
        c.stroke()
        const ex = cx + r * Math.cos(end)
        const ey = cy + r * Math.sin(end)
        const tx = -Math.sin(end)
        const ty = Math.cos(end)
        c.beginPath()
        c.moveTo(ex + Math.cos(end) * 0.016, ey + Math.sin(end) * 0.016)
        c.lineTo(ex - Math.cos(end) * 0.016, ey - Math.sin(end) * 0.016)
        c.lineTo(ex + tx * 0.022, ey + ty * 0.022)
        c.closePath()
        c.fill()
      }
      // Rim
      c.fillStyle = '#dbe6f4'
      c.strokeStyle = '#6f86a8'
      c.lineWidth = 0.006
      c.beginPath()
      c.ellipse(binX, g.top, BIN_TOP_W / 2 + 0.008, 0.018, 0, 0, Math.PI * 2)
      c.fill()
      c.stroke()
      c.fillStyle = '#4a5c7a'
      c.beginPath()
      c.ellipse(binX, g.top + 0.002, BIN_TOP_W / 2 - 0.006, 0.011, 0, 0, Math.PI * 2)
      c.fill()
    }

    function drawBall() {
      if (ball.hidden) return
      const c = ctx!
      // Floor shadow, smaller the higher the ball flies
      const lift = Math.max(0, FLOOR - ball.y)
      c.fillStyle = `rgba(60, 50, 30, ${Math.max(0.05, 0.22 - lift * 0.25)})`
      c.beginPath()
      c.ellipse(ball.x, FLOOR, BALL_R * Math.max(0.4, 1 - lift), 0.012, 0, 0, Math.PI * 2)
      c.fill()

      const img = itemImage(item)
      if (img.complete && img.naturalWidth) {
        c.save()
        c.translate(ball.x, ball.y)
        c.rotate(ball.angle)
        c.drawImage(img, -ITEM_SIZE / 2, -ITEM_SIZE / 2, ITEM_SIZE, ITEM_SIZE)
        c.restore()
      }

      // Before the throw, its name sits above it like a selected desktop icon's label.
      if (phase === 'ready' && !swiping) drawLabel(ITEMS[item].name)
    }

    /** Drawn in CSS pixels rather than world units, so the text stays crisp at any window size. */
    function drawLabel(text: string) {
      const c = ctx!
      const dpr = window.devicePixelRatio || 1
      c.save()
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.font = '11px Tahoma, "Segoe UI", Verdana, sans-serif'
      const w = c.measureText(text).width + 8
      const x = Math.min(Math.max(4, ball.x * height - w / 2), width - w - 4)
      const y = (ball.y - ITEM_SIZE / 2) * height - 22
      c.fillStyle = '#316ac5'
      c.fillRect(x, y, w, 16)
      c.fillStyle = '#fff'
      c.textBaseline = 'middle'
      c.fillText(text, x + 4, y + 8.5)
      c.restore()
    }

    function draw() {
      const c = ctx!
      const wall = c.createLinearGradient(0, 0, 0, FLOOR)
      wall.addColorStop(0, '#f6f3e8')
      wall.addColorStop(1, '#e6dfca')
      c.fillStyle = wall
      c.fillRect(0, 0, aspect, FLOOR)
      const floor = c.createLinearGradient(0, FLOOR, 0, 1)
      floor.addColorStop(0, '#cbbf9f')
      floor.addColorStop(1, '#b3a582')
      c.fillStyle = floor
      c.fillRect(0, FLOOR, aspect, 1 - FLOOR)
      c.fillStyle = '#a39573'
      c.fillRect(0, FLOOR, aspect, 0.004)

      // Baby mode's aim line: the path this throw would take (there's no wind), fading out with distance.
      if (aim && phase === 'ready') {
        let x = ball.x
        let y = ball.y
        let vx = aim.vx
        let vy = aim.vy
        let travelled = 0
        let sinceDot = 0
        const dt = 1 / 240
        c.fillStyle = '#316ac5'
        while (y < FLOOR && travelled < AIM_LENGTH) {
          vy += GRAVITY * dt
          const nx = x + vx * dt
          const ny = y + vy * dt
          const moved = Math.hypot(nx - x, ny - y)
          travelled += moved
          sinceDot += moved
          x = nx
          y = ny
          if (sinceDot >= 0.04) {
            sinceDot = 0
            c.globalAlpha = 0.8 * (1 - travelled / AIM_LENGTH)
            c.beginPath()
            c.arc(x, y, 0.009, 0, Math.PI * 2)
            c.fill()
          }
        }
        c.globalAlpha = 1
      }

      // The swipe, as a fading trail.
      if (trail.length > 1) {
        c.strokeStyle = 'rgba(49, 106, 197, 0.35)'
        c.lineWidth = 0.012
        c.lineCap = 'round'
        c.beginPath()
        trail.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)))
        c.stroke()
      }

      // A basket sinks behind the bin's front; every other throw stays in front of it.
      if (phase === 'scored') {
        drawBall()
        drawBin()
      } else {
        drawBin()
        drawBall()
      }
    }

    /* ---------- Input: swipe anywhere ---------- */

    const toWorld = (e: PointerEvent) => {
      const rect = canvas!.getBoundingClientRect()
      return { x: (e.clientX - rect.left) / height, y: (e.clientY - rect.top) / height, t: performance.now() }
    }

    function capSpeed(vx: number, vy: number) {
      const speed = Math.hypot(vx, vy)
      return speed > MAX_SPEED ? { vx: (vx / speed) * MAX_SPEED, vy: (vy / speed) * MAX_SPEED } : { vx, vy }
    }

    /** Dark Souls: the throw a swipe ending at `end` makes, from its speed over the last tenth of a second. */
    function swipeVelocity(end: { x: number; y: number; t: number }) {
      const recent = trail.filter((p) => end.t - p.t <= 100)
      const first = recent[0] ?? trail[0]
      const dt = Math.max(0.016, (end.t - first.t) / 1000)
      return capSpeed(((end.x - first.x) / dt) * FLICK, ((end.y - first.y) / dt) * FLICK)
    }

    /** Baby mode: the throw a drag to `end` makes, from how far and which way it has gone since the press. */
    let dragStart = { x: 0, y: 0 }
    const dragVelocity = (end: { x: number; y: number }) =>
      capSpeed((end.x - dragStart.x) * AIM_POWER, (end.y - dragStart.y) * AIM_POWER)

    const onDown = (e: PointerEvent) => {
      if (phase !== 'ready') return
      swiping = true
      trail.length = 0
      const point = toWorld(e)
      trail.push(point)
      dragStart = point
      canvas!.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!swiping) return
      const point = toWorld(e)
      trail.push(point)
      if (trail.length > 12) trail.shift()
      if (mode === 'baby') {
        const v = dragVelocity(point)
        aim = v.vy < -0.25 ? v : null
      }
    }
    const onUp = (e: PointerEvent) => {
      if (!swiping) return
      swiping = false
      aim = null
      const end = toWorld(e)
      trail.push(end)
      const { vx, vy } = mode === 'baby' ? dragVelocity(end) : swipeVelocity(end)
      window.setTimeout(() => (trail.length = 0), 150)
      if (vy > -0.25) return // a real throw goes up
      ball.vx = vx
      ball.vy = vy
      ball.spin = vx * 9
      phase = 'flying'
      // A run asks for its leaderboard token on its first throw. One that keeps missing without scoring (so it
      // never ends) asks again after half an hour, so the token can't go stale in a tab left open.
      if (!runStarted || (streak === 0 && Date.now() - runStartedAt > 30 * 60_000)) {
        runStarted = true
        runStartedAt = Date.now()
        runStartRef.current(mode)
      }
      publish()
    }

    /** The browser took the pointer away (a system gesture, say): drop the swipe without throwing. */
    const onCancel = () => {
      swiping = false
      aim = null
      trail.length = 0
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)

    const observer = new ResizeObserver(resize)
    observer.observe(wrap)
    resize()
    nextRound()

    let frame = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000)
      last = now
      step(dt)
      draw()
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
    }
  }, [])

  const windStrength = Math.abs(hud.wind)

  // A run's leaderboard token is asked for on its first throw, and dropped when a new run starts or it's used.
  runStartRef.current = (mode) => {
    runToken.current = null
    void startRun(mode).then((token) => {
      if (token) runToken.current = { token, mode }
    })
    // The board is fetched now, while the first ball is in the air, so that if this run ends high enough the
    // "New High Score" box can appear the moment you miss instead of after a round trip to the server.
    void fetchBoard(mode).then((b) => {
      if (b) boardCache.current = { mode, scores: b.scores }
    })
  }

  // When a run ends, offer the initials screen if it earned a place on the board.
  useEffect(() => {
    if (hud.phase !== 'missed' || hud.streak < 1) return
    const run = runToken.current
    if (!run || run.mode !== difficulty) return
    // If the board we already have says this run ranks, show the box at once. The Worker checks again when the
    // score is handed in, so a board that's a little out of date can't put a wrong score on it.
    const cached = boardCache.current?.mode === run.mode ? boardCache.current.scores : null
    if (cached && qualifies(cached, hud.streak)) {
      setEntry({ mode: run.mode, streak: hud.streak, token: run.token, scores: cached })
      return
    }
    // Otherwise (or if nothing is cached yet), ask for the current board and decide from that.
    let live = true
    void fetchBoard(run.mode).then((b) => {
      if (live && b && qualifies(b.scores, hud.streak)) setEntry({ mode: run.mode, streak: hud.streak, token: run.token, scores: b.scores })
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud.phase, hud.throws])

  return (
    <div className="toss">
      <div className="toss-hud">
        <div className="toss-modes" role="radiogroup" aria-label="Difficulty">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              role="radio"
              aria-checked={difficulty === d.id}
              className={`xp-button toss-mode${difficulty === d.id ? ' selected' : ''}`}
              onClick={() => {
                if (d.id === difficulty) return
                setDifficulty(d.id)
                setModeRef.current(d.id)
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
        <span>
          Streak <b>{hud.streak}</b>
        </span>
        <span>
          Best <b>{hud.best}</b>
        </span>
        {difficulty === 'baby' ? (
          <span className="toss-wind toss-calm">No wind</span>
        ) : (
        <span className="toss-wind" title="Wind pushes the ball sideways">
          Wind
          <svg
            width="34"
            height="12"
            viewBox="0 0 34 12"
            aria-hidden="true"
            style={{ transform: hud.wind < 0 ? 'scaleX(-1)' : undefined, opacity: windStrength === 0 ? 0.3 : 1 }}
          >
            <path d={`M2 6H${8 + Math.min(windStrength, 3) * 7}`} stroke="#316ac5" strokeWidth="2.5" strokeLinecap="round" />
            <path d={`M${3 + Math.min(windStrength, 3) * 7} 1.5L${9 + Math.min(windStrength, 3) * 7} 6L${3 + Math.min(windStrength, 3) * 7} 10.5`} fill="none" stroke="#316ac5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <b>{windStrength.toFixed(1)}</b>
        </span>
        )}
        <button className="xp-button toss-scores" onClick={() => setBoard({ mode: difficulty })}>
          High scores
        </button>
      </div>

      <div className="toss-stage" ref={wrapRef}>
        <canvas ref={canvasRef} className="toss-canvas" aria-label="Paper Toss: swipe up toward the bin to throw" />
        {hud.phase === 'ready' && hud.throws === 0 && (
          <p className="toss-hint">
            {difficulty === 'baby' ? 'Drag up toward the bin, line up the dots, then let go' : 'Swipe up toward the bin to throw'}
          </p>
        )}
        {hud.phase === 'missed' && hud.streak > 0 && (
          <div className="toss-over" role="dialog" aria-label="Missed">
            <strong>Missed!</strong>
            <p>
              {hud.item} didn&rsquo;t make it into the bin.
              <br />
              {hud.streak === 0
                ? 'Nothing recycled this run.'
                : `You got ${hud.streak} in a row${hud.newBest ? ', a new best!' : '.'}`}
            </p>
            <button className="xp-button toss-again" onClick={() => restartRef.current()} autoFocus>
              Throw again
            </button>{' '}
            <button className="xp-button toss-again" onClick={() => setBoard({ mode: difficulty })}>
              High scores
            </button>
          </div>
        )}
      </div>

      {entry && (
        <ScoreEntry
          mode={entry.mode}
          streak={entry.streak}
          token={entry.token}
          scores={entry.scores}
          onSkip={() => setEntry(null)}
          onSaved={(result) => {
            runToken.current = null // this run's score is handed in
            boardCache.current = null // the board has changed
            setEntry(null)
            setBoard({ mode: entry.mode, highlight: result.id })
          }}
        />
      )}
      {board && <Leaderboard mode={board.mode} highlight={board.highlight} onClose={() => setBoard(null)} />}
    </div>
  )
}
