const mockCanGoBack = jest.fn()
const mockBack = jest.fn()
const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({
    canGoBack: mockCanGoBack,
    back: mockBack,
    replace: mockReplace,
  }),
  Redirect: () => null,
}))

jest.mock('@/components/auth', () => ({ LoginForm: () => null }))
jest.mock('expo-image', () => ({ Image: () => null }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}))
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ getQueryData: () => undefined }),
}))
jest.mock('@/lib/navigation', () => ({
  navigateWhenUnlocked: { replace: jest.fn() },
}))
jest.mock('@/lib/navigation/master-transition-provider', () => ({
  useMasterTransitionOptional: () => null,
}))
jest.mock('@/stores', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ isAuthenticated: () => false, _hasHydrated: true }),
}))

import { fireEvent, render } from '@testing-library/react-native'

import LoginScreen from '@/app/auth/login'

describe('LoginScreen — nút thoát', () => {
  beforeEach(() => {
    mockCanGoBack.mockReset()
    mockBack.mockReset()
    mockReplace.mockReset()
  })

  it('quay lại khi còn back stack', () => {
    mockCanGoBack.mockReturnValue(true)
    const { getByTestId } = render(<LoginScreen />)

    fireEvent.press(getByTestId('login-close'))

    expect(mockBack).toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('về trang chủ khi không có back stack', () => {
    mockCanGoBack.mockReturnValue(false)
    const { getByTestId } = render(<LoginScreen />)

    fireEvent.press(getByTestId('login-close'))

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home')
    expect(mockBack).not.toHaveBeenCalled()
  })
})
