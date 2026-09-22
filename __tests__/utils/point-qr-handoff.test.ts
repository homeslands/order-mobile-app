import { markPointQrScanned, wasPointQrScanned } from '@/utils/point-qr-handoff'

describe('point QR handoff', () => {
  it('chỉ nhận mã đã được màn quét đánh dấu', () => {
    expect(wasPointQrScanned('A')).toBe(false)
    markPointQrScanned('A')
    expect(wasPointQrScanned('A')).toBe(true)
    expect(wasPointQrScanned('B')).toBe(false)
  })

  it('đọc lại nhiều lần vẫn đúng (màn xác nhận có thể mount lại)', () => {
    markPointQrScanned('C')
    expect(wasPointQrScanned('C')).toBe(true)
    expect(wasPointQrScanned('C')).toBe(true)
  })

  it('từ chối giá trị rỗng', () => {
    expect(wasPointQrScanned(undefined)).toBe(false)
    expect(wasPointQrScanned('')).toBe(false)
  })
})
