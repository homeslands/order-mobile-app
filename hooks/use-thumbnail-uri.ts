import { useEffect, useState } from 'react'

import { getThumbnailUri } from '@/lib/image/on-device-resize'
import { getCachedThumbnail } from '@/lib/image/thumbnail-cache'

/**
 * Resolve a remote image url to a local resized thumbnail uri.
 * Cache hits resolve synchronously (no pop-in); misses resolve after resize.
 */
export function useThumbnailUri(
  remoteUrl: string | null,
  width: number,
): string | null {
  // Synchronous cache lookup during render — a hit shows instantly (no pop-in).
  const cached = remoteUrl ? getCachedThumbnail(remoteUrl, width) : null

  // Async-resolved result, tagged with its url so a stale resolution is ignored.
  const [resolved, setResolved] = useState<{ url: string; uri: string } | null>(
    null,
  )

  useEffect(() => {
    if (!remoteUrl || getCachedThumbnail(remoteUrl, width)) return
    let alive = true
    getThumbnailUri(remoteUrl, width).then((uri) => {
      if (alive) setResolved({ url: remoteUrl, uri })
    })
    return () => {
      alive = false
    }
  }, [remoteUrl, width])

  if (cached) return cached
  return resolved && resolved.url === remoteUrl ? resolved.uri : null
}
