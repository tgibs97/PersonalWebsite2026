/*
 * Reads a browser's User-Agent string into something worth grouping by. Kept apart from analytics.ts (no
 * imports) so it can be tested alone. The raw string is stored too: this is only for the tidy columns.
 */

export interface Agent {
  browser: string
  os: string
  device: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
}

const BOT = /bot|crawl|spider|slurp|headless|python-requests|python-urllib|curl\/|wget\/|httpclient|go-http|node-fetch|axios|scrapy|libwww|okhttp\/|java\//i

const major = (version: string | undefined) => (version ? version.split(/[._]/)[0] : '')
const named = (name: string, version: string | undefined) => (version ? `${name} ${major(version)}` : name)

export function parseAgent(ua: string): Agent {
  const u = ua.trim()
  if (!u) return { browser: 'Unknown', os: 'Unknown', device: 'unknown' }

  let browser = 'Unknown'
  let m: RegExpMatchArray | null
  if ((m = u.match(/\bEdg(?:e|A|iOS)?\/([\d.]+)/))) browser = named('Edge', m[1])
  else if ((m = u.match(/\bOPR\/([\d.]+)/))) browser = named('Opera', m[1])
  else if ((m = u.match(/\b(?:Firefox|FxiOS)\/([\d.]+)/))) browser = named('Firefox', m[1])
  else if ((m = u.match(/\bSamsungBrowser\/([\d.]+)/))) browser = named('Samsung Internet', m[1])
  else if ((m = u.match(/\b(?:Chrome|CriOS)\/([\d.]+)/))) browser = named('Chrome', m[1])
  else if ((m = u.match(/\bVersion\/([\d.]+).*Safari/))) browser = named('Safari', m[1])
  else if ((m = u.match(/^(curl|Wget|python-requests|Go-http-client|node-fetch|axios)\/([\d.]+)/i))) browser = named(m[1], m[2])
  else if (/bot|crawl|spider/i.test(u)) browser = 'Bot'

  let os = 'Unknown'
  if (/Windows NT/.test(u)) os = 'Windows'
  else if ((m = u.match(/Android ([\d.]+)/))) os = named('Android', m[1])
  else if ((m = u.match(/\b(?:iPhone|iPad|iPod)\b.*?OS ([\d_]+)/))) os = named('iOS', m[1])
  else if (/Mac OS X|Macintosh/.test(u)) os = 'macOS'
  else if (/CrOS/.test(u)) os = 'ChromeOS'
  else if (/Linux|X11/.test(u)) os = 'Linux'

  let device: Agent['device'] = 'desktop'
  if (BOT.test(u)) device = 'bot'
  else if (/iPad/.test(u) || (/Android/.test(u) && !/Mobile/.test(u))) device = 'tablet'
  else if (/Mobi|iPhone|iPod|Android/.test(u)) device = 'mobile'

  return { browser, os, device }
}
