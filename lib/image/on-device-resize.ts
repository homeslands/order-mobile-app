import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import {
  cacheDirectory,
  deleteAsync,
  downloadAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy'

import { RESIZE_SERVICE_READY } from '@/utils/product-image-url'

import {
  getCachedThumbnail,
  putCachedThumbnail,
  thumbnailKey,
} from './thumbnail-cache'
import {
  ON_DEVICE_RESIZE_ENABLED,
  RESIZE_CONCURRENCY,
  THUMBNAIL_AHEAD_MAX,
  THUMBNAIL_JPEG_COMPRESS,
} from './resize-config'

const THUMB_DIR = `${cacheDirectory ?? ''}thumbs/`
const isHttp = (u: string) => /^https?:\/\//i.test(u)

/**
 * 'visible': ô đang hiện trên màn. 'ahead': ảnh sắp cuộn tới (tải trước).
 * Việc 'visible' luôn được cấp slot trước; trong cùng mức, việc MỚI NHẤT trước
 * — ô vừa hiện là ô khách đang nhìn, ô xếp hàng từ trước có thể đã cuộn qua.
 */
type Priority = 'visible' | 'ahead'

type Job = {
  key: string
  remoteUrl: string
  width: number
  priority: Priority
  seq: number
  started: boolean
  /** Số người gọi còn cần kết quả. Người gọi không có signal không bao giờ rời. */
  live: number
  /** Có lời yêu cầu tải trước — mất hết người gọi thì lùi về 'ahead', không huỷ. */
  prefetched: boolean
  resolve: (uri: string) => void
  promise: Promise<string>
}

const jobs = new Map<string, Job>()
const waiting: Job[] = []
let active = 0
let seq = 0

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
  const tmp = `${THUMB_DIR}${thumbnailKey(remoteUrl, width)}.src`
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
  }
}

function rank(job: Job): number {
  return (
    (job.priority === 'visible' ? Number.MAX_SAFE_INTEGER / 2 : 0) + job.seq
  )
}

function pump(): void {
  while (active < RESIZE_CONCURRENCY && waiting.length > 0) {
    let best = 0
    for (let i = 1; i < waiting.length; i += 1) {
      if (rank(waiting[i]) > rank(waiting[best])) best = i
    }
    const [job] = waiting.splice(best, 1)
    start(job)
  }
}

function start(job: Job): void {
  active += 1
  job.started = true
  resize(job.remoteUrl, job.width)
    .catch(() => job.remoteUrl)
    .then((uri) => job.resolve(uri))
    .finally(() => {
      active -= 1
      jobs.delete(job.key)
      pump()
    })
}

/** Bỏ một việc chưa bắt đầu; người gọi còn lại (nếu có) nhận URL gốc. */
function drop(job: Job): void {
  const i = waiting.indexOf(job)
  if (i >= 0) waiting.splice(i, 1)
  jobs.delete(job.key)
  job.resolve(job.remoteUrl)
}

function onCallerLeft(job: Job): void {
  job.live -= 1
  if (job.started || job.live > 0) return
  if (job.prefetched) {
    job.priority = 'ahead'
    return
  }
  drop(job)
}

function attach(job: Job, signal?: AbortSignal): void {
  job.live += 1
  if (!signal) return
  if (signal.aborted) {
    onCallerLeft(job)
    return
  }
  signal.addEventListener('abort', () => onCallerLeft(job), { once: true })
}

function createJob(remoteUrl: string, width: number, priority: Priority): Job {
  let resolve: (uri: string) => void = () => {}
  const promise = new Promise<string>((r) => {
    resolve = r
  })
  seq += 1
  const job: Job = {
    key: thumbnailKey(remoteUrl, width),
    remoteUrl,
    width,
    priority,
    seq,
    started: false,
    live: 0,
    prefetched: false,
    resolve,
    promise,
  }
  jobs.set(job.key, job)
  waiting.push(job)
  return job
}

/** Ảnh có cần (và được phép) thu nhỏ trên máy không. */
function needsResize(remoteUrl: string): boolean {
  return (
    ON_DEVICE_RESIZE_ENABLED &&
    // Server đã trả ảnh thu nhỏ thì không tải ảnh về resize lần nữa.
    !RESIZE_SERVICE_READY &&
    !!remoteUrl &&
    isHttp(remoteUrl)
  )
}

/** Giữ số việc tải-trước đang chờ ≤ THUMBNAIL_AHEAD_MAX, bỏ việc cũ nhất. */
function trimAhead(): void {
  const ahead = waiting.filter((j) => j.priority === 'ahead')
  if (ahead.length <= THUMBNAIL_AHEAD_MAX) return
  ahead.sort((a, b) => a.seq - b.seq)
  for (const job of ahead.slice(0, ahead.length - THUMBNAIL_AHEAD_MAX)) {
    drop(job)
  }
}

/**
 * Returns a local resized thumbnail uri for a remote image, or the original
 * url on non-http input / disabled flag / server-side resize / failure /
 * cancellation. Deduped + throttled; `signal` cancels this caller's interest —
 * the resize is skipped only if every caller left before it started.
 */
export function getThumbnailUri(
  remoteUrl: string,
  width: number,
  opts?: { priority?: Priority; signal?: AbortSignal },
): Promise<string> {
  if (!needsResize(remoteUrl)) return Promise.resolve(remoteUrl)
  const cached = getCachedThumbnail(remoteUrl, width)
  if (cached) return Promise.resolve(cached)

  const priority = opts?.priority ?? 'visible'
  let job = jobs.get(thumbnailKey(remoteUrl, width))
  if (job) {
    if (!job.started && priority === 'visible' && job.priority === 'ahead') {
      job.priority = 'visible'
      seq += 1
      job.seq = seq
    }
  } else {
    job = createJob(remoteUrl, width, priority)
  }
  attach(job, opts?.signal)
  const { promise } = job
  pump()
  return promise
}

/**
 * Xếp việc thu nhỏ cho ảnh sắp cuộn tới, ở mức thấp: luôn nhường ô đang hiện.
 * Bỏ qua ảnh đã có trong cache hoặc đang được xử lý.
 */
export function prefetchThumbnails(urls: string[], width: number): void {
  for (const url of urls) {
    if (!needsResize(url) || getCachedThumbnail(url, width)) continue
    const existing = jobs.get(thumbnailKey(url, width))
    if (existing) {
      existing.prefetched = true
      continue
    }
    createJob(url, width, 'ahead').prefetched = true
  }
  trimAhead()
  pump()
}
