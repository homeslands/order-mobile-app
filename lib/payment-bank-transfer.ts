/**
 * Trạng thái hiển thị phần chuyển khoản ở màn thanh toán đơn (app/payment/[order]).
 *
 * Gom các quyết định về một chỗ để màn hình không tự mâu thuẫn:
 * - Phương thức: khách chọn trong lần mở màn này, không thì lấy của server
 *   (mở lại đơn đang chờ chuyển khoản từ lịch sử).
 * - QR: ưu tiên QR của server; QR giữ tạm trong máy chỉ để hiện ngay sau khi
 *   tạo, trước khi tải lại đơn.
 * - QR cũ: khách đổi voucher / điểm / phương thức sau khi đã có QR thì tổng
 *   tiền khác số tiền trong QR → ẩn QR, bắt tạo lại.
 * - Hết hạn: ẩn QR.
 */
import { PaymentMethod } from '@/constants'

export type PayButtonMode =
  | 'noMethod' // chưa chọn phương thức
  | 'pay' // tạo thanh toán
  | 'check' // đang chờ chuyển khoản: kiểm tra đã nhận tiền chưa
  | 'regenerate' // tổng tiền đã đổi: tạo lại mã QR
  | 'expired'

export interface BankTransferInput {
  /** Phương thức khách chọn trong lần mở màn này. */
  selectedMethod: PaymentMethod | null
  /** Phương thức của thanh toán server đang giữ (order.payment.paymentMethod). */
  serverMethod: PaymentMethod | string | undefined
  /** QR nhận được ngay khi tạo thanh toán, trước khi tải lại đơn. */
  localQr: string | null
  /** QR server đang giữ (order.payment.qrCode). */
  serverQr: string | undefined
  /** Khách đã đổi voucher / điểm / phương thức sau khi có QR. */
  qrStale: boolean
  isExpired: boolean
}

export interface BankTransferState {
  effectiveMethod: PaymentMethod | null
  /** QR đang hợp lệ để hiện, null thì không hiện. */
  qr: string | null
  /** Đã có QR hợp lệ, đang chờ khách chuyển khoản. */
  awaitingTransfer: boolean
  button: PayButtonMode
}

export function getBankTransferState({
  selectedMethod,
  serverMethod,
  localQr,
  serverQr,
  qrStale,
  isExpired,
}: BankTransferInput): BankTransferState {
  const effectiveMethod =
    selectedMethod ?? (serverMethod ? (serverMethod as PaymentMethod) : null)
  const isBankTransfer = effectiveMethod === PaymentMethod.BANK_TRANSFER
  const qr =
    isBankTransfer && !qrStale && !isExpired
      ? serverQr || localQr || null
      : null

  let button: PayButtonMode
  if (isExpired) button = 'expired'
  else if (!effectiveMethod) button = 'noMethod'
  else if (isBankTransfer && qrStale) button = 'regenerate'
  else if (qr) button = 'check'
  else button = 'pay'

  return { effectiveMethod, qr, awaitingTransfer: qr !== null, button }
}
