jest.mock('@/components/ui', () => ({ Input: () => null }))

const mockImpactAsync = jest.fn((..._args: unknown[]) => Promise.resolve())
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}))

const mockWithSequence = jest.fn((..._args: unknown[]) => 0)
// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('react-native-reanimated', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ...require('react-native-reanimated/mock'),
  withSequence: (...args: unknown[]) => mockWithSequence(...args),
}))

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

import {
  act,
  fireEvent,
  render,
  type RenderResult,
} from '@testing-library/react-native'

import LoginForm from '@/components/auth/login-form'

// Lấy type instance qua RenderResult của @testing-library/react-native thay
// vì import thẳng từ 'react-test-renderer' — package đó không có type
// declaration riêng nên import trực tiếp sẽ làm tsc báo lỗi TS7016.
type Instance = ReturnType<RenderResult['getByPlaceholderText']>

const isDescendantOf = (ancestor: Instance, node: Instance): boolean => {
  let current: Instance | null = node
  while (current) {
    if (current === ancestor) return true
    current = current.parent
  }
  return false
}

// Node gần nhất chứa cả a lẫn b trong cây — dùng để xác định khối bọc lắc
// mà không cần biết trước nó là Animated.View hay type cụ thể nào.
const closestCommonAncestor = (a: Instance, b: Instance): Instance | null => {
  let node: Instance | null = a
  while (node) {
    if (isDescendantOf(node, b)) return node
    node = node.parent
  }
  return null
}

describe('LoginForm — autofill', () => {
  it('khai báo thuộc tính autofill cho ô SĐT (nửa username của cặp password-manager)', () => {
    const utils = render(<LoginForm />)
    const phoneInput = utils.getByPlaceholderText('login.enterPhoneNumber')

    expect(phoneInput.props.textContentType).toBe('username')
    expect(phoneInput.props.importantForAutofill).toBe('yes')
    expect(phoneInput.props.autoComplete).toBe('tel')
  })
})

describe('LoginForm — sai thông tin đăng nhập', () => {
  beforeEach(() => {
    mockMutate.mockReset()
    // mockClear (not mockReset) — mockReset would also wipe the
    // Promise.resolve() implementation set at creation, so the second
    // test's Haptics.impactAsync().catch() would crash on `undefined`.
    mockImpactAsync.mockClear()
    mockWithSequence.mockClear()
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

    expect(
      utils.getByPlaceholderText('login.enterPhoneNumber').props.className,
    ).toContain('border-destructive')

    await act(async () => {
      utils
        .getByPlaceholderText('login.enterPhoneNumber')
        .props.onChangeText('0901234568')
    })

    expect(
      utils.getByPlaceholderText('login.enterPhoneNumber').props.className,
    ).not.toContain('border-destructive')
  })

  it('sửa MỘT ô cũng xoá viền đỏ ở CẢ 2 ô (spec: sửa bất kỳ ô nào)', async () => {
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

    // Chỉ sửa ô SĐT — không đụng vào ô mật khẩu.
    await act(async () => {
      utils
        .getByPlaceholderText('login.enterPhoneNumber')
        .props.onChangeText('0901234568')
    })

    expect(
      utils.getByPlaceholderText('login.enterPhoneNumber').props.className,
    ).not.toContain('border-destructive')
    expect(
      utils.getByPlaceholderText('login.enterPassword').props.className,
    ).not.toContain('border-destructive')
  })

  it('lắc chung một khối 2 ô nhập, không lan sang link/nút submit', async () => {
    mockMutate.mockImplementation(
      (_vars: unknown, opts: { onError: () => void }) => opts.onError(),
    )
    const utils = render(<LoginForm />)

    expect(mockWithSequence).not.toHaveBeenCalled()

    await fillAndSubmit(utils)

    // (a) khối lắc thực sự chạy sau khi server báo lỗi.
    expect(mockWithSequence).toHaveBeenCalledTimes(1)

    // (b) khối lắc chỉ bọc 2 ô nhập — không lan ra link "Quên mật khẩu"
    // hay nút submit.
    const phoneInput = utils.getByPlaceholderText('login.enterPhoneNumber')
    const passwordInput = utils.getByPlaceholderText('login.enterPassword')
    const forgotLink = utils.getByText('login.forgotPassword')
    const submitButton = utils.getByText('login.login')

    const shakeWrapper = closestCommonAncestor(phoneInput, passwordInput)
    if (!shakeWrapper) {
      throw new Error('Không tìm thấy khối bọc chung cho 2 ô nhập')
    }
    expect(isDescendantOf(shakeWrapper, forgotLink)).toBe(false)
    expect(isDescendantOf(shakeWrapper, submitButton)).toBe(false)
  })
})
