// Thẻ số dư trên Home: hai nửa chạm được khi đã đăng nhập, một dòng mời khi
// chưa. "Đã đăng nhập" quyết bằng userInfo (cùng tín hiệu với Profile), không
// bằng isAuthenticated() — hàm đó trả false suốt lúc refresh token đang bay.
import { fireEvent, render, screen } from '@testing-library/react-native'

import { BalanceCard } from '@/components/home/balance-card'
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

jest.mock('@/hooks', () => ({
  useCoinBalance: () => ({ balance: 390600, isLoading: false }),
  useLoyaltyPoints: () => ({ totalPoints: 1240, isLoading: false }),
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
    expect(screen.getByText('Xu')).toBeTruthy()
    expect(screen.getByText('Điểm tích luỹ')).toBeTruthy()
    expect(screen.getByText(formatPoints(390600))).toBeTruthy()
    expect(screen.getByText(formatPoints(1240))).toBeTruthy()
  })

  it('B2 chạm từng nửa đi đúng màn lịch sử', () => {
    mockUserState.userInfo = { slug: 'u1' }
    render(<BalanceCard />)
    fireEvent.press(screen.getByText('Xu'))
    expect(mockPush).toHaveBeenLastCalledWith('/profile/coin-hub')
    fireEvent.press(screen.getByText('Điểm tích luỹ'))
    expect(mockPush).toHaveBeenLastCalledWith('/profile/loyalty-point-hub')
  })

  it('B3 chưa đăng nhập: chỉ dòng mời, chạm đi login', () => {
    render(<BalanceCard />)
    expect(screen.queryByText('Xu')).toBeNull()
    expect(screen.queryByText(formatPoints(0))).toBeNull()
    fireEvent.press(screen.getByText(LOGIN_CTA))
    expect(mockPush).toHaveBeenCalledWith('/auth/login')
  })

  it('B4 đang refresh token: vẫn hiện số, không nháy dòng mời', () => {
    mockUserState.userInfo = { slug: 'u1' }
    mockAuthed = false // isAuthenticated() trả false suốt lúc refresh
    render(<BalanceCard />)
    expect(screen.getByText(formatPoints(390600))).toBeTruthy()
    expect(screen.queryByText(LOGIN_CTA)).toBeNull()
  })
})
