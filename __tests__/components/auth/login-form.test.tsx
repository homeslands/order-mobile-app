jest.mock('@/components/ui', () => ({ Input: () => null }))

const mockImpactAsync = jest.fn((..._args: unknown[]) => Promise.resolve())
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}))

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated/mock'),
)

const mockMutate = jest.fn()
jest.mock('@/hooks', () => ({
  useLogin: () => ({ mutate: mockMutate, isPending: false }),
  usePostAuthActions: () => ({ handleAuthSuccess: jest.fn() }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access
  useZodForm: require('@/hooks/use-zod-form').useZodForm,
}))

jest.mock('@/lib/navigation', () => ({
  navigateNative: { push: jest.fn(), replace: jest.fn() },
}))

jest.mock('@/utils', () => ({ showErrorToastMessage: jest.fn() }))

import { act, fireEvent, render } from '@testing-library/react-native'

import LoginForm from '@/components/auth/login-form'

describe('LoginForm — sai thông tin đăng nhập', () => {
  beforeEach(() => {
    mockMutate.mockReset()
    // mockClear (not mockReset) — mockReset would also wipe the
    // Promise.resolve() implementation set at creation, so the second
    // test's Haptics.impactAsync().catch() would crash on `undefined`.
    mockImpactAsync.mockClear()
  })

  const fillAndSubmit = async (utils: ReturnType<typeof render>) => {
    await act(async () => {
      utils
        .getByPlaceholderText('login.enterPhoneNumber')
        .props.onChangeText('0901234567')
      utils
        .getByPlaceholderText('login.enterPassword')
        .props.onChangeText('wrongpass1')
    })
    await act(async () => {
      fireEvent.press(utils.getByText('login.login'))
    })
  }

  it('bật viền đỏ cả 2 ô và phát haptic khi server báo lỗi', async () => {
    mockMutate.mockImplementation(
      (_vars: unknown, opts: { onError: () => void }) => opts.onError(),
    )
    const utils = render(<LoginForm />)

    await fillAndSubmit(utils)

    expect(
      utils.getByPlaceholderText('login.enterPhoneNumber').props.className,
    ).toContain('border-destructive')
    expect(
      utils.getByPlaceholderText('login.enterPassword').props.className,
    ).toContain('border-destructive')
    expect(mockImpactAsync).toHaveBeenCalledWith('light')
  })

  it('xoá viền đỏ khi người dùng sửa lại ô', async () => {
    mockMutate.mockImplementation(
      (_vars: unknown, opts: { onError: () => void }) => opts.onError(),
    )
    const utils = render(<LoginForm />)
    await fillAndSubmit(utils)

    await act(async () => {
      utils
        .getByPlaceholderText('login.enterPhoneNumber')
        .props.onChangeText('0901234568')
    })

    expect(
      utils.getByPlaceholderText('login.enterPhoneNumber').props.className,
    ).not.toContain('border-destructive')
  })
})
