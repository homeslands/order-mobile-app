import { supportsDetachedSearchTab } from '@/utils/platform-version'

describe('supportsDetachedSearchTab', () => {
  it('returns true for iOS 26 and above', () => {
    expect(supportsDetachedSearchTab('ios', '26.0')).toBe(true)
    expect(supportsDetachedSearchTab('ios', '26.1')).toBe(true)
    expect(supportsDetachedSearchTab('ios', '27.0')).toBe(true)
  })

  it('returns false for iOS below 26', () => {
    expect(supportsDetachedSearchTab('ios', '15.1')).toBe(false)
    expect(supportsDetachedSearchTab('ios', '18.0')).toBe(false)
    expect(supportsDetachedSearchTab('ios', '25.9')).toBe(false)
  })

  it('returns false for android regardless of version value', () => {
    expect(supportsDetachedSearchTab('android', 35)).toBe(false)
    expect(supportsDetachedSearchTab('android', '35')).toBe(false)
    expect(supportsDetachedSearchTab('android', '26.0')).toBe(false)
  })

  // Nhánh an toàn phải LUÔN là false: nếu logic hỏng rơi nhầm sang true trên
  // máy chạy iOS < 26, app sẽ gán role="search" cho tab giỏ hàng, và hệ
  // thống tự đè nhãn thành "Tìm kiếm" thay vì "Giỏ hàng" (xem
  // app/(tabs)/_layout.tsx) — lỗi này chỉ lộ ra trên thiết bị thật chạy iOS
  // cũ, thứ mà người phát triển thường không cầm trên tay.
  it('falls back to false (safe branch) for malformed version input', () => {
    expect(supportsDetachedSearchTab('ios', '')).toBe(false)
    expect(supportsDetachedSearchTab('ios', 'abc')).toBe(false)
    expect(supportsDetachedSearchTab('ios', 'v26')).toBe(false)
  })
})
