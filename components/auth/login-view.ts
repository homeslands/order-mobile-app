/**
 * Màn đăng nhập có 4 dạng:
 * - standard: chưa bật Face ID / vân tay — form số điện thoại + mật khẩu.
 * - greeting: đã bật — chào khách quen, một nút chính quét sinh trắc học.
 * - password: đã bật, khách chọn nhập mật khẩu — vẫn có nút quét lại.
 * - other: đã bật, khách đổi sang tài khoản khác — form trống + lối quay lại.
 */
export type LoginMode = 'greeting' | 'password' | 'other'
export type LoginView = 'standard' | LoginMode

export function getLoginView(isReturning: boolean, mode: LoginMode): LoginView {
  return isReturning ? mode : 'standard'
}

/** 0901234567 → "0901 ••• 567". Số ngắn bất thường thì để nguyên. */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return phone
  return `${phone.slice(0, 4)} ••• ${phone.slice(-3)}`
}
