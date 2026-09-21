import { useGlassStore } from '@/stores/glass.store'

describe('useGlassStore', () => {
  beforeEach(() => {
    useGlassStore.setState({ level: 1 })
  })

  it('mặc định là kính nguyên bản', () => {
    expect(useGlassStore.getState().level).toBe(1)
  })

  it('lưu mức người dùng chọn', () => {
    useGlassStore.getState().setLevel(0.4)
    expect(useGlassStore.getState().level).toBe(0.4)
  })

  it('kẹp giá trị ngoài khoảng về 0 và 1', () => {
    useGlassStore.getState().setLevel(1.8)
    expect(useGlassStore.getState().level).toBe(1)
    useGlassStore.getState().setLevel(-0.5)
    expect(useGlassStore.getState().level).toBe(0)
  })

  it('bỏ qua giá trị không phải số (dữ liệu lưu cũ hỏng)', () => {
    useGlassStore.getState().setLevel(Number.NaN)
    expect(useGlassStore.getState().level).toBe(1)
  })
})
