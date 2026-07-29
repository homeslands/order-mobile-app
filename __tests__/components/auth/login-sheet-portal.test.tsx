// Test host-level: login-sheet-portal.tsx phải render đủ chrome (tiêu đề,
// mô tả, footer đăng ký) qua LoginPanel — không được lùi về render
// <LoginForm /> trần (lỗi hồi quy task 9 đã sửa).

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

jest.mock('@gorhom/bottom-sheet', () => ({
  // Sheet giả bỏ qua cơ chế portal/present thật — chỉ render children để
  // test được nội dung chrome bên trong, giống cách flashlist-sizes.test.tsx
  // giả BottomSheetModal cho các test khác trong repo.
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
  BottomSheetBackdrop: () => null,
  BottomSheetScrollView: ({ children }: { children: React.ReactNode }) =>
    children,
}))

jest.mock('@/stores/login-sheet.store', () => ({
  useLoginSheetStore: (
    selector: (s: {
      visible: boolean
      onSuccess: null
      close: () => void
    }) => unknown,
  ) => selector({ visible: true, onSuccess: null, close: jest.fn() }),
}))

import { render } from '@testing-library/react-native'

import LoginSheetPortal from '@/components/auth/login-sheet-portal'

describe('LoginSheetPortal — chưa đăng nhập vẫn có chrome', () => {
  it('render tiêu đề, mô tả và footer đăng ký (LoginPanel, không phải LoginForm trần)', () => {
    const { getByText } = render(<LoginSheetPortal />)

    expect(getByText('login.title')).toBeTruthy()
    expect(getByText('login.description')).toBeTruthy()
    expect(getByText('login.noAccount', { exact: false })).toBeTruthy()
    expect(getByText('login.registerNow')).toBeTruthy()
  })

  it('KHÔNG render link "Quay lại trang chủ" — sheet nổi trên màn khác, pan-down-to-close là lối thoát', () => {
    const { queryByTestId, queryByText } = render(<LoginSheetPortal />)

    expect(queryByTestId('login-panel-home')).toBeNull()
    expect(queryByText('login.goBackToHome')).toBeNull()
  })
})
