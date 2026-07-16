import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import {
  cacheDirectory,
  deleteAsync,
  downloadAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy'

import {
  getCachedThumbnail,
  putCachedThumbnail,
  thumbnailKey,
} from './thumbnail-cache'
import {
  ON_DEVICE_RESIZE_ENABLED,
  RESIZE_CONCURRENCY,
  THUMBNAIL_JPEG_COMPRESS,
} from './resize-config'

const THUMB_DIR = `${cacheDirectory ?? ''}thumbs/`
const isHttp = (u: string) => /^https?:\/\//i.test(u)

const inflight = new Map<string, Promise<string>>()
let active = 0
const queue: Array<() => void> = []

function acquire(): Promise<void> {
  if (active < RESIZE_CONCURRENCY) {
    active += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => queue.push(resolve))
}

function release(): void {
  active -= 1
  const next = queue.shift()
  if (next) {
    active += 1
    next()
  }
}

let dirReady: Promise<void> | null = null
function ensureDir(): Promise<void> {
  if (!dirReady) {
    dirReady = makeDirectoryAsync(THUMB_DIR, { intermediates: true }).catch(
      () => {},
    )
  }
  return dirReady
}

async function resize(remoteUrl: string, width: number): Promise<string> {
  await ensureDir()
  const key = thumbnailKey(remoteUrl, width)
  const tmp = `${THUMB_DIR}${key}.src`
  await acquire()
  try {
    // Download fresh each time — never reuse a possibly-truncated temp file, and
    // always delete it (success OR failure) so a bad attempt never poisons the
    // key for the rest of the session.
    await downloadAsync(remoteUrl, tmp)
    const ctx = ImageManipulator.manipulate(tmp)
    ctx.resize({ width })
    const image = await ctx.renderAsync()
    const out = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: THUMBNAIL_JPEG_COMPRESS,
    })
    putCachedThumbnail(remoteUrl, width, out.uri)
    return out.uri
  } finally {
    deleteAsync(tmp, { idempotent: true }).catch(() => {})
    release()
  }
}

/**
 * Returns a local resized thumbnail uri for a remote image, or the original
 * url on non-http input / disabled flag / failure. Deduped + throttled.
 */
export function getThumbnailUri(
  remoteUrl: string,
  width: number,
): Promise<string> {
  if (!ON_DEVICE_RESIZE_ENABLED || !remoteUrl || !isHttp(remoteUrl)) {
    return Promise.resolve(remoteUrl)
  }
  const cached = getCachedThumbnail(remoteUrl, width)
  if (cached) return Promise.resolve(cached)

  const key = thumbnailKey(remoteUrl, width)
  const existing = inflight.get(key)
  if (existing) return existing

  const task = resize(remoteUrl, width)
    .catch(() => remoteUrl)
    .finally(() => inflight.delete(key))
  inflight.set(key, task)
  return task
}
