// Thẻ vé không còn hiện phương thức thanh toán, nên sheet Điều kiện là nơi
// duy nhất khách biết trước mã chỉ dùng được với cách trả nào — thay vì tới
// màn thanh toán mới thấy vài phương thức bị khoá.
import { formatVoucherPaymentMethods } from '@/components/sheet/voucher-validation'
import type { IVoucher } from '@/types'

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

const t = (k: string) => `[${k}]`

const withMethods = (...methods: string[]) =>
  ({
    voucherPaymentMethods: methods.map((paymentMethod) => ({ paymentMethod })),
  }) as unknown as IVoucher

it('PM1 liệt kê đủ tên các phương thức theo thứ tự admin đặt', () => {
  expect(
    formatVoucherPaymentMethods(withMethods('bank-transfer', 'cash'), t),
  ).toBe('[paymentMethod.bankTransfer], [paymentMethod.cash]')
})

it('PM2 đủ bốn loại phương thức', () => {
  expect(
    formatVoucherPaymentMethods(
      withMethods('cash', 'point', 'bank-transfer', 'credit-card'),
      t,
    ),
  ).toBe(
    '[paymentMethod.cash], [paymentMethod.point], [paymentMethod.bankTransfer], [paymentMethod.creditCard]',
  )
})

it('PM3 voucher không giới hạn phương thức thì không có dòng', () => {
  expect(formatVoucherPaymentMethods(withMethods(), t)).toBe('')
  expect(
    formatVoucherPaymentMethods(
      { voucherPaymentMethods: undefined } as unknown as IVoucher,
      t,
    ),
  ).toBe('')
})

it('PM4 phương thức lạ từ BE thì giữ nguyên mã, không mất', () => {
  expect(formatVoucherPaymentMethods(withMethods('momo'), t)).toBe('momo')
})
