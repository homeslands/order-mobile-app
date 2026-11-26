// Khoảng thêm dưới thanh nút đáy (Giỏ, Thanh toán, Chi tiết đơn / món…):
// máy có thanh home thì khoảng an toàn (34pt iPhone) đã đủ, chỉ thêm 8 — trước
// cộng 28 thành 62pt, nút cách đáy xa. Máy không có thanh home thêm 16.
function load(bottom: number) {
  jest.resetModules()
  jest.doMock('react-native-safe-area-context', () => ({
    initialWindowMetrics: {
      insets: { top: 47, bottom, left: 0, right: 0 },
      frame: { x: 0, y: 0, width: 390, height: 844 },
    },
  }))
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/constants/status-bar') as typeof import('@/constants/status-bar')
}

afterEach(() => {
  jest.dontMock('react-native-safe-area-context')
})

it('FB1 máy có thanh home (iPhone 34pt): thêm 8 → nút cách đáy 42', () => {
  const m = load(34)
  expect(m.FOOTER_BOTTOM_EXTRA).toBe(8)
  expect(m.STATIC_BOTTOM_INSET + m.FOOTER_BOTTOM_EXTRA).toBe(42)
})

it('FB2 Android thanh cử chỉ (24pt): thêm 8', () => {
  expect(load(24).FOOTER_BOTTOM_EXTRA).toBe(8)
})

it('FB3 không có thanh home (SE / Android nút cứng): thêm 16, không sát mép', () => {
  expect(load(0).FOOTER_BOTTOM_EXTRA).toBe(16)
})
