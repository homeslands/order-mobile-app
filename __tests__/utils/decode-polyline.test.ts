import { decodePolyline } from '@/utils/decode-polyline'

describe('decodePolyline', () => {
  it('decodes a known encoded string to lat/lng pairs', () => {
    const result = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')
    expect(result).toHaveLength(3)
    expect(result[0].latitude).toBeCloseTo(38.5, 1)
    expect(result[0].longitude).toBeCloseTo(-120.2, 1)
    expect(result[1].latitude).toBeCloseTo(40.7, 1)
    expect(result[1].longitude).toBeCloseTo(-120.95, 1)
    expect(result[2].latitude).toBeCloseTo(43.252, 1)
    expect(result[2].longitude).toBeCloseTo(-126.453, 1)
  })

  it('returns empty array for empty string', () => {
    expect(decodePolyline('')).toEqual([])
  })

  it('returns objects with latitude and longitude keys', () => {
    const result = decodePolyline('_p~iF~ps|U')
    expect(result[0]).toHaveProperty('latitude')
    expect(result[0]).toHaveProperty('longitude')
  })
})
