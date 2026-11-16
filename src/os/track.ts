/*
 * Tells the site's own Worker what the visitor does (which windows they open, which links they follow), so
 * the owner can see where people go. It only ever talks to this site, on a plain path of its own, and puts
 * nothing in the browser: no cookie of its own, no storage. (The Worker recognises a returning visitor by
 * the cookie it already set at log-on.) See worker/analytics.ts for what is kept and for how long.
 */

interface Note {
  k: string
  t?: string
  d?: string
  ms: number
}

const ENDPOINT = '/api/desk'
const FLUSH_AFTER_MS = 4000
const MAX_PER_REQUEST = 30

let queue: Note[] = []
let timer = 0

function flush() {
  window.clearTimeout(timer)
  timer = 0
  while (queue.length > 0) {
    const batch = queue.splice(0, MAX_PER_REQUEST)
    // keepalive lets the request finish even while the page is closing.
    void fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ e: batch }),
    }).catch(() => {})
  }
}

/** Notes something that happened. Sent in small batches a few seconds later, and at once if the page is closing. */
export function track(kind: string, target = '', detail = '') {
  queue.push({ k: kind, t: target, d: detail, ms: Date.now() })
  if (queue.length >= MAX_PER_REQUEST) flush()
  else if (!timer) timer = window.setTimeout(flush, FLUSH_AFTER_MS)
}

/** Starts the page-wide parts: noting the page load, and sending whatever is waiting when the page is left. */
export function startTracking(slug: string) {
  let host = ''
  try {
    host = document.referrer ? new URL(document.referrer).host : ''
  } catch {
    // an unreadable referrer is just no referrer
  }
  track(
    'load',
    '',
    JSON.stringify({
      ref: host,
      slug,
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio,
      lang: navigator.language,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  )
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}

/** For the window manager: when the page is left, say how long the visit lasted and each open app's time. */
export function trackLeave(startedAt: number, apps: Record<string, number>) {
  const now = Date.now()
  const seconds = (since: number) => Math.round((now - since) / 1000)
  const perApp: Record<string, number> = {}
  for (const [id, since] of Object.entries(apps)) perApp[id] = seconds(since)
  track('leave', '', JSON.stringify({ s: seconds(startedAt), apps: perApp }))
  flush()
}
