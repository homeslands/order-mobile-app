const mockStorage = new Map<string, string>()

jest.mock('@/utils/storage', () => ({
  getSyncItem: (key: string) => mockStorage.get(key) ?? null,
  setSyncItem: (key: string, value: string) => {
    mockStorage.set(key, value)
  },
  getMMKV: () => ({ remove: (key: string) => mockStorage.delete(key) }),
}))

import {
  recordServerTime,
  resetServerClock,
  serverNow,
} from '@/lib/auth/server-clock'

const T0 = Date.UTC(2026, 10, 26, 3, 0, 0)
const T10 = Date.UTC(2026, 10, 26, 3, 10, 0)

describe('server-clock', () => {
  beforeEach(() => {
    mockStorage.clear()
    resetServerClock()
    jest.restoreAllMocks()
  })

  it('bù offset từ timestamp server', () => {
    recordServerTime('2026-11-26T03:10:00.000Z', T0)
    jest.spyOn(Date, 'now').mockReturnValue(T0)
    expect(serverNow()).toBe(T10)
  })

  it('timestamp thiếu / rác → giữ offset cũ', () => {
    recordServerTime('2026-11-26T03:10:00.000Z', T0)
    jest.spyOn(Date, 'now').mockReturnValue(T0)
    recordServerTime(undefined)
    expect(serverNow()).toBe(T10)
    recordServerTime('x')
    expect(serverNow()).toBe(T10)
  })

  it('offset lưu MMKV hỏng → offset 0', () => {
    mockStorage.set('server-clock-offset', 'abc')
    jest.spyOn(Date, 'now').mockReturnValue(T0)
    expect(serverNow()).toBe(T0)
  })

  it('offset sống qua lần khởi động sau (đọc lại từ MMKV)', () => {
    recordServerTime('2026-11-26T03:10:00.000Z', T0)
    jest.spyOn(Date, 'now').mockReturnValue(T0)
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('@/lib/auth/server-clock') as {
        serverNow: () => number
      }
      expect(fresh.serverNow()).toBe(T10)
    })
  })

  it('resetServerClock xoá offset đã lưu', () => {
    recordServerTime('2026-11-26T03:10:00.000Z', T0)
    resetServerClock()
    jest.spyOn(Date, 'now').mockReturnValue(T0)
    expect(serverNow()).toBe(T0)
    expect(mockStorage.has('server-clock-offset')).toBe(false)
  })
})
