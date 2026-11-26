// Xu và Điểm tích luỹ là hai thứ khác nhau, nằm cạnh nhau trên cùng màn:
//   - Xu: đến từ thẻ quà tặng, là phương thức thanh toán PaymentMethod.POINT.
//   - Điểm tích luỹ: đơn hàng nào cũng được cộng.
// Nhãn phương thức "point" từng ghi "Điểm tích lũy" (sheet báo voucher xung
// đột, banner lọc voucher, điều kiện voucher) và onboarding nói đơn hàng tích
// xu — khách hiểu sai. Khoá lại để không bị đổi ngược.
import enOnboarding from '@/i18n/en/onboarding.json'
import enPayment from '@/i18n/en/payment.json'
import enVoucher from '@/i18n/en/voucher.json'
import viOnboarding from '@/i18n/vi/onboarding.json'
import viPayment from '@/i18n/vi/payment.json'
import viVoucher from '@/i18n/vi/voucher.json'

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('CW1 phương thức thanh toán "point" là Xu, không phải Điểm tích luỹ', () => {
  expect(viPayment.voucherSheet.paymentMethod.point).toBe('Xu')
  expect(enPayment.voucherSheet.paymentMethod.point).toBe('Coins')
  expect(viVoucher.voucher.paymentMethod.point).toBe('Xu')
  expect(enVoucher.voucher.paymentMethod.point).toBe('Coins')
})

it('CW2 onboarding: đơn hàng tích ĐIỂM, không tích xu', () => {
  expect(viOnboarding.slide2Desc).not.toMatch(/xu/i)
  expect(viOnboarding.slide2Desc).toMatch(/tích điểm/i)
  expect(enOnboarding.slide2Desc).not.toMatch(/coin/i)
  expect(enOnboarding.slide2Desc).toMatch(/points/i)
})
