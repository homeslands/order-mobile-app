import { parseServerTime } from '@/lib/auth/parse-server-time'

const T = Date.UTC(2026, 10, 26, 3, 0, 0)

describe('parseServerTime', () => {
  it('đọc định dạng moment().toString() của BE', () => {
    expect(parseServerTime('Thu Nov 26 2026 10:00:00 GMT+0700')).toBe(T)
    expect(parseServerTime('Wed Nov 25 2026 22:00:00 GMT-0500')).toBe(T)
  })

  it('đọc ISO', () => {
    expect(parseServerTime('2026-11-26T03:00:00.000Z')).toBe(T)
    expect(parseServerTime('2026-11-26T10:00:00+07:00')).toBe(T)
  })

  it.each([
    '',
    'garbage',
    'Thu Xyz 26 2026 10:00:00 GMT+0700',
    'Thu Nov 26 2026 25:00:00 GMT+0700',
    undefined,
    null,
  ])('không đọc được → null (%p)', (v) => {
    expect(parseServerTime(v as string)).toBeNull()
  })
})
