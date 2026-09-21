import { glassTint } from '@/utils/glass-surface'

describe('glassTint', () => {
  it('mức 1 là kính nguyên bản, không pha màu', () => {
    expect(glassTint('#ffffff', 1)).toBeUndefined()
    expect(glassTint('#ffffff', 1.5)).toBeUndefined()
  })

  it('mức giữa pha chính màu nền với độ đục 1 - level', () => {
    expect(glassTint('#ffffff', 0.75)).toBe('rgba(255, 255, 255, 0.25)')
    expect(glassTint('#1c1c1e', 0.5)).toBe('rgba(28, 28, 30, 0.5)')
  })

  it('tintOverride thay màu pha, giữ nguyên độ đục', () => {
    expect(glassTint('#ffffff', 0.4, '#F7A737')).toBe('rgba(247, 167, 55, 0.6)')
  })

  it('mức 0 trả về màu nền đặc, bên gọi không dựng kính', () => {
    expect(glassTint('#ffffff', 0)).toBe('rgba(255, 255, 255, 1)')
  })

  it('làm tròn độ đục về 2 chữ số để tránh rgba dài dòng', () => {
    expect(glassTint('#ffffff', 0.333)).toBe('rgba(255, 255, 255, 0.67)')
  })

  it('có tintOverride thì không bao giờ xuống dưới TINT_FLOOR, kể cả ở mức 1', () => {
    expect(glassTint('#ffffff', 1, '#F7A737')).toBe('rgba(247, 167, 55, 0.5)')
  })

  it('có tintOverride giữ floor ở mức cao gần 1 (0.8)', () => {
    expect(glassTint('#ffffff', 0.8, '#F7A737')).toBe('rgba(247, 167, 55, 0.5)')
  })

  it('tintOverride bằng color vẫn được floor như mọi tintOverride khác', () => {
    expect(glassTint('#ffffff', 1, '#ffffff')).toBe('rgba(255, 255, 255, 0.5)')
    expect(glassTint('#ffffff', 0.3, '#ffffff')).toBe(
      'rgba(255, 255, 255, 0.7)',
    )
  })

  it('không có tintOverride thì mức 1 vẫn là kính nguyên bản, không pha màu', () => {
    expect(glassTint('#ffffff', 1)).toBeUndefined()
  })
})
