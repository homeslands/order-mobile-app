export interface IQRGenerateResponse {
  /** rawToken 64 ký tự hex — nội dung của QR code, FE tự render */
  token: string
  /** ISO 8601 — thời điểm token hết hạn (TTL 60s) */
  expiresAt: string
}

export type PointPaymentQrStatus = 'initiate' | 'completed' | 'cancelled'

/**
 * Response của GET /payment/qr/point và POST /payment/qr/point/pay.
 * API xem trước KHÔNG báo lỗi khi QR đã trả hoặc đã huỷ — nó trả `status`.
 */
export interface IPointPaymentQr {
  slug: string
  /** Mã 64 ký tự hex của QR, không phải mã đơn hiển thị cho khách. */
  code: string
  /** Số xu = order.subtotal lúc tạo QR. */
  amount: number
  status: PointPaymentQrStatus
  orderSlug: string
  branchName?: string
  /** Chỉ có khi status = completed. */
  paidAt?: string
  createdAt: string
}

export interface IPointQrPayer {
  slug: string
  /** BE trả số đầy đủ — luôn che bằng `maskPhone` trước khi hiện. */
  phonenumber: string
  firstName?: string
  lastName?: string
}

/** `payment.pointPaymentQr` trong GET /orders/{slug}. */
export interface IPaymentPointQr {
  status: PointPaymentQrStatus
  paidAt?: string
  paidBy?: IPointQrPayer
}
