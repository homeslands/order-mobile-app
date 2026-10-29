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
jest.mock(
  '@/components/home/home-icons',
  () => new Proxy({}, { get: () => () => null }),
)

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
  'Quét trả đơn',
  'Thanh toán Xu',
  'Đặt món',
  'Đổi thẻ quà tặng',
  'Lịch sử đơn',
]
// Hai nhóm vẽ khác nhau (tấm QR và mục Tiện ích), nên "cao bằng nhau" là
// trong từng nhóm, không phải cả sáu.
const QR_IDS = ['memberId', 'scanPay', 'coinPayment']
const UTILITY_IDS = ['order', 'giftCardRedeem', 'orderHistory']

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
    fireEvent.press(screen.getByText('Quét trả đơn'))
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

  it('G6 nhãn tối đa hai dòng; ô không khoá chiều cao', () => {
    // Khoá chiều cao cho đủ hai dòng thì khi nhãn chỉ một dòng, phần thừa dồn
    // xuống đáy và tấm QR trông trên thưa dưới dày. Để ô tự cao theo nhãn —
    // các ô trong cùng một hàng flex vẫn tự bằng nhau.
    render(<HomeActionGrid />)
    LABELS.forEach((l) =>
      expect(screen.getByText(l).props.numberOfLines).toBe(2),
    )
    for (const id of [...QR_IDS, ...UTILITY_IDS]) {
      const style = StyleSheet.flatten(
        screen.getByTestId(`home-action-${id}`).props.style,
      )
      expect(style?.height).toBeUndefined()
    }
  })

  it('G8 ba việc còn lại nằm dưới tiêu đề mục "Tiện ích"', () => {
    render(<HomeActionGrid />)
    const json = JSON.stringify(screen.toJSON())
    const title = json.indexOf('Tiện ích')
    expect(title).toBeGreaterThan(json.indexOf('Thanh toán Xu'))
    expect(title).toBeLessThan(json.indexOf('Đặt món'))
  })

  it('G7 phiên đọc lúc chạm: đăng xuất sau khi render vẫn đi login', () => {
    render(<HomeActionGrid />)
    mockSession = false
    fireEvent.press(screen.getByText('Đổi thẻ quà tặng'))
    expect(mockPush).toHaveBeenLastCalledWith('/auth/login')
  })

  it('G9 Tiện ích chia đều đúng ba cột, không có ô trống', () => {
    render(<HomeActionGrid />)
    const row = screen.getByTestId('home-utilities')
    expect(row.children).toHaveLength(UTILITY_IDS.length)
  })

  it.each(['vi', 'en'])(
    'G10 nhãn QR (%s) đủ ngắn để vừa một dòng — tấm QR mới cân padding',
    (lang) => {
      // Một nhãn xuống hai dòng thì hàng cao theo nó, và hai ô còn lại hở
      // dưới đáy — tấm QR trông trên thưa dưới dày. Đo bằng
      // BeVietnamPro_400Regular 13.5pt, ô rộng 102pt trên màn 375pt: nhãn
      // 13 ký tự dài nhất ("Thanh toán Xu") là 95.5pt; hai nhãn từng gây
      // lỗi là 15 và 17 ký tự ("Quét QR trả đơn" 107pt, "Scan to pay
      // order" 119pt). Số ký tự là xấp xỉ, không thay được kiểm mắt.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const qr = require(`@/i18n/${lang}/profile.json`).profile.qr as Record<
        string,
        string
      >
      for (const key of ['memberId', 'scanPay', 'coinPayment']) {
        expect(qr[key].length).toBeLessThanOrEqual(13)
      }
    },
  )
})
