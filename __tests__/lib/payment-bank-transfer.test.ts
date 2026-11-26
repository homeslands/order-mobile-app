// Màn thanh toán đơn, phần chuyển khoản. Trước đây:
// - Đổi voucher / điểm sau khi đã có QR: số tiền in bên cạnh đổi, QR vẫn là
//   ảnh cũ → khách chuyển sai số, đơn không tự xác nhận.
// - Mở lại đơn đang chờ chuyển khoản: nút báo "Chưa chọn phương thức", không
//   tự kiểm tra đã trả chưa.
// - Hết hạn: QR vẫn hiện, banner bảo tạo đơn mới mà không có nút đi tới.
import { PaymentMethod } from '@/constants'
import { getBankTransferState } from '@/lib/payment-bank-transfer'

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

const base = {
  selectedMethod: null,
  serverMethod: undefined,
  localQr: null,
  serverQr: undefined,
  qrStale: false,
  isExpired: false,
}

it('BT1 chưa chọn gì, server chưa có thanh toán: chọn phương thức', () => {
  expect(getBankTransferState(base)).toMatchObject({
    effectiveMethod: null,
    qr: null,
    button: 'noMethod',
  })
})

it('BT2 mở lại đơn đang chờ chuyển khoản: nhận phương thức của server, hiện QR, nút kiểm tra', () => {
  expect(
    getBankTransferState({
      ...base,
      serverMethod: PaymentMethod.BANK_TRANSFER,
      serverQr: 'https://qr/server',
    }),
  ).toMatchObject({
    effectiveMethod: PaymentMethod.BANK_TRANSFER,
    qr: 'https://qr/server',
    awaitingTransfer: true,
    button: 'check',
  })
})

it('BT3 QR của server được ưu tiên hơn QR giữ tạm trong máy', () => {
  expect(
    getBankTransferState({
      ...base,
      selectedMethod: PaymentMethod.BANK_TRANSFER,
      localQr: 'https://qr/local-old',
      serverQr: 'https://qr/server-new',
    }).qr,
  ).toBe('https://qr/server-new')
})

it('BT4 vừa tạo QR, server chưa trả về: dùng QR giữ tạm', () => {
  expect(
    getBankTransferState({
      ...base,
      selectedMethod: PaymentMethod.BANK_TRANSFER,
      localQr: 'https://qr/local',
    }),
  ).toMatchObject({ qr: 'https://qr/local', button: 'check' })
})

it('BT5 đổi voucher/điểm sau khi có QR: ẩn QR, nút tạo lại QR', () => {
  expect(
    getBankTransferState({
      ...base,
      selectedMethod: PaymentMethod.BANK_TRANSFER,
      serverQr: 'https://qr/server',
      qrStale: true,
    }),
  ).toMatchObject({ qr: null, awaitingTransfer: false, button: 'regenerate' })
})

it('BT6 hết hạn: ẩn QR, nút hết hạn', () => {
  expect(
    getBankTransferState({
      ...base,
      serverMethod: PaymentMethod.BANK_TRANSFER,
      serverQr: 'https://qr/server',
      isExpired: true,
    }),
  ).toMatchObject({ qr: null, awaitingTransfer: false, button: 'expired' })
})

it('BT7 chọn chuyển khoản nhưng chưa bấm thanh toán: nút thanh toán', () => {
  expect(
    getBankTransferState({
      ...base,
      selectedMethod: PaymentMethod.BANK_TRANSFER,
    }),
  ).toMatchObject({ qr: null, button: 'pay' })
})

it('BT8 khách đổi sang Xu dù server đang chờ chuyển khoản: không hiện QR, nút thanh toán', () => {
  expect(
    getBankTransferState({
      ...base,
      selectedMethod: PaymentMethod.POINT,
      serverMethod: PaymentMethod.BANK_TRANSFER,
      serverQr: 'https://qr/server',
    }),
  ).toMatchObject({
    effectiveMethod: PaymentMethod.POINT,
    qr: null,
    awaitingTransfer: false,
    button: 'pay',
  })
})
