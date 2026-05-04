import type { LatLng } from 'react-native-maps'

export function decodePolyline(encoded: string): LatLng[] {
  if (!encoded) return []
  const result: LatLng[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let b: number
    let shift = 0
    let value = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      value |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += value & 1 ? ~(value >> 1) : value >> 1

    shift = 0
    value = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      value |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += value & 1 ? ~(value >> 1) : value >> 1

    result.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
  }

  return result
}
