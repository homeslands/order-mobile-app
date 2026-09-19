/**
 * Luật phía app cho QR thanh toán xu (nhân viên tạo trên web thu ngân,
 * khách khác quét và trả bằng xu của mình).
 *
 * QR dựng theo kiểu VietQR/EMVCo (BE: `qr-payment/point-payment-qr.payload.ts`):
 * `000201` `010212` `38..` (00 `ORDER.POINT`, 01 mã) `54..` số xu `5802VN`
 * `62..` (01 slug đơn, 07 slug chi nhánh) `6304` CRC.
 *
 * App chỉ lọc sơ bộ để khỏi gọi mạng với QR lạ. CRC và đối chiếu dữ liệu là
 * việc của server — kiểm ở đây chỉ nhân đôi luật và dễ lệch.
 */
import type {
  IPointQrPayer,
  PointPaymentQrStatus,
} from '@/types/qr-payment.type'
import { maskPhone } from '@/utils/mask-identity'

/** Payload format "01" + point of initiation "12" (QR động). */
const PAYLOAD_PREFIX = '000201010212'
const GUID = 'ORDER.POINT'

/** Trả chuỗi đã cắt khoảng trắng, hoặc null nếu chắc chắn không phải QR xu. */
export function parsePointPaymentQr(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith(PAYLOAD_PREFIX)) return null
  if (!trimmed.includes(GUID)) return null
  return trimmed
}

export type PointQrErrorKind =
  | 'notFound'
  | 'alreadyPaid'
  | 'cancelled'
  | 'orderChanged'
  | 'missingData'
  | 'invalid'
  | 'mismatch'
  | 'insufficient'
  | 'unauthorized'
  | 'forbidden'
  | 'network'
  | 'unknown'

const ERROR_BY_CODE: Record<number, PointQrErrorKind> = {
  160206: 'notFound',
  160207: 'alreadyPaid',
  160208: 'cancelled',
  // Đơn không còn PENDING, payment bị thay, hoặc số tiền lệch (vd. chủ đơn
  // đổi số điểm dùng sau khi QR đã tạo).
  160209: 'orderChanged',
  160210: 'missingData',
  160212: 'invalid',
  // Cả khi đơn đã bị huỷ (tay hoặc hết hạn): BE so slug đơn với đơn đã
  // soft delete và ra mã này trước khi xét trạng thái QR.
  160213: 'mismatch',
  158205: 'insufficient',
}

type AxiosLikeError = {
  isAxiosError: true
  response?: { status: number; data?: { statusCode?: number } }
}

// Tương đương axios.isAxiosError, không kéo axios vào hàm thuần.
function isAxiosLike(error: unknown): error is AxiosLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { isAxiosError?: unknown }).isAxiosError === true
  )
}

export function classifyPointQrError(error: unknown): PointQrErrorKind {
  if (!isAxiosLike(error)) return 'unknown'
  // Không có response: request có thể đã tới server — xem màn xác nhận.
  if (!error.response) return 'network'
  const code = error.response.data?.statusCode
  if (code !== undefined && ERROR_BY_CODE[code]) return ERROR_BY_CODE[code]
  if (error.response.status === 401) return 'unauthorized'
  if (error.response.status === 403) return 'forbidden'
  return 'unknown'
}

export function previewOutcome(qr: {
  status: PointPaymentQrStatus
}): 'confirm' | 'alreadyPaid' | 'cancelled' {
  switch (qr.status) {
    case 'initiate':
      return 'confirm'
    case 'completed':
      return 'alreadyPaid'
    case 'cancelled':
      return 'cancelled'
  }
}

/** "Tên · ******7894", hoặc chỉ số đã che khi không có tên. */
export function formatPointQrPayer(payer: IPointQrPayer): string {
  const name = [payer.firstName, payer.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()
  const phone = maskPhone(payer.phonenumber)
  return name ? `${name} · ${phone}` : phone
}
