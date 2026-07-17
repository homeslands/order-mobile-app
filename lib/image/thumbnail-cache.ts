import { deleteAsync } from 'expo-file-system/legacy'

import { getMMKV } from '@/utils/storage'
import { THUMBNAIL_CACHE_MAX } from './resize-config'

const INDEX_KEY = 'thumb-index-v1'

type Entry = { uri: string; ts: number }
type Index = Record<string, Entry>

let index: Map<string, Entry> | null = null
let clock = 0

function load(): Map<string, Entry> {
  if (index) return index
  index = new Map()
  const mmkv = getMMKV()
  const raw = mmkv?.getString(INDEX_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Index
      for (const [k, v] of Object.entries(parsed)) index.set(k, v)
      for (const v of index.values()) if (v.ts > clock) clock = v.ts
    } catch {
      index = new Map()
    }
  }
  return index
}

function persist(map: Map<string, Entry>): void {
  const mmkv = getMMKV()
  if (!mmkv) return
  mmkv.set(INDEX_KEY, JSON.stringify(Object.fromEntries(map)))
}

/** Stable djb2 hash of `${url}|${width}` in base36. */
export function thumbnailKey(remoteUrl: string, width: number): string {
  const s = `${remoteUrl}|${width}`
  let h = 5381
  for (let i = 0; i < s.length; i += 1) h = (h * 33) ^ s.charCodeAt(i)
  return (h >>> 0).toString(36)
}

/**
 * Pure read — called during render, so it must NOT mutate state or touch disk.
 * Eviction is therefore by insertion order (FIFO), not access order; at
 * THUMBNAIL_CACHE_MAX=400 a menu fits in cache, so FIFO≈LRU in practice.
 */
export function getCachedThumbnail(
  remoteUrl: string,
  width: number,
): string | null {
  const map = load()
  const entry = map.get(thumbnailKey(remoteUrl, width))
  return entry ? entry.uri : null
}

function evict(map: Map<string, Entry>): void {
  while (map.size > THUMBNAIL_CACHE_MAX) {
    let oldestKey: string | null = null
    let oldestTs = Infinity
    for (const [k, v] of map) {
      if (v.ts < oldestTs) {
        oldestTs = v.ts
        oldestKey = k
      }
    }
    if (oldestKey == null) break
    const removed = map.get(oldestKey)
    map.delete(oldestKey)
    if (removed) deleteAsync(removed.uri, { idempotent: true }).catch(() => {})
  }
}

export function putCachedThumbnail(
  remoteUrl: string,
  width: number,
  uri: string,
): void {
  const map = load()
  clock += 1
  map.set(thumbnailKey(remoteUrl, width), { uri, ts: clock })
  evict(map)
  persist(map)
}

export function invalidateThumbnail(remoteUrl: string, width: number): void {
  const map = load()
  const key = thumbnailKey(remoteUrl, width)
  const removed = map.get(key)
  if (!removed) return
  map.delete(key)
  deleteAsync(removed.uri, { idempotent: true }).catch(() => {})
  persist(map)
}
