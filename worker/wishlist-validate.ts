/*
 * What the Wishlist accepts. Kept apart from wishlist.ts (no imports) so it can be tested alone.
 *
 * Everything here is checked on the Worker, whatever the page already checked: the page is only a
 * convenience for typing, and anyone can send the API whatever they like.
 */

export const LIMITS = {
  items: 500,
  name: 120,
  notes: 2000,
  urls: 10,
  url: 2048,
  label: 60,
  images: 8,
  imageBytes: 4 * 1024 * 1024,
  claimName: 40,
  /** $1,000,000. Prices are whole cents. */
  cents: 100_000_000,
  jsonBytes: 64 * 1024,
} as const

export interface WishUrl {
  url: string
  label: string
}

export interface ItemInput {
  name: string
  msrpCents: number | null
  expectedCents: number | null
  /** "Don't pay over": the most to spend. null = no limit. */
  maxCents: number | null
  notes: string
  urls: WishUrl[]
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

// Control characters (except newline and tab, where they're allowed) and the invisible characters that
// can make text read backwards or hide in a name.
const CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g

/** Trimmed text with the control and direction-changing characters taken out. */
export function cleanText(value: unknown, max: number, { multiline = false } = {}): string | null {
  if (typeof value !== 'string') return null
  let text = value.replace(CONTROLS, '')
  if (!multiline) text = text.replace(/[\r\n\t]+/g, ' ')
  text = text.replace(/\r\n?/g, '\n').trim()
  return text.length <= max ? text : null
}

/** A price in whole cents, or null for "unknown". Anything else is refused. */
function cents(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > LIMITS.cents) return undefined
  return value
}

/** Only plain web addresses: http or https, no embedded password, nothing like `javascript:` or `data:`. */
export function cleanUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > LIMITS.url) return null
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password || !url.hostname) return null
  return url.href
}

export function parseItem(body: unknown): Parsed<ItemInput> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Send an object.')
  const b = body as Record<string, unknown>

  const name = cleanText(b.name, LIMITS.name)
  if (!name) return fail(`Give the item a name (up to ${LIMITS.name} characters).`)

  const msrpCents = cents(b.msrpCents)
  const expectedCents = cents(b.expectedCents)
  const maxCents = cents(b.maxCents)
  if (msrpCents === undefined || expectedCents === undefined || maxCents === undefined) return fail('Prices must be between $0 and $1,000,000.')

  const notes = cleanText(b.notes ?? '', LIMITS.notes, { multiline: true })
  if (notes === null) return fail(`Notes can be up to ${LIMITS.notes} characters.`)

  const rawUrls = b.urls ?? []
  if (!Array.isArray(rawUrls) || rawUrls.length > LIMITS.urls) return fail(`Up to ${LIMITS.urls} links.`)
  const urls: WishUrl[] = []
  for (const entry of rawUrls) {
    const e = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null
    const url = cleanUrl(e?.url)
    if (!url) return fail('Every link must be a web address starting with http:// or https://.')
    const label = cleanText(e?.label ?? '', LIMITS.label)
    if (label === null) return fail(`Link labels can be up to ${LIMITS.label} characters.`)
    urls.push({ url, label })
  }

  return { ok: true, value: { name, msrpCents, expectedCents, maxCents, notes, urls } }
}

/** The name a family member types when they claim an item. */
export function parseClaimName(body: unknown): Parsed<string> {
  const name = cleanText((body as Record<string, unknown> | null)?.name, LIMITS.claimName)
  return name ? { ok: true, value: name } : fail(`Type your name (up to ${LIMITS.claimName} characters).`)
}

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp'

/** What a file really is, from its first bytes. A file's claimed type proves nothing. */
export function sniffImage(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'image/png'
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

/** Parses the stored JSON columns, which can only be arrays of the expected shape. */
export function readUrls(stored: string): WishUrl[] {
  try {
    const list: unknown = JSON.parse(stored)
    if (!Array.isArray(list)) return []
    return list.flatMap((e) => (e && typeof e.url === 'string' ? [{ url: String(e.url), label: typeof e.label === 'string' ? e.label : '' }] : []))
  } catch {
    return []
  }
}

export function readImageIds(stored: string): string[] {
  try {
    const list: unknown = JSON.parse(stored)
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}
