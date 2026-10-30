// Lối tắt trên Home: tấm QR bốn ô (ba chức năng QR qua useQrActions + Thẻ quà
// sang tab Gift Card) và mục Tiện ích bốn ô. "Đổi thẻ quà tặng" và "Lịch sử
// đơn" phải tự chặn đăng xuất, vì hai màn đích chỉ đọc userSlug rỗng rồi tắt
// query — khách sẽ rơi vào màn trống.
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Linking, StyleSheet } from 'react-native'

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

// Số hotline đọc từ biến môi trường; jest không nạp .env nên tự cấp. Giá trị
// cố định: jest chụp getter đúng một lần lúc nạp module, mà lúc đó biến
// `let` bên ngoài chưa khởi tạo. G15 thay riêng thuộc tính này.
jest.mock('@/constants/env', () => ({
  ...jest.requireActual('@/constants/env'),
  hotline: '1900123456',
}))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
// NativeGesturePressable chạy trên gesture handler; trong test thay bằng một
// Pressable thường giữ nguyên onPress, và đánh dấu để G12 đếm được.
jest.mock('@/components/navigation/native-gesture-pressable', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { Pressable } = require('react-native')
  const { createElement: h } = require('react')
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    NativeGesturePressable: (p: { onPress?: () => void; children?: unknown }) =>
      h(
        Pressable,
        { testID: 'press-feedback', onPress: p.onPress },
        p.children,
      ),
  }
})
jest.mock(
  '@/components/home/home-icons',
  () => new Proxy({}, { get: () => () => null }),
)

// Ba namespace map khác nhau (i18n/resources.ts): 'home' là object BÊN TRONG
// file; 'profile' và 'tabs' là NGUYÊN file — nên khoá giữ tiền tố.
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
  /* eslint-disable @typescript-eslint/no-require-imports */
  const roots: Record<string, unknown> = {
    profile: require('@/i18n/vi/profile.json'),
    tabs: require('@/i18n/vi/tabs.json'),
    home: require('@/i18n/vi/home.json').home,
  }
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    initReactI18next: { type: '3rdParty', init: () => {} },
    useTranslation: (ns: string) => ({
      t: (key: string) => lookup(roots[ns], key),
      i18n: { language: 'vi' },
    }),
  }
})

const QR_LABELS = ['Mã định danh', 'Quét trả đơn', 'Trả bằng Xu', 'Thẻ quà']
const UTILITY_LABELS = ['Đặt món', 'Đổi thẻ quà tặng', 'Lịch sử đơn', 'Liên hệ']
const LABELS = [...QR_LABELS, ...UTILITY_LABELS]
// Hai nhóm vẽ khác nhau (tấm QR và mục Tiện ích).
const QR_IDS = ['memberId', 'scanPay', 'coinPayment', 'giftCard']
const UTILITY_IDS = ['order', 'giftCardRedeem', 'orderHistory', 'hotline']

let openURL: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  mockSession = true
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
})

afterEach(() => {
  jest.restoreAllMocks()
  // Đọc trước global lười của jest-expo khi môi trường test còn mở.
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

describe('HomeActionGrid', () => {
  it('G1 tám ô đúng nhãn, đúng thứ tự', () => {
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
    fireEvent.press(screen.getByText('Trả bằng Xu'))
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

  it('G7 phiên đọc lúc chạm: đăng xuất sau khi render vẫn đi login', () => {
    render(<HomeActionGrid />)
    mockSession = false
    fireEvent.press(screen.getByText('Đổi thẻ quà tặng'))
    expect(mockPush).toHaveBeenLastCalledWith('/auth/login')
  })

  it('G8 bốn việc còn lại nằm dưới tiêu đề mục "Tiện ích"', () => {
    render(<HomeActionGrid />)
    const json = JSON.stringify(screen.toJSON())
    const title = json.indexOf('Tiện ích')
    expect(title).toBeGreaterThan(json.indexOf('Thẻ quà'))
    expect(title).toBeLessThan(json.indexOf('Đặt món'))
  })

  it('G9 cả hai hàng đủ bốn ô', () => {
    render(<HomeActionGrid />)
    expect(screen.getByTestId('home-qr-card').children).toHaveLength(4)
    expect(screen.getByTestId('home-utilities').children).toHaveLength(4)
  })

  it.each(['vi', 'en'])(
    'G10 nhãn tấm QR (%s) đủ ngắn để vừa một dòng trong ô bốn cột',
    (lang) => {
      // Một nhãn xuống hai dòng thì hàng cao theo nó, và các ô còn lại hở
      // dưới đáy — tấm QR trông trên thưa dưới dày. Đo bằng
      // BeVietnamPro_400Regular 12pt, ô 4 cột rộng 81.8pt trên màn 375pt:
      // "Mã định danh" (12 ký tự) 78pt vừa; "Thanh toán Xu" (13) 84.9pt và
      // "Coin Payment" 82.2pt tràn. Số ký tự là xấp xỉ, không thay được đo.
      /* eslint-disable @typescript-eslint/no-require-imports */
      const qr = require(`@/i18n/${lang}/profile.json`).profile.qr as Record<
        string,
        string
      >
      const tabs = require(`@/i18n/${lang}/tabs.json`).tabs as Record<
        string,
        string
      >
      /* eslint-enable @typescript-eslint/no-require-imports */
      const labels = [qr.memberId, qr.scanPay, qr.coinPayment, tabs.giftCard]
      for (const l of labels) expect(l.length).toBeLessThanOrEqual(12)
      expect(qr.coinPayment).not.toBe('Coin Payment')
    },
  )

  it('G11 tấm QR phẳng, không đổ bóng', () => {
    // Thẻ trắng trên nền xám đã tự tách khỏi nền bằng độ tương phản, như mọi
    // thẻ khác trên Home. Người dùng thử bóng đậm, rồi bóng nhẹ, rồi bỏ hẳn.
    render(<HomeActionGrid />)
    const card = StyleSheet.flatten(
      screen.getByTestId('home-qr-card').props.style,
    )
    expect(card.shadowOpacity ?? 0).toBe(0)
    expect(card.elevation ?? 0).toBe(0)
  })

  it('G12 cả tám ô có phản hồi khi chạm (NativeGesturePressable)', () => {
    // Chuẩn của repo: mọi phần tử chạm được thu nhỏ 0.97 bằng
    // SPRING_CONFIGS.press. Ô chạm mà không phản hồi gì thì trông "chết".
    render(<HomeActionGrid />)
    expect(screen.getAllByTestId('press-feedback')).toHaveLength(8)
  })

  it('G13 Thẻ quà mở tab Gift Card, mang đúng tên của tab', () => {
    mockSession = false
    render(<HomeActionGrid />)
    fireEvent.press(screen.getByText('Thẻ quà'))
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/gift-card')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('G14 Liên hệ gọi đúng số hotline', () => {
    render(<HomeActionGrid />)
    fireEvent.press(screen.getByText('Liên hệ'))
    expect(openURL).toHaveBeenCalledWith('tel:1900123456')
  })

  it('G15 không có số hotline: ẩn ô Liên hệ, không để nút chết', () => {
    // Bản build EAS đọc biến môi trường của EAS, không đọc .env ở máy — quên
    // khai báo thì số rỗng. Một nút bấm vào không ra gì tệ hơn không có nút.
    jest.replaceProperty(
      jest.requireMock<{ hotline?: string }>('@/constants/env'),
      'hotline',
      undefined,
    )
    render(<HomeActionGrid />)
    expect(screen.queryByText('Liên hệ')).toBeNull()
    expect(screen.getByTestId('home-utilities').children).toHaveLength(3)
  })

  it('G16 nền icon Tiện ích là hình tròn', () => {
    render(<HomeActionGrid />)
    for (const id of UTILITY_IDS) {
      const box = screen.getByTestId(`home-utility-icon-${id}`)
      expect(String(box.props.className)).toMatch(/\brounded-full\b/)
    }
  })
})
