import { useEffect, useState, type ImgHTMLAttributes } from 'react'

/*
 * THE RULE: anywhere the site waits for something to load or finish, a spinner shows. Use these, so every wait
 * looks the same, rather than plain "Loading…" text or a silent blank. (Styles: `.xp-spin` and friends in luna.css.)
 */

interface SpinnerProps {
  /** What's being waited for, e.g. "Loading…". Shown beside the ring, and read out by screen readers. */
  label?: string
  /** Centre it in the space it's in, for a panel or window that is waiting as a whole. */
  block?: boolean
  /** Only appear if the wait lasts this long. For waits nobody asked for (the desktop starting up), so a quick one doesn't flash. */
  delayMs?: number
}

export function Spinner({ label, block = false, delayMs = 0 }: SpinnerProps) {
  const [shown, setShown] = useState(delayMs === 0)
  useEffect(() => {
    if (delayMs === 0) return
    const id = window.setTimeout(() => setShown(true), delayMs)
    return () => window.clearTimeout(id)
  }, [delayMs])
  if (!shown) return null
  return (
    <span className={`xp-wait${block ? ' block' : ''}`} role="status">
      <i className="xp-spin" aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  )
}

/**
 * An image that shows a spinner in the middle of its frame until it has loaded (or failed to). Put it inside
 * something with `position: relative` and a size of its own. It takes the same props as an <img>.
 */
export function LoadingImage({ src, onLoad, onError, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  // Remembering *which* source finished (not just "finished") means a new source starts out waiting again.
  const [doneSrc, setDoneSrc] = useState<string | undefined>(undefined)
  const waiting = doneSrc !== src
  return (
    <>
      {waiting && (
        <span className="xp-img-wait" role="status" aria-label="Loading picture">
          <i className="xp-spin" aria-hidden="true" />
        </span>
      )}
      <img
        {...rest}
        src={src}
        onLoad={(e) => {
          setDoneSrc(src)
          onLoad?.(e)
        }}
        onError={(e) => {
          setDoneSrc(src)
          onError?.(e)
        }}
      />
    </>
  )
}
