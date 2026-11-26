/**
 * Chọn chi nhánh mặc định khi máy chưa lưu chi nhánh nào (lần đầu mở Menu,
 * hoặc sau khi cài lại app).
 *
 * Biết vị trí (khách đã cho quyền từ trước) → chi nhánh gần nhất; không thì
 * chi nhánh đầu. Không xin quyền vị trí chỉ vì việc này — xem
 * getKnownPosition.
 */
import * as Location from 'expo-location'

import type { IBranch } from '@/types'

export interface Coords {
  latitude: number
  longitude: number
}

function distanceKm(a: Coords, b: Coords): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

function branchCoords(branch: IBranch): Coords | null {
  const lat = branch.addressDetail?.lat
  const lng = branch.addressDetail?.lng
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  return { latitude: lat, longitude: lng }
}

export function pickDefaultBranch(
  branches: IBranch[],
  position: Coords | null,
): IBranch | undefined {
  if (branches.length === 0) return undefined
  if (!position) return branches[0]
  let best: IBranch | undefined
  let bestKm = Infinity
  for (const b of branches) {
    const c = branchCoords(b)
    if (!c) continue
    const km = distanceKm(position, c)
    if (km < bestKm) {
      bestKm = km
      best = b
    }
  }
  return best ?? branches[0]
}

/** Vị trí đã biết, chỉ khi khách ĐÃ cho quyền — không hiện hộp xin quyền. */
export async function getKnownPosition(): Promise<Coords | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync()
    if (!perm.granted) return null
    const pos = await Location.getLastKnownPositionAsync({
      maxAge: 30 * 60_000,
    })
    return pos ? pos.coords : null
  } catch {
    return null
  }
}
