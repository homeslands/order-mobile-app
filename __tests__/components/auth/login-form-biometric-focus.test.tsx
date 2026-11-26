// Đăng nhập bằng Face ID / vân tay chỉ chạy khi khách bấm nút. Trước đây form
// tự quét khi màn được focus: trên iPhone Face ID nhận mặt gần như tức thì,
// khách không kịp bấm Huỷ để đăng nhập tài khoản khác — mở tab Tài khoản là
// bị đăng nhập luôn.
import { NavigationContext } from '@react-navigation/native'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import LoginForm from '@/components/auth/login-form'

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

const focusedNavigation = {
  isFocused: () => true,
  addListener: () => () => {},
}

function renderFocused() {
  return render(
    <NavigationContext.Provider value={focusedNavigation as never}>
      <LoginForm />
    </NavigationContext.Provider>,
  )
}

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

it('BB1 màn đang hiện và đã bật thì KHÔNG tự quét', async () => {
  renderFocused()
  await screen.findByTestId('biometric-login-button')
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
  expect(mockRead).not.toHaveBeenCalled()
})

it('BB2 bấm nút "Đăng nhập bằng …" thì quét đúng một lần', async () => {
  renderFocused()
  await screen.findByTestId('biometric-login-button')
  expect(screen.getByText('biometric.prompt')).toBeTruthy()
  expect(screen.getByLabelText('biometric.prompt')).toBeTruthy()
  await act(async () => {
    fireEvent.press(screen.getByTestId('biometric-login-button'))
  })
  await waitFor(() => expect(mockRead).toHaveBeenCalledTimes(1))
})

it('BB3 chưa bật thì không hiện nút và vạch "hoặc"', async () => {
  mockEnabledPhone.mockResolvedValue(null)
  renderFocused()
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
  expect(screen.queryByTestId('biometric-login-button')).toBeNull()
  expect(screen.queryByText('login.or')).toBeNull()
  expect(mockRead).not.toHaveBeenCalled()
})

it('BB4 nút nằm dưới ô số điện thoại, trên vạch "hoặc" và ô mật khẩu', async () => {
  renderFocused()
  await screen.findByTestId('biometric-login-button')
  const order = [
    'login.enterPhoneNumber',
    'biometric.prompt',
    'login.or',
    'login.enterPassword',
    'login.login',
  ]
  const tree = JSON.stringify(screen.toJSON())
  const positions = order.map((key) => tree.indexOf(`"${key}"`))
  positions.forEach((p) => expect(p).toBeGreaterThan(-1))
  expect([...positions].sort((a, b) => a - b)).toEqual(positions)
})

it('BB5 đăng nhập bằng Face ID lúc mất mạng: báo mất kết nối, giữ dữ liệu đã lưu', async () => {
  mockRead.mockResolvedValue({
    status: 'ok',
    phonenumber: '0901234567',
    password: 'secret1',
  })
  mockMutate.mockImplementation(
    (_vars: unknown, opts: { onError: (error: unknown) => void }) =>
      opts.onError(new Error('Network Error')),
  )
  renderFocused()
  await screen.findByTestId('biometric-login-button')
  await act(async () => {
    fireEvent.press(screen.getByTestId('biometric-login-button'))
  })

  await waitFor(() =>
    expect(mockShowToast).toHaveBeenCalledWith('login.networkError', 'error'),
  )
  expect(mockDisable).not.toHaveBeenCalled()
  expect(screen.getByTestId('biometric-login-button')).toBeTruthy()
})
