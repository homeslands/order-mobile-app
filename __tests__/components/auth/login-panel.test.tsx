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
  it('không render nút đóng', () => {
    const { queryByTestId } = render(<LoginPanel />)

    expect(queryByTestId('login-panel-close')).toBeNull()
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
      { name: 'showLogo', props: { showLogo: true } },
      { name: 'compactTitle', props: { compactTitle: true } },
      {
        name: 'tất cả cùng lúc',
        props: { showLogo: true, compactTitle: true },
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

  it('phone label và password label đều dùng text-sm', () => {
    const { getByText } = render(<LoginPanel />)

    // Phone label inside FormInput (Text component rendered by FormInput)
    const phoneLabel = getByText('login.phoneNumber')
    expect(phoneLabel.props.className).toContain('text-sm')

    // Password label inside LoginForm (Text component)
    const passwordLabel = getByText('login.password')
    expect(passwordLabel.props.className).toContain('text-sm')
  })

  describe('link "Quay lại trang chủ" (showHomeLink)', () => {
    it('showHomeLink mặc định (true) thì render link về trang chủ, bấm vào điều hướng về home', () => {
      const { navigateWhenUnlocked } = jest.requireMock('@/lib/navigation') as {
        navigateWhenUnlocked: { replace: jest.Mock }
      }
      const onBeforeNavigate = jest.fn()
      const { getByTestId, getByText } = render(
        <LoginPanel onBeforeNavigate={onBeforeNavigate} />,
      )

      expect(getByText('login.goBackToHome')).toBeTruthy()

      fireEvent.press(getByTestId('login-panel-home'))

      expect(onBeforeNavigate).toHaveBeenCalledTimes(1)
      expect(navigateWhenUnlocked.replace).toHaveBeenCalledWith('/(tabs)/home')
    })

    it('showHomeLink={false} thì KHÔNG render link về trang chủ (bottom sheet)', () => {
      const { queryByTestId, queryByText } = render(
        <LoginPanel showHomeLink={false} />,
      )

      expect(queryByTestId('login-panel-home')).toBeNull()
      expect(queryByText('login.goBackToHome')).toBeNull()
    })
  })

  it('link đăng ký nằm TRƯỚC spacer, link về trang chủ nằm SAU spacer trong cây render', () => {
    const { toJSON } = render(<LoginPanel />)

    type JsonNode = {
      props?: { testID?: string }
      children?: (JsonNode | string)[] | null
    }

    const collectTestIds = (
      node: JsonNode | (JsonNode | string)[] | string | null | undefined,
      order: string[] = [],
    ): string[] => {
      if (!node || typeof node === 'string') return order
      if (Array.isArray(node)) {
        node.forEach((n) => collectTestIds(n, order))
        return order
      }
      const testID = node.props?.testID
      if (testID) order.push(testID)
      if (node.children) collectTestIds(node.children, order)
      return order
    }

    const order = collectTestIds(toJSON() as JsonNode)
    const registerIndex = order.indexOf('login-panel-register')
    const spacerIndex = order.indexOf('login-panel-spacer')
    const homeIndex = order.indexOf('login-panel-home')

    expect(registerIndex).toBeGreaterThanOrEqual(0)
    expect(spacerIndex).toBeGreaterThanOrEqual(0)
    expect(homeIndex).toBeGreaterThanOrEqual(0)
    expect(registerIndex).toBeLessThan(spacerIndex)
    expect(spacerIndex).toBeLessThan(homeIndex)
  })

  it('root luôn có pt-6 để nội dung không dính safe area', () => {
    const { toJSON } = render(<LoginPanel />)

    expect(toJSON()?.props.className).toContain('pt-6')
  })
})
