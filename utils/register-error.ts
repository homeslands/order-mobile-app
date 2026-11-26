export type RegisterErrorKind =
  | 'network'
  | 'otpInvalid'
  | 'otpExpired'
  | 'otpTooManyAttempts'
  | 'invalidPassword'
  | 'unknown'

export type RegisterError = { kind: RegisterErrorKind; code?: number }

// Mã lỗi BE (order-api, auth.validation.ts) cho /auth/register/*.
// 119047 TOKEN_NOT_FOUND: BE chỉ tìm token còn hạn, nên mã hết hạn cũng rơi vào đây.
// 119001 INVALID_PASSWORD: lỗi validate DTO, BE trả HTTP 422.
const KIND_BY_CODE: Record<number, RegisterErrorKind> = {
  119049: 'otpInvalid',
  119047: 'otpExpired',
  119048: 'otpExpired',
  119051: 'otpTooManyAttempts',
  119001: 'invalidPassword',
}

type AxiosLikeError = {
  isAxiosError: true
  response?: { status?: number; data?: { statusCode?: number } }
}

function isAxiosLike(error: unknown): error is AxiosLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { isAxiosError?: unknown }).isAxiosError === true
  )
}

/**
 * Phân loại lỗi đăng ký theo mã BE trả về. Chỉ coi là OTP sai khi BE nói rõ
 * (119049) — các lỗi 400/422 khác không được đoán thành OTP sai.
 */
export function classifyRegisterError(error: unknown): RegisterError {
  if (!isAxiosLike(error)) return { kind: 'unknown' }
  if (!error.response) return { kind: 'network' }
  const code = error.response.data?.statusCode ?? error.response.status
  if (code === undefined) return { kind: 'unknown' }
  return { kind: KIND_BY_CODE[code] ?? 'unknown', code }
}
