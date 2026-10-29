// Lưới sáu ô trên Home. Ba ô QR đi qua useQrActions (cổng auth nằm trong hook).
// "Đổi thẻ quà tặng" và "Lịch sử đơn" phải tự chặn đăng xuất, vì hai màn đích
// chỉ đọc userSlug rỗng rồi tắt query — khách sẽ rơi vào màn trống.
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { HomeActionGrid } from '@/components/home/home-action-grid'

const mockMember = jest.fn()
const mockScan = jest.fn()
const mockCoin = jest.fn()
const mockPush = jest.fn()
const mockNavigate = jest.fn()
let mockSession = true

// Mọi hàm mock đều bọc qua arrow: factory bị hoist lên trên các `const mock*`.
jest.mock('@/hooks/use-qr-actions', () => ({
  useQrActions: () => ({
    openMemberId: () => mockMember(),
    openScanPay: () => mockScan(),
    openCoinPayment: () => mockCoin(),
  }),
  hasUsableSession: () => mockSession,
}))

jest.mock('@/lib/navigation', () => ({
  navigateNative: {
    push: (...args: unknown[]) => mockPush(...args),
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
}))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))

// Hai namespace map khác nhau (i18n/resources.ts): 'home' là object BÊN TRONG
// file, 'profile' là NGUYÊN file — nên khoá profile giữ tiền tố `profile.`.
jest.mock('react-i18next', () => {
  const lookup = (root: unknown, key: string) =>
    key
      .split('.')
      .reduce<unknown>(
        (acc, k) =>
          acc && typeof acc === 'object'
            ? (acc as Record<string, unknown>)[k]
            : undefined,
        root,
      ) ?? key
  return {
    initReactI18next: { type: '3rdParty', init: () => {} },
    useTranslation: (ns: string) => ({
      t: (key: string) =>
        lookup(
          ns === 'profile'
            ? // eslint-disable-next-line @typescript-eslint/no-require-imports
              require('@/i18n/vi/profile.json')
            : // eslint-disable-next-line @typescript-eslint/no-require-imports
              require('@/i18n/vi/home.json').home,
          key,
        ),
      i18n: { language: 'vi' },
    }),
  }
})

const LABELS = [
  'Mã định danh',
  'Quét QR trả đơn',
  'Thanh toán Xu',
  'Đổi thẻ quà tặng',
  'Lịch sử đơn',
  'Đặt món',
]
const TILE_IDS = [
  'memberId',
  'scanPay',
  'coinPayment',
  'giftCardRedeem',
  'orderHistory',
  'order',
]

beforeEach(() => {
  jest.clearAllMocks()
  mockSession = true
})

afterEach(() => {
  // Đọc trước global lười của jest-expo khi môi trường test còn mở.
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

describe('HomeActionGrid', () => {
  it('G1 sáu ô đúng nhãn, đúng thứ tự', () => {
    render(<HomeActionGrid />)
    const json = JSON.stringify(screen.toJSON())
    const idx = LABELS.map((l) => json.indexOf(l))
    idx.forEach((i) => expect(i).toBeGreaterThan(-1))
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
  })

  it('G2 ba ô QR gọi đúng hàm của useQrActions', () => {
    render(<HomeActionGrid />)
    fireEvent.press(screen.getByText('Mã định danh'))
    expect(mockMember).toHaveBeenCalledTimes(1)
    fireEvent.press(screen.getByText('Quét QR trả đơn'))
    expect(mockScan).toHaveBeenCalledTimes(1)
    fireEvent.press(screen.getByText('Thanh toán Xu'))
    expect(mockCoin).toHaveBeenCalledTimes(1)
  })

  it('G3 có phiên: Đổi thẻ và Lịch sử đi thẳng màn đích', () => {
    render(<HomeActionGrid />)
    fireEvent.press(screen.getByText('Đổi thẻ quà tặng'))
    expect(mockPush).toHaveBeenLastCalledWith('/gift-card/redeem')
    fireEvent.press(screen.getByText('Lịch sử đơn'))
    expect(mockPush).toHaveBeenLastCalledWith('/profile/history')
  })

  it('G4 không phiên: Đổi thẻ và Lịch sử đi login', () => {
    mockSession = false
    render(<HomeActionGrid />)
    fireEvent.press(screen.getByText('Đổi thẻ quà tặng'))
    expect(mockPush).toHaveBeenLastCalledWith('/auth/login')
    fireEvent.press(screen.getByText('Lịch sử đơn'))
    expect(mockPush).toHaveBeenLastCalledWith('/auth/login')
  })

  it('G5 Đặt món chuyển tab Thực đơn, kể cả khi chưa đăng nhập', () => {
    mockSession = false
    render(<HomeActionGrid />)
    fireEvent.press(screen.getByText('Đặt món'))
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/menu')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('G6 nhãn tối đa hai dòng, sáu ô cùng chiều cao', () => {
    render(<HomeActionGrid />)
    LABELS.forEach((l) =>
      expect(screen.getByText(l).props.numberOfLines).toBe(2),
    )
    const heights = TILE_IDS.map(
      (id) =>
        StyleSheet.flatten(screen.getByTestId(`home-action-${id}`).props.style)
          ?.height,
    )
    expect(typeof heights[0]).toBe('number')
    expect(new Set(heights).size).toBe(1)
  })

  it('G7 phiên đọc lúc chạm: đăng xuất sau khi render vẫn đi login', () => {
    render(<HomeActionGrid />)
    mockSession = false
    fireEvent.press(screen.getByText('Đổi thẻ quà tặng'))
    expect(mockPush).toHaveBeenLastCalledWith('/auth/login')
  })
})
