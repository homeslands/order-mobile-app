import { classifyRegisterError } from '@/utils/register-error'

// Dạng lỗi axios thật: BE (HttpExceptionFilter) trả `{ statusCode: <mã>, ... }`
// trong body, HTTP status 400 (AuthException) hoặc 422 (lỗi validate DTO).
function axiosError(status: number | null, statusCode?: number) {
  return {
    isAxiosError: true,
    response:
      status === null
        ? undefined
        : { status, data: statusCode ? { statusCode } : {} },
  }
}

describe('classifyRegisterError', () => {
  it('không có response (mất mạng, timeout) là lỗi mạng', () => {
    expect(classifyRegisterError(axiosError(null))).toEqual({
      kind: 'network',
    })
  })

  it('119049 REGISTER_OTP_INVALID là OTP sai', () => {
    expect(classifyRegisterError(axiosError(400, 119049))).toEqual({
      kind: 'otpInvalid',
      code: 119049,
    })
  })

  it.each([
    [119047, 'REGISTER_OTP_TOKEN_NOT_FOUND'],
    [119048, 'REGISTER_OTP_TOKEN_EXPIRED'],
  ])('%i (%s) là OTP hết hạn', (code) => {
    expect(classifyRegisterError(axiosError(400, code))).toEqual({
      kind: 'otpExpired',
      code,
    })
  })

  it('119051 REGISTER_OTP_MAX_ATTEMPTS_EXCEEDED là nhập sai quá số lần', () => {
    expect(classifyRegisterError(axiosError(400, 119051))).toEqual({
      kind: 'otpTooManyAttempts',
      code: 119051,
    })
  })

  it('119001 INVALID_PASSWORD (422 từ validate DTO) là mật khẩu bị từ chối', () => {
    expect(classifyRegisterError(axiosError(422, 119001))).toEqual({
      kind: 'invalidPassword',
      code: 119001,
    })
  })

  it('400/422 khác không bị đoán là OTP sai', () => {
    expect(classifyRegisterError(axiosError(400, 119052))).toEqual({
      kind: 'unknown',
      code: 119052,
    })
    expect(classifyRegisterError(axiosError(422, 119053))).toEqual({
      kind: 'unknown',
      code: 119053,
    })
    expect(classifyRegisterError(axiosError(400))).toEqual({
      kind: 'unknown',
      code: 400,
    })
  })

  it('lỗi server 5xx là khác, kèm mã để báo lỗi chung', () => {
    expect(classifyRegisterError(axiosError(500, 500))).toEqual({
      kind: 'unknown',
      code: 500,
    })
  })

  it('lỗi không phải axios là khác, không có mã', () => {
    expect(classifyRegisterError(new Error('boom'))).toEqual({
      kind: 'unknown',
    })
    expect(classifyRegisterError(undefined)).toEqual({ kind: 'unknown' })
  })
})
