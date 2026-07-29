// Test host-level: app/profile/index.tsx ở trạng thái chưa đăng nhập phải
// render đủ chrome (tiêu đề, mô tả, footer đăng ký) qua LoginPanel — không
// được lùi về render <LoginForm /> trần (lỗi hồi quy task 9 đã sửa).

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
  useLoyaltyPoints: () => ({ totalPoints: 0 }),
  useRunAfterTransition: () => {},
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
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    getQueryData: () => undefined,
    removeQueries: jest.fn(),
  }),
}))

jest.mock('@/lib/fcm-token-manager', () => ({
  cleanupTokenOnLogout: jest.fn(),
}))

jest.mock('@/stores', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ needsUserInfo: () => true, setLogout: jest.fn() }),
  useUserStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({ userInfo: null, removeUserInfo: jest.fn() }),
    { getState: () => ({ deviceToken: undefined }) },
  ),
}))

jest.mock('@/stores/notification.store', () => ({
  useNotificationStore: { getState: () => ({ clearAll: jest.fn() }) },
}))

import { render } from '@testing-library/react-native'

import ProfilePlaceholderScreen from '@/app/profile/index'

describe('app/profile/index.tsx — chưa đăng nhập vẫn có chrome', () => {
  it('render tiêu đề, mô tả và footer đăng ký (LoginPanel, không phải LoginForm trần)', () => {
    const { getByText } = render(<ProfilePlaceholderScreen />)

    expect(getByText('login.title')).toBeTruthy()
    expect(getByText('login.description')).toBeTruthy()
    expect(getByText('login.noAccount', { exact: false })).toBeTruthy()
    expect(getByText('login.registerNow')).toBeTruthy()
  })
})
