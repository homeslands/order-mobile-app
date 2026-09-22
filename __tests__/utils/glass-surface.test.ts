import { glassTintColor } from '@/utils/glass-surface'

describe('glassTintColor', () => {
  it('không truyền tint thì không pha màu — để UIGlassEffect tự bám theo lựa chọn Clear/Tinted của hệ thống', () => {
    expect(glassTintColor()).toBeUndefined()
    expect(glassTintColor(undefined)).toBeUndefined()
  })

  it('có tint thì pha màu thương hiệu ở độ đục cố định', () => {
    expect(glassTintColor('#F7A737')).toBe('rgba(247, 167, 55, 0.5)')
  })

  it('độ đục không đổi theo màu — đây là hằng số thiết kế, không phải núm chỉnh', () => {
    expect(glassTintColor('#ffffff')).toBe('rgba(255, 255, 255, 0.5)')
    expect(glassTintColor('#1c1c1e')).toBe('rgba(28, 28, 30, 0.5)')
  })
})
