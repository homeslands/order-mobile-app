// Đồng hồ theo giờ server: bù lệch giờ máy. Không import store nào để tránh vòng import.
import { getMMKV, getSyncItem, setSyncItem } from '@/utils/storage'

const STORAGE_KEY = 'server-clock-offset'

let offset: number | null = null

const readStoredOffset = (): number | null => {
  try {
    const raw = getSyncItem(STORAGE_KEY)
    if (raw === null || raw.trim() === '') return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

export const recordServerTime = (
  serverIso: unknown,
  receivedAt: number = Date.now(),
): void => {
  if (typeof serverIso !== 'string') return
  const serverTime = Date.parse(serverIso)
  if (Number.isNaN(serverTime)) return

  offset = serverTime - receivedAt
  try {
    setSyncItem(STORAGE_KEY, String(offset))
  } catch {
    // bỏ qua nếu không ghi được MMKV
  }
}

export const serverNow = (): number => {
  if (offset === null) offset = readStoredOffset()
  return Date.now() + (offset ?? 0)
}

export const resetServerClock = (): void => {
  offset = null
  try {
    getMMKV()?.remove(STORAGE_KEY)
  } catch {
    // bỏ qua
  }
}
