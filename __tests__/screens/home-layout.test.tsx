// Bố cục màn Home: thẻ số dư → lưới sáu ô → banner → sản phẩm nổi bật.
// Thẻ số dư và lưới KHÔNG chờ `ready` (useRunAfterTransition): đó là lớp điều
// khiển dùng ở quầy, chờ transition xong mới hiện là mất ý nghĩa.
import { act, render, screen } from '@testing-library/react-native'
import { ScrollView } from 'react-native'

import HomeScreen from '@/app/(tabs)/home'
import { QUERYKEY } from '@/constants'

let mockReady = true
const mockInvalidate = jest.fn((..._args: unknown[]) => Promise.resolve())
const mockRefetchBanners = jest.fn(() => Promise.resolve())

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => mockInvalidate(...args),
  }),
}))

jest.mock('@/components/home', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { Text } = require('react-native')
  const { createElement: h } = require('react')
  /* eslint-enable @typescript-eslint/no-require-imports */
  const marker = (label: string) => () => h(Text, null, label)
  return {
    BalanceCard: marker('[BALANCE]'),
    HomeActionGrid: marker('[GRID]'),
    SwiperBanner: marker('[BANNER]'),
    HighlightMenuCarousel: marker('[FEATURED]'),
  }
})

jest.mock('@/components/layout', () => ({
  TabScreenLayout: ({ children }: { children: React.ReactNode }) => children,
  TabHeader: () => null,
  useTabBarBottomPadding: () => 0,
}))

jest.mock('@/components/notification/notification-bell', () => ({
  NotificationBell: () => null,
}))

jest.mock('@/components/ui', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { Text } = require('react-native')
  const { createElement: h } = require('react')
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { Skeleton: () => h(Text, null, '[BANNER]') }
})

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

jest.mock('@/hooks', () => ({
  // Gọi trong useEffect như bản thật (bản thật bọc InteractionManager trong
  // useEffect), để setReady không chạy giữa lúc render.
  useRunAfterTransition: (cb: () => void) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(() => {
      if (mockReady) cb()
    }, []),
}))

jest.mock('@/hooks/use-banner', () => ({
  useBanners: () => ({
    data: undefined,
    isLoading: false,
    refetch: () => mockRefetchBanners(),
  }),
}))

jest.mock('@/hooks/use-primary-color', () => ({
  usePrimaryColor: () => '#f7a737',
}))

jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated/mock'),
)

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (key: string) => key }),
}))

/**
 * Chữ trong cây theo thứ tự xuất hiện. Chỉ đi theo `children` — không
 * JSON.stringify cả cây, vì prop `refreshControl` là một React element mang
 * tham chiếu fiber vòng.
 */
function textsInOrder(node: unknown): string[] {
  if (node == null) return []
  if (typeof node === 'string') return [node]
  if (Array.isArray(node)) return node.flatMap(textsInOrder)
  const children = (node as { children?: unknown }).children
  return children ? textsInOrder(children) : []
}

afterEach(() => {
  // Đọc trước global lười của jest-expo khi môi trường test còn mở.
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

describe('Home layout', () => {
  it('H1 thứ tự: số dư → lưới → banner → sản phẩm nổi bật', () => {
    mockReady = true
    render(<HomeScreen />)
    const texts = textsInOrder(screen.toJSON())
    const order = ['[BALANCE]', '[GRID]', '[BANNER]', '[FEATURED]'].map((m) =>
      texts.indexOf(m),
    )
    order.forEach((i) => expect(i).toBeGreaterThan(-1))
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('H2 chưa ready: số dư và lưới đã hiện, sản phẩm nổi bật chưa', () => {
    mockReady = false
    render(<HomeScreen />)
    expect(screen.getByText('[BALANCE]')).toBeTruthy()
    expect(screen.getByText('[GRID]')).toBeTruthy()
    expect(screen.queryByText('[FEATURED]')).toBeNull()
  })

  it('H3 kéo để làm mới: làm mới cả banner, số Xu và điểm tích luỹ', async () => {
    mockReady = true
    render(<HomeScreen />)
    const onRefresh = screen.UNSAFE_getByType(ScrollView).props.refreshControl
      .props.onRefresh as () => Promise<void>
    await act(async () => {
      await onRefresh()
    })
    expect(mockRefetchBanners).toHaveBeenCalledTimes(1)
    expect(mockInvalidate).toHaveBeenCalledWith({
      queryKey: [QUERYKEY.profile, 'balance'],
    })
    expect(mockInvalidate).toHaveBeenCalledWith({
      queryKey: [QUERYKEY.loyaltyPoints],
    })
  })
})
