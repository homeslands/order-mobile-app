// Tab Account hiện form đăng nhập khi chưa đăng nhập, và các tab vẫn được giữ
// trong bộ nhớ. Bấm Đăng xuất thì form trong tab Account (đang ẩn) được dựng
// ngầm và tự bật hộp Face ID / vân tay đè lên Home, ngay lúc khách vừa chủ
// động đăng xuất. Chỉ tự hiện khi màn chứa form đang được focus.
import { NavigationContext } from '@react-navigation/native'
import { act, render, waitFor } from '@testing-library/react-native'

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
jest.mock('@/hooks', () => ({
  useLogin: () => ({ mutate: jest.fn(), isPending: false }),
  usePostAuthActions: () => ({ handleAuthSuccess: jest.fn() }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access
  useZodForm: require('@/hooks/use-zod-form').useZodForm,
}))
jest.mock('@/lib/navigation', () => ({
  navigateWhenUnlocked: { push: jest.fn() },
}))
jest.mock('@/utils', () => ({
  showErrorToastMessage: jest.fn(),
  showToast: jest.fn(),
}))

const mockRead = jest.fn(async () => ({ status: 'cancelled' as const }))
jest.mock('@/lib/biometric-login', () => ({
  biometricLabelKey: () => 'biometric.faceId',
  disableBiometricLogin: jest.fn(),
  enableBiometricLogin: jest.fn(),
  getBiometricType: async () => 'face',
  getEnabledPhone: async () => '0901234567',
  readBiometricCredentials: (...args: unknown[]) => mockRead(...(args as [])),
  shouldDisableAfterLoginError: () => false,
}))

type Listener = () => void

function fakeNavigation(initiallyFocused: boolean) {
  let focused = initiallyFocused
  const listeners: Record<string, Listener[]> = { focus: [], blur: [] }
  return {
    isFocused: () => focused,
    addListener: (event: 'focus' | 'blur', cb: Listener) => {
      listeners[event].push(cb)
      return () => {
        listeners[event] = listeners[event].filter((l) => l !== cb)
      }
    },
    setFocused(next: boolean) {
      focused = next
      listeners[next ? 'focus' : 'blur'].forEach((l) => l())
    },
  }
}

function renderIn(nav: ReturnType<typeof fakeNavigation>) {
  return render(
    <NavigationContext.Provider value={nav as never}>
      <LoginForm />
    </NavigationContext.Provider>,
  )
}

beforeEach(() => mockRead.mockClear())

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('BF1 màn đang ẩn (tab Account sau khi đăng xuất) thì không tự quét', async () => {
  renderIn(fakeNavigation(false))
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
  expect(mockRead).not.toHaveBeenCalled()
})

it('BF2 khách mở tới màn đó thì tự quét đúng một lần', async () => {
  const nav = fakeNavigation(false)
  renderIn(nav)
  await act(async () => {
    nav.setFocused(true)
  })
  await waitFor(() => expect(mockRead).toHaveBeenCalledTimes(1))
})

it('BF3 màn đang hiện sẵn (màn Đăng nhập riêng) thì tự quét ngay', async () => {
  renderIn(fakeNavigation(true))
  await waitFor(() => expect(mockRead).toHaveBeenCalledTimes(1))
})
