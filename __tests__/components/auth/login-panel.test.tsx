jest.mock('@/components/ui', () => ({ Input: () => null }))

const mockImpactAsync = jest.fn((..._args: unknown[]) => Promise.resolve())
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}))

jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated/mock'),
)

jest.mock('@/hooks', () => ({
  useLogin: () => ({ mutate: jest.fn(), isPending: false }),
  usePostAuthActions: () => ({ handleAuthSuccess: jest.fn() }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access
  useZodForm: require('@/hooks/use-zod-form').useZodForm,
}))

jest.mock('@/lib/navigation', () => ({
  navigateWhenUnlocked: { push: jest.fn(), replace: jest.fn() },
}))

jest.mock('@/utils', () => ({ showErrorToastMessage: jest.fn() }))

jest.mock('expo-image', () => ({
  Image: (props: { testID?: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native')
    return <View testID={props.testID} />
  },
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({
    canGoBack: () => false,
    back: jest.fn(),
    replace: jest.fn(),
  }),
}))

import { fireEvent, render } from '@testing-library/react-native'

import LoginPanel from '@/components/auth/login-panel'

describe('LoginPanel — chrome dùng chung', () => {
  it('không có onClose thì không render nút đóng', () => {
    const { queryByTestId } = render(<LoginPanel />)

    expect(queryByTestId('login-panel-close')).toBeNull()
  })

  it('có onClose thì render nút đóng và gọi đúng callback khi bấm', () => {
    const onClose = jest.fn()
    const { getByTestId } = render(<LoginPanel onClose={onClose} />)

    const closeButton = getByTestId('login-panel-close')
    fireEvent.press(closeButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('showLogo bật thì render logo', () => {
    const { getByTestId } = render(<LoginPanel showLogo />)

    expect(getByTestId('login-panel-logo')).toBeTruthy()
  })

  it('showLogo tắt (mặc định) thì không render logo', () => {
    const { queryByTestId } = render(<LoginPanel />)

    expect(queryByTestId('login-panel-logo')).toBeNull()
  })

  describe('luôn render tiêu đề, mô tả và footer đăng ký ở mọi tổ hợp props', () => {
    const cases: { name: string; props: Record<string, unknown> }[] = [
      { name: 'không props gì', props: {} },
      { name: 'onClose', props: { onClose: jest.fn() } },
      { name: 'showLogo', props: { showLogo: true } },
      { name: 'compactTitle', props: { compactTitle: true } },
      {
        name: 'tất cả cùng lúc',
        props: { onClose: jest.fn(), showLogo: true, compactTitle: true },
      },
    ]

    it.each(cases)('$name', ({ props }) => {
      const { getByText } = render(<LoginPanel {...props} />)

      expect(getByText('login.title')).toBeTruthy()
      expect(getByText('login.description')).toBeTruthy()
      expect(getByText('login.noAccount', { exact: false })).toBeTruthy()
      expect(getByText('login.registerNow')).toBeTruthy()
    })
  })
})
