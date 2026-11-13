/**
 * Đăng nhập bằng Face ID / Touch ID / vân tay.
 *
 * Số điện thoại + mật khẩu nằm trong SecureStore, khoá bằng sinh trắc học
 * của máy (`requireAuthentication`): iOS dùng `biometryCurrentSet` (không cho
 * mật mã máy thay thế), Android dùng khoá Keystore cần xác thực người dùng.
 * `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`: không theo bản sao lưu sang máy khác,
 * máy gỡ mật mã thì mục này mất.
 *
 * Máy thêm/đổi vân tay → hệ điều hành vô hiệu khoá, SecureStore đọc ra null.
 * Khách huỷ / quét sai → SecureStore ném lỗi. Hai trường hợp xử lý khác nhau:
 * null thì tắt hẳn, lỗi thì giữ nguyên.
 *
 * Số điện thoại lưu thêm một bản không khoá — không phải bí mật — để màn
 * đăng nhập biết tính năng đang bật và điền sẵn số mà chưa cần quét.
 */
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const CREDENTIALS_KEY = 'biometric-credentials'
const PHONE_KEY = 'biometric-phone'

export type BiometricType = 'face' | 'fingerprint'

export type BiometricReadResult =
  | { status: 'ok'; phonenumber: string; password: string }
  | { status: 'cancelled' }
  | { status: 'invalidated' }

export async function getBiometricType(): Promise<BiometricType | null> {
  if (Platform.OS === 'web') return null
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ])
    if (!hasHardware || !isEnrolled) return null
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
    if (Platform.OS === 'android') {
      // SecureStore (Keystore) chỉ nhận sinh trắc học mức mạnh. Khuôn mặt của
      // Samsung và nhiều hãng là mức yếu: máy chỉ cài khuôn mặt thì bật
      // không được, nên coi như không hỗ trợ. Có cảm biến vân tay thì đó là
      // thứ Android sẽ hỏi, nên gọi là vân tay.
      const level = await LocalAuthentication.getEnrolledLevelAsync()
      if (level < LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) {
        return null
      }
      return types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ? 'fingerprint'
        : 'face'
    }
    return types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    )
      ? 'face'
      : 'fingerprint'
  } catch {
    return null
  }
}

/** Khoá i18n (namespace auth) cho tên gọi: iPhone dùng tên của Apple. */
export function biometricLabelKey(type: BiometricType): string {
  const ios = Platform.OS === 'ios'
  if (type === 'face') return ios ? 'biometric.faceId' : 'biometric.face'
  return ios ? 'biometric.touchId' : 'biometric.fingerprint'
}

export async function getEnabledPhone(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PHONE_KEY)
  } catch {
    return null
  }
}

/** Trả false nếu không lưu được (khách huỷ hộp xác thực trên Android, máy
 *  không có mật mã…). Ghi mật khẩu trước, số sau: số chỉ tồn tại khi mật
 *  khẩu đã lưu xong. */
export async function enableBiometricLogin(
  phonenumber: string,
  password: string,
  authenticationPrompt: string,
): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(
      CREDENTIALS_KEY,
      JSON.stringify({ phonenumber, password }),
      {
        requireAuthentication: true,
        authenticationPrompt,
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      },
    )
    await SecureStore.setItemAsync(PHONE_KEY, phonenumber)
    return true
  } catch {
    await disableBiometricLogin()
    return false
  }
}

export async function disableBiometricLogin(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(CREDENTIALS_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(PHONE_KEY).catch(() => {}),
  ])
}

export async function readBiometricCredentials(
  authenticationPrompt: string,
): Promise<BiometricReadResult> {
  let raw: string | null
  try {
    raw = await SecureStore.getItemAsync(CREDENTIALS_KEY, {
      requireAuthentication: true,
      authenticationPrompt,
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    })
  } catch {
    return { status: 'cancelled' }
  }
  try {
    const parsed = (raw ? JSON.parse(raw) : null) as {
      phonenumber?: unknown
      password?: unknown
    } | null
    const phonenumber = parsed?.phonenumber
    const password = parsed?.password
    if (typeof phonenumber === 'string' && typeof password === 'string') {
      return { status: 'ok', phonenumber, password }
    }
  } catch {
    // Dữ liệu hỏng: coi như mất hiệu lực.
  }
  await disableBiometricLogin()
  return { status: 'invalidated' }
}

/** Server đã trả lời và từ chối thông tin đăng nhập (mật khẩu đổi ở nơi khác,
 *  tài khoản bị khoá/xoá) thì mật khẩu đã lưu vô dụng → tắt. Mất mạng, lỗi
 *  server hay bị giới hạn tần suất thì giữ để thử lại sau. */
export function shouldDisableAfterLoginError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response
    ?.status
  return status === 400 || status === 401 || status === 403 || status === 404
}
