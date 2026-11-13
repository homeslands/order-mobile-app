// Đăng nhập bằng Face ID / vân tay: số điện thoại + mật khẩu nằm trong
// SecureStore, khoá bằng sinh trắc học của máy (requireAuthentication). Máy
// thêm/đổi vân tay thì hệ điều hành làm mục đó mất hiệu lực và đọc ra null —
// phải phân biệt với khách huỷ (ném lỗi) để không xoá nhầm.
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

import {
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricType,
  getEnabledPhone,
  readBiometricCredentials,
  shouldDisableAfterLoginError,
} from '@/lib/biometric-login'

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    __store: store,
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 6,
    AFTER_FIRST_UNLOCK: 0,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v)
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k)
    }),
  }
})

jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(async () => 3),
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  supportedAuthenticationTypesAsync: jest.fn(async () => [2]),
}))

const store = (SecureStore as unknown as { __store: Map<string, string> })
  .__store
const getItem = SecureStore.getItemAsync as jest.Mock

beforeEach(() => {
  store.clear()
  jest.clearAllMocks()
})

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('BL1 bật: mật khẩu khoá bằng sinh trắc học, chỉ trên máy này', async () => {
  await enableBiometricLogin('0901234567', 'secret', 'prompt')
  const call = (SecureStore.setItemAsync as jest.Mock).mock.calls.find(
    ([, v]) => String(v).includes('secret'),
  )
  expect(call?.[2]).toMatchObject({
    requireAuthentication: true,
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  })
  expect(await getEnabledPhone()).toBe('0901234567')
})

it('BL2 đọc thành công trả đúng số và mật khẩu', async () => {
  await enableBiometricLogin('0901234567', 'secret', 'prompt')
  expect(await readBiometricCredentials('prompt')).toEqual({
    status: 'ok',
    phonenumber: '0901234567',
    password: 'secret',
  })
})

it('BL3 đọc ra null khi đang bật nghĩa là vân tay đổi: tự tắt', async () => {
  await enableBiometricLogin('0901234567', 'secret', 'prompt')
  getItem.mockImplementation(async (k: string) =>
    k.includes('credentials') ? null : (store.get(k) ?? null),
  )
  expect(await readBiometricCredentials('prompt')).toEqual({
    status: 'invalidated',
  })
  getItem.mockImplementation(async (k: string) => store.get(k) ?? null)
  expect(await getEnabledPhone()).toBeNull()
})

it('BL4 khách huỷ hoặc quét sai: không xoá gì', async () => {
  await enableBiometricLogin('0901234567', 'secret', 'prompt')
  getItem.mockImplementationOnce(async () => {
    throw new Error('User canceled')
  })
  expect(await readBiometricCredentials('prompt')).toEqual({
    status: 'cancelled',
  })
  expect(await getEnabledPhone()).toBe('0901234567')
})

it('BL5 tắt xoá cả mật khẩu lẫn số điện thoại', async () => {
  await enableBiometricLogin('0901234567', 'secret', 'prompt')
  await disableBiometricLogin()
  expect(store.size).toBe(0)
})

it('BL6 máy chưa cài sinh trắc học thì không có loại nào', async () => {
  ;(LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(
    false,
  )
  expect(await getBiometricType()).toBeNull()
  expect(await getBiometricType()).toBe('face')
})

it('BL7 chỉ tắt khi server từ chối (4xx), không tắt khi mất mạng/5xx', () => {
  expect(shouldDisableAfterLoginError({ response: { status: 401 } })).toBe(true)
  expect(shouldDisableAfterLoginError({ response: { status: 400 } })).toBe(true)
  expect(shouldDisableAfterLoginError({ response: { status: 500 } })).toBe(
    false,
  )
  expect(shouldDisableAfterLoginError({ response: { status: 429 } })).toBe(
    false,
  )
  expect(shouldDisableAfterLoginError(new Error('Network Error'))).toBe(false)
})

// Android chỉ cho mở khoá dữ liệu (Keystore, SecureStore requireAuthentication)
// bằng sinh trắc học mức MẠNH. Khuôn mặt của Samsung là mức yếu: máy chỉ cài
// khuôn mặt thì app từng mời bật "face unlock", bật thất bại không báo gì.
describe('Android', () => {
  const originalOS = Platform.OS
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    })
  })
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    })
  })

  it('BL8 chỉ cài sinh trắc học mức yếu (khuôn mặt Samsung) thì không hỗ trợ', async () => {
    ;(
      LocalAuthentication.getEnrolledLevelAsync as jest.Mock
    ).mockResolvedValueOnce(2)
    ;(
      LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock
    ).mockResolvedValueOnce([1, 2])
    expect(await getBiometricType()).toBeNull()
  })

  it('BL9 có cả vân tay lẫn khuôn mặt thì gọi là vân tay', async () => {
    ;(
      LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock
    ).mockResolvedValueOnce([1, 2])
    expect(await getBiometricType()).toBe('fingerprint')
  })
})
