/*
 * Two small helpers that keep the Photos app from hammering the home server.
 * Kept apart from photos.ts so they can be tested alone.
 */

/**
 * Remembers an async result per key for a while, and makes everyone who asks while it's loading share
 * that one request. Without this, a crowd of visitors arriving after the cache expired would each send
 * their own copy of the request to the server at home. A failure is only remembered briefly, so a
 * server that is down gets a pause between attempts rather than a stampede.
 */
export class Memo<T> {
  private entries = new Map<string, { at: number; ttl: number; value: Promise<T> }>()

  private readonly ttlMs: number
  private readonly failureTtlMs: number

  constructor(ttlMs: number, failureTtlMs: number) {
    this.ttlMs = ttlMs
    this.failureTtlMs = failureTtlMs
  }

  get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key)
    if (hit && Date.now() - hit.at < hit.ttl) return hit.value

    const entry = { at: Date.now(), ttl: this.ttlMs, value: load() }
    this.entries.set(key, entry)
    entry.value.catch(() => {
      entry.at = Date.now()
      entry.ttl = this.failureTtlMs
    })
    return entry.value
  }

  /** Forgets everything except these keys, so entries for links that no longer exist don't pile up. */
  keepOnly(keys: Iterable<string>) {
    const keep = new Set(keys)
    for (const key of this.entries.keys()) if (!keep.has(key)) this.entries.delete(key)
  }
}

/** Like Promise.all(items.map(fn)), but never more than `limit` calls at once, and in order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
