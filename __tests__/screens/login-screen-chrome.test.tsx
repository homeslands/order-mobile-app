// Test host-level: app/auth/login.tsx phải render đủ chrome (tiêu đề, mô tả,
// footer đăng ký) qua LoginPanel — không được lùi về render <LoginForm />
// trần (lỗi hồi quy task 9 đã sửa).
//
// File riêng, tách khỏi login-screen.test.tsx: file kia mock nguyên
// '@/components/auth' để test hành vi nút thoát; ở đây cần LoginPanel thật
// render nên không thể mock chung module trong cùng một file test.

jest.mock('@/components/ui', () => ({ Input: () => null }))

jest.mock('expo-haptics', () => ({
  impactAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}))

jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated/mock'),
)

jest.mock('@/hooks', () => ({
  useLogin: () => ({ mutate: jest.fn(), isPending: false }),
  usePostAuthActions: () => ({ handleAuthSuccess: jest.fn() }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useZodForm: require('@/hooks/use-zod-form').useZodForm,
}))

jest.mock('@/lib/navigation', () => ({
  navigateWhenUnlocked: { push: jest.fn(), replace: jest.fn() },
}))

jest.mock('@/utils', () => ({ showErrorToastMessage: jest.fn() }))

jest.mock('expo-image', () => ({ Image: () => null }))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({
    canGoBack: () => false,
    back: jest.fn(),
    replace: jest.fn(),
  }),
  Redirect: () => null,
}))

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ getQueryData: () => undefined }),
}))

jest.mock('@/lib/navigation/master-transition-provider', () => ({
  useMasterTransitionOptional: () => null,
}))

jest.mock('@/stores', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ isAuthenticated: () => false, _hasHydrated: true }),
}))

import { render } from '@testing-library/react-native'

import LoginScreen from '@/app/auth/login'

describe('LoginScreen — chưa đăng nhập vẫn có chrome', () => {
  it('render tiêu đề, mô tả và footer đăng ký (LoginPanel, không phải LoginForm trần)', () => {
    const { getByText } = render(<LoginScreen />)

    expect(getByText('login.title')).toBeTruthy()
    expect(getByText('login.description')).toBeTruthy()
    expect(getByText('login.noAccount', { exact: false })).toBeTruthy()
    expect(getByText('login.registerNow')).toBeTruthy()
  })
})
