// Màn đăng nhập khi máy đã bật Face ID / vân tay (phương án C):
// - Chào khách quen: một nút chính "Đăng nhập bằng …", link sang mật khẩu.
// - Đang nhập mật khẩu: có nút "Dùng …" quét lại ngay một chạm.
// - Tài khoản khác: form trống, có lối quay lại số đã bật.
// Không bao giờ tự quét: Face ID nhận mặt gần như tức thì, khách không kịp
// huỷ để đăng nhập tài khoản khác.
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import LoginForm from '@/components/auth/login-form'
import { maskPhone } from '@/components/auth/login-view'

jest.mock('@/components/ui', () => ({ Input: () => null }))
jest.mock('expo-haptics', () => ({
  impactAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: { Light: 'light' },
}))
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return
  return require('react-native-reanimated/mock')
})
const mockMutate = jest.fn()
jest.mock('@/hooks', () => ({
  useLogin: () => ({ mutate: mockMutate, isPending: false }),
  usePostAuthActions: () => ({ handleAuthSuccess: jest.fn() }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access
  useZodForm: require('@/hooks/use-zod-form').useZodForm,
}))
jest.mock('@/lib/navigation', () => ({
  navigateWhenUnlocked: { push: jest.fn() },
}))
const mockShowToast = jest.fn()
jest.mock('@/utils', () => ({
  showErrorToastMessage: jest.fn(),
  showToast: (...args: unknown[]) => mockShowToast(...args),
}))

const mockRead = jest.fn(
  async (): Promise<unknown> => ({ status: 'cancelled' }),
)
const mockEnabledPhone = jest.fn(async (): Promise<string | null> => null)
const mockDisable = jest.fn()
jest.mock('@/lib/biometric-login', () => {
  const actual = jest.requireActual<typeof import('@/lib/biometric-login')>(
    '@/lib/biometric-login',
  )
  return {
    biometricLabelKey: () => 'biometric.faceId',
    classifyLoginError: actual.classifyLoginError,
    disableBiometricLogin: () => mockDisable(),
    enableBiometricLogin: jest.fn(),
    getBiometricType: async () => 'face',
    getEnabledPhone: () => mockEnabledPhone(),
    readBiometricCredentials: (...args: unknown[]) => mockRead(...(args as [])),
    shouldDisableAfterLoginError: actual.shouldDisableAfterLoginError,
  }
})

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })

beforeEach(() => {
  mockRead.mockReset()
  mockRead.mockResolvedValue({ status: 'cancelled' })
  mockMutate.mockReset()
  mockShowToast.mockClear()
  mockDisable.mockClear()
  mockEnabledPhone.mockReset()
  mockEnabledPhone.mockResolvedValue('0901234567')
})

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('RU0 che số điện thoại: giữ 4 số đầu, 3 số cuối', () => {
  expect(maskPhone('0901234567')).toBe('0901 ••• 567')
  expect(maskPhone('12345')).toBe('12345')
})

it('RU1 đã bật: màn chào khách quen, một nút chính, không có ô mật khẩu, không tự quét', async () => {
  render(<LoginForm />)
  await screen.findByTestId('login-greeting')
  expect(screen.getByText('login.welcomeBack')).toBeTruthy()
  expect(screen.getByText('0901 ••• 567')).toBeTruthy()
  expect(screen.getByTestId('biometric-login-button')).toBeTruthy()
  expect(screen.queryByPlaceholderText('login.enterPassword')).toBeNull()
  await flush()
  expect(mockRead).not.toHaveBeenCalled()
})

it('RU2 bấm nút chính thì quét đúng một lần', async () => {
  render(<LoginForm />)
  await screen.findByTestId('biometric-login-button')
  await act(async () => {
    fireEvent.press(screen.getByTestId('biometric-login-button'))
  })
  await waitFor(() => expect(mockRead).toHaveBeenCalledTimes(1))
})

it('RU3 sang mật khẩu: hiện ô mật khẩu và nút "Dùng …" quét lại một chạm', async () => {
  render(<LoginForm />)
  await screen.findByTestId('use-password-button')
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-password-button'))
  })
  expect(screen.getByPlaceholderText('login.enterPassword')).toBeTruthy()
  expect(screen.getByText('0901 ••• 567')).toBeTruthy()
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-biometric-button'))
  })
  await waitFor(() => expect(mockRead).toHaveBeenCalledTimes(1))
})

it('RU4 đang nhập mật khẩu mà huỷ quét thì về màn chào', async () => {
  render(<LoginForm />)
  await screen.findByTestId('use-password-button')
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-password-button'))
  })
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-biometric-button'))
  })
  await waitFor(() =>
    expect(screen.queryByPlaceholderText('login.enterPassword')).toBeNull(),
  )
  expect(screen.getByTestId('login-greeting')).toBeTruthy()
})

it('RU5 bấm "Đổi": form trống cho số khác, có lối quay lại', async () => {
  const onReturning = jest.fn()
  render(<LoginForm onReturningUserChange={onReturning} />)
  await screen.findByTestId('change-account-button')
  expect(onReturning).toHaveBeenLastCalledWith(true)

  await act(async () => {
    fireEvent.press(screen.getByTestId('change-account-button'))
  })
  const phone = screen.getByPlaceholderText('login.enterPhoneNumber')
  expect(phone.props.value).toBe('')
  expect(screen.queryByTestId('biometric-login-button')).toBeNull()
  expect(onReturning).toHaveBeenLastCalledWith(false)

  await act(async () => {
    fireEvent.press(screen.getByTestId('back-to-greeting'))
  })
  expect(screen.getByTestId('login-greeting')).toBeTruthy()
  expect(onReturning).toHaveBeenLastCalledWith(true)
})

it('RU6 link "Đăng nhập tài khoản khác" cũng sang form trống', async () => {
  render(<LoginForm />)
  await screen.findByTestId('other-account-link')
  await act(async () => {
    fireEvent.press(screen.getByTestId('other-account-link'))
  })
  expect(
    screen.getByPlaceholderText('login.enterPhoneNumber').props.value,
  ).toBe('')
  expect(screen.getByTestId('back-to-greeting')).toBeTruthy()
})

it('RU7 chưa bật: form thường, không có màn chào', async () => {
  mockEnabledPhone.mockResolvedValue(null)
  render(<LoginForm />)
  await flush()
  expect(screen.queryByTestId('login-greeting')).toBeNull()
  expect(screen.getByPlaceholderText('login.enterPhoneNumber')).toBeTruthy()
  expect(screen.getByPlaceholderText('login.enterPassword')).toBeTruthy()
  expect(screen.queryByTestId('back-to-greeting')).toBeNull()
  expect(mockRead).not.toHaveBeenCalled()
})

// Màn nhập mật khẩu chỉ báo lỗi sau khi khách bấm Đăng nhập. Trên iOS, hộp
// Face ID làm ô mật khẩu được focus rồi mất focus ngoài ý khách (xem RU12) —
// nếu báo lỗi theo mất focus thì ô viền đỏ "bắt buộc" giữa lúc đang quét.
it('RU9 ô mật khẩu trống mất focus: không viền đỏ; bấm Đăng nhập mới báo', async () => {
  render(<LoginForm />)
  await screen.findByTestId('use-password-button')
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-password-button'))
  })
  await act(async () => {
    fireEvent(screen.getByPlaceholderText('login.enterPassword'), 'blur')
  })
  await flush()
  expect(
    screen.getByPlaceholderText('login.enterPassword').props.className,
  ).not.toContain('border-destructive')

  await act(async () => {
    fireEvent.press(screen.getByText('login.login'))
  })
  await waitFor(() =>
    expect(
      screen.getByPlaceholderText('login.enterPassword').props.className,
    ).toContain('border-destructive'),
  )
  expect(mockMutate).not.toHaveBeenCalled()
})

// autoFocus trên iOS chạy lại khi cửa sổ được kích hoạt lại — hộp Face ID
// làm việc đó, nên bàn phím bật giữa lúc quét (quay video trên iPhone 12).
it('RU13 đã bấm Đăng nhập (sai) rồi đổi màn và quay lại: ô mật khẩu không còn đỏ', async () => {
  render(<LoginForm />)
  await screen.findByTestId('use-password-button')
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-password-button'))
  })
  await act(async () => {
    fireEvent.press(screen.getByText('login.login'))
  })
  await waitFor(() =>
    expect(
      screen.getByPlaceholderText('login.enterPassword').props.className,
    ).toContain('border-destructive'),
  )
  // Huỷ quét → màn chào → vào lại màn mật khẩu → ô mất focus.
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-biometric-button'))
  })
  await screen.findByTestId('login-greeting')
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-password-button'))
  })
  await act(async () => {
    fireEvent(screen.getByPlaceholderText('login.enterPassword'), 'blur')
  })
  await flush()
  expect(
    screen.getByPlaceholderText('login.enterPassword').props.className,
  ).not.toContain('border-destructive')
})

it('RU12 không ô nào tự focus', async () => {
  render(<LoginForm />)
  await screen.findByTestId('use-password-button')
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-password-button'))
  })
  expect(
    screen.getByPlaceholderText('login.enterPassword').props.autoFocus,
  ).toBeFalsy()
  await act(async () => {
    fireEvent.press(screen.getByTestId('change-account-button'))
  })
  expect(
    screen.getByPlaceholderText('login.enterPhoneNumber').props.autoFocus,
  ).toBeFalsy()
})

it('RU11 trong lúc hộp Face ID đang hiện, ô mật khẩu không viền đỏ', async () => {
  let finishScan: (value: unknown) => void = () => {}
  mockRead.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishScan = resolve
      }),
  )
  render(<LoginForm />)
  await screen.findByTestId('use-password-button')
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-password-button'))
  })
  // Bấm "Dùng Face ID" → hộp xác thực bật lên → ô mật khẩu mất focus.
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-biometric-button'))
  })
  await act(async () => {
    fireEvent(screen.getByPlaceholderText('login.enterPassword'), 'blur')
  })
  await flush()
  expect(
    screen.getByPlaceholderText('login.enterPassword').props.className,
  ).not.toContain('border-destructive')

  await act(async () => {
    finishScan({ status: 'cancelled' })
  })
})

it('RU10 vào lại màn nhập mật khẩu thì ô sạch, không còn lỗi cũ', async () => {
  render(<LoginForm />)
  await screen.findByTestId('use-password-button')
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-password-button'))
  })
  await act(async () => {
    fireEvent(screen.getByPlaceholderText('login.enterPassword'), 'blur')
  })
  // Huỷ quét → về màn chào → vào lại màn mật khẩu.
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-biometric-button'))
  })
  await screen.findByTestId('login-greeting')
  await act(async () => {
    fireEvent.press(screen.getByTestId('use-password-button'))
  })
  expect(
    screen.getByPlaceholderText('login.enterPassword').props.className,
  ).not.toContain('border-destructive')
})

it('RU8 quét lúc mất mạng: báo mất kết nối, giữ dữ liệu đã lưu', async () => {
  mockRead.mockResolvedValue({
    status: 'ok',
    phonenumber: '0901234567',
    password: 'secret1',
  })
  mockMutate.mockImplementation(
    (_vars: unknown, opts: { onError: (error: unknown) => void }) =>
      opts.onError(new Error('Network Error')),
  )
  render(<LoginForm />)
  await screen.findByTestId('biometric-login-button')
  await act(async () => {
    fireEvent.press(screen.getByTestId('biometric-login-button'))
  })
  await waitFor(() =>
    expect(mockShowToast).toHaveBeenCalledWith('login.networkError', 'error'),
  )
  expect(mockDisable).not.toHaveBeenCalled()
  expect(screen.getByTestId('login-greeting')).toBeTruthy()
})
