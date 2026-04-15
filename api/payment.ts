import { IApiResponse } from '@/types'
import { IQRGenerateResponse } from '@/types/qr-payment.type'
import { http } from '@/utils'

/**
 * Tạo mã QR thanh toán bằng xu (Customer).
 * Server lấy userId từ JWT — không cần body.
 * Token có TTL 60s, client nên gọi lại mỗi 55s để auto-refresh.
 */
export async function generatePaymentQR(): Promise<IApiResponse<IQRGenerateResponse>> {
  const response = await http.post<IApiResponse<IQRGenerateResponse>>('/payment/qr/generate')
  return response.data
}
