import { IApiResponse } from '@/types'
import { IPointPaymentQr, IQRGenerateResponse } from '@/types/qr-payment.type'
import { http } from '@/utils'

/**
 * Tạo mã QR thanh toán bằng xu (Customer).
 * Server lấy userId từ JWT — không cần body.
 * Token có TTL 60s, client nên gọi lại mỗi 55s để auto-refresh.
 */
export async function generatePaymentQR(): Promise<
  IApiResponse<IQRGenerateResponse>
> {
  const response = await http.post<IApiResponse<IQRGenerateResponse>>(
    '/payment/qr/generate',
  )
  return response.data
}

/**
 * Xem trước QR xu vừa quét (Customer). Không báo lỗi khi QR đã trả hoặc đã
 * huỷ — đọc `status`. Ném 160206/160212/160213 khi mã lạ, hỏng, lệch đơn.
 */
export async function getPointPaymentQr(
  qrData: string,
): Promise<IApiResponse<IPointPaymentQr>> {
  const response = await http.get<IApiResponse<IPointPaymentQr>>(
    '/payment/qr/point',
    { params: { qrData } },
  )
  return response.data
}

/** Trả đơn bằng xu của người đang đăng nhập (Customer). */
export async function payPointPaymentQr(
  qrData: string,
): Promise<IApiResponse<IPointPaymentQr>> {
  const response = await http.post<IApiResponse<IPointPaymentQr>>(
    '/payment/qr/point/pay',
    { qrData },
  )
  return response.data
}
