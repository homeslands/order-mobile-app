// Thẻ số dư trên Home: hai thẻ (Xu to, Điểm nhỏ) khi đã đăng nhập, một thẻ mời
// đăng nhập khi chưa. "Đã đăng nhập" quyết bằng userInfo (cùng tín hiệu với Profile), không
// bằng isAuthenticated() — hàm đó trả false suốt lúc refresh token đang bay.
import { act, fireEvent, render, screen } from '@testing-library/react-native'

import { StyleSheet } from 'react-native'

import { BalanceCard } from '@/components/home/balance-card'
import { colors } from '@/constants'
import { formatPoints } from '@/utils'

const mockUserState: { userInfo: { slug: string } | null } = { userInfo: null }
let mockAuthed = true
const mockPush = jest.fn()

jest.mock('@/stores', () => ({
  useUserStore: (sel: (s: typeof mockUserState) => unknown) =>
    sel(mockUserState),
  useAuthStore: Object.assign(
    (sel: (s: { isAuthenticated: () => boolean }) => unknown) =>
      sel({ isAuthenticated: () => mockAuthed }),
    { getState: () => ({ isAuthenticated: () => mockAuthed }) },
  ),
}))

const mockCoin = {
  balance: 390600,
  hasData: true,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
}
const mockPoints = {
  totalPoints: 1240,
  hasData: true,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
}
jest.mock('@/hooks', () => ({
  useCoinBalance: () => mockCoin,
  useLoyaltyPoints: () => mockPoints,
}))

// Giữ lại callback để test tự giả lập "focus lần đầu" và "quay lại màn".
const mockFocusCallbacks: (() => void)[] = []
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    mockFocusCallbacks.push(cb)
  },
}))

jest.mock('@/lib/navigation', () => ({
  // Bọc qua arrow: factory bị hoist lên trên `const mockPush`, nên gán thẳng
  // sẽ chụp giá trị lúc chưa khởi tạo.
  navigateNative: {
    push: (...args: unknown[]) => mockPush(...args),
    navigate: jest.fn(),
  },
}))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))

jest.mock('expo-linear-gradient', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { View } = require('react-native')
  const { createElement: h } = require('react')
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    LinearGradient: ({ children }: { children?: unknown }) =>
      h(View, null, children),
  }
})

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string) =>
      key.split('.').reduce<unknown>(
        (acc, k) =>
          acc && typeof acc === 'object'
            ? (acc as Record<string, unknown>)[k]
            : undefined,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@/i18n/vi/home.json').home,
      ) ?? key,
    i18n: { language: 'vi' },
  }),
}))

const LOGIN_CTA = 'Đăng nhập để xem Xu và điểm tích luỹ'

beforeEach(() => {
  jest.clearAllMocks()
  mockUserState.userInfo = null
  mockAuthed = true
  mockCoin.balance = 390600
  mockCoin.hasData = true
  mockCoin.isLoading = false
  mockCoin.isError = false
  mockPoints.totalPoints = 1240
  mockPoints.hasData = true
  mockPoints.isLoading = false
  mockPoints.isError = false
  mockFocusCallbacks.length = 0
})

afterEach(() => {
  // Đọc trước global lười của jest-expo khi môi trường test còn mở — nếu để
  // tới lúc teardown thì nó require muộn và nổ "import a file outside of the
  // scope of the test code". Cùng cách point-confirm.test.tsx đang làm.
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

describe('BalanceCard', () => {
  it('B1 đã đăng nhập: hiện nhãn và hai con số', () => {
    mockUserState.userInfo = { slug: 'u1' }
    render(<BalanceCard />)
    expect(screen.getByText('Xu của bạn')).toBeTruthy()
    expect(screen.getByText('Điểm tích luỹ')).toBeTruthy()
    expect(screen.getByText(formatPoints(390600))).toBeTruthy()
    expect(screen.getByText(formatPoints(1240))).toBeTruthy()
    expect(screen.getByText('Lịch sử Xu')).toBeTruthy()
    expect(screen.getByText('Xem')).toBeTruthy()
  })

  it('B2 chạm thẻ hoặc dải chân thẻ đều đi đúng màn lịch sử', () => {
    mockUserState.userInfo = { slug: 'u1' }
    render(<BalanceCard />)
    fireEvent.press(screen.getByText('Xu của bạn'))
    expect(mockPush).toHaveBeenLastCalledWith('/profile/coin-hub')
    fireEvent.press(screen.getByText('Lịch sử Xu'))
    expect(mockPush).toHaveBeenLastCalledWith('/profile/coin-hub')
    fireEvent.press(screen.getByText('Điểm tích luỹ'))
    expect(mockPush).toHaveBeenLastCalledWith('/profile/loyalty-point-hub')
    fireEvent.press(screen.getByText('Xem'))
    expect(mockPush).toHaveBeenLastCalledWith('/profile/loyalty-point-hub')
  })

  it('B3 chưa đăng nhập: chỉ dòng mời, chạm đi login', () => {
    render(<BalanceCard />)
    expect(screen.queryByText('Xu của bạn')).toBeNull()
    expect(screen.queryByText(formatPoints(0))).toBeNull()
    fireEvent.press(screen.getByText(LOGIN_CTA))
    expect(mockPush).toHaveBeenLastCalledWith('/auth/login')
    fireEvent.press(screen.getByText('Đăng nhập'))
    expect(mockPush).toHaveBeenLastCalledWith('/auth/login')
  })

  it('B4 đang refresh token: vẫn hiện số, không nháy dòng mời', () => {
    mockUserState.userInfo = { slug: 'u1' }
    mockAuthed = false // isAuthenticated() trả false suốt lúc refresh
    render(<BalanceCard />)
    expect(screen.getByText(formatPoints(390600))).toBeTruthy()
    expect(screen.queryByText(LOGIN_CTA)).toBeNull()
  })

  it('B5 đang tải: không hiện số 0 giả', () => {
    mockUserState.userInfo = { slug: 'u1' }
    // Hook thật trả `data ?? 0` khi chưa có dữ liệu.
    mockCoin.balance = 0
    mockCoin.hasData = false
    mockCoin.isLoading = true
    mockPoints.totalPoints = 0
    mockPoints.hasData = false
    mockPoints.isLoading = true
    render(<BalanceCard />)
    expect(screen.queryByText(formatPoints(0))).toBeNull()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('B6 lỗi API: không hiện số 0 như thể là số dư thật', () => {
    mockUserState.userInfo = { slug: 'u1' }
    mockCoin.balance = 0
    mockCoin.hasData = false
    mockCoin.isError = true
    mockPoints.totalPoints = 0
    mockPoints.hasData = false
    mockPoints.isError = true
    render(<BalanceCard />)
    expect(screen.queryByText(formatPoints(0))).toBeNull()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('B7 quay lại Home: làm mới cả Xu và Điểm (bỏ lần focus đầu)', () => {
    // Khách trả bằng Xu ở quầy rồi quay về: số trên thẻ phải là số mới.
    // refetchOnWindowFocus đang tắt toàn cục, và tab Home không unmount.
    mockUserState.userInfo = { slug: 'u1' }
    render(<BalanceCard />)
    const focus = mockFocusCallbacks[mockFocusCallbacks.length - 1]
    act(() => focus()) // focus lần đầu — query đang tự tải
    expect(mockCoin.refetch).not.toHaveBeenCalled()
    expect(mockPoints.refetch).not.toHaveBeenCalled()
    act(() => focus()) // quay lại màn
    expect(mockCoin.refetch).toHaveBeenCalledTimes(1)
    expect(mockPoints.refetch).toHaveBeenCalledTimes(1)
  })

  it('B8 làm mới nền bị lỗi: vẫn giữ số đã có, không đổi thành —', () => {
    // isError của React Query vẫn true khi lần refetch sau cùng lỗi, kể cả
    // đang có dữ liệu cũ. Giấu một con số hợp lệ đi là tệ hơn hiện số cũ.
    mockUserState.userInfo = { slug: 'u1' }
    mockCoin.isError = true
    mockPoints.isError = true
    render(<BalanceCard />)
    expect(screen.getByText(formatPoints(390600))).toBeTruthy()
    expect(screen.getByText(formatPoints(1240))).toBeTruthy()
    expect(screen.queryByText('—')).toBeNull()
  })

  it('B9 nút mắt ẩn và hiện lại số Xu, không đụng số Điểm', () => {
    mockUserState.userInfo = { slug: 'u1' }
    render(<BalanceCard />)
    fireEvent.press(screen.getByLabelText('Ẩn số dư'))
    expect(screen.queryByText(formatPoints(390600))).toBeNull()
    expect(screen.getByText('••••••')).toBeTruthy()
    expect(screen.getByText(formatPoints(1240))).toBeTruthy()
    // Chạm mắt không được kéo theo điều hướng của thẻ cha.
    expect(mockPush).not.toHaveBeenCalled()
    fireEvent.press(screen.getByLabelText('Hiện số dư'))
    expect(screen.getByText(formatPoints(390600))).toBeTruthy()
  })

  it('B10 dải chân thẻ Điểm không trùng màu nền trang', () => {
    // Dải chân từng dùng `background` — đúng màu nền trang — nên nửa dưới thẻ
    // tan vào nền và thẻ trông như bị cắt cụt.
    mockUserState.userInfo = { slug: 'u1' }
    render(<BalanceCard />)
    const footer = StyleSheet.flatten(
      screen.getByTestId('balance-points-footer').props.style,
    )
    expect(footer.backgroundColor).not.toBe(colors.background.light)
  })
})
