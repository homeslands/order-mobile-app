// "Có thể bạn thích" ở trang chi tiết món. Nút + ở đây từng lệch với nút + ở
// Menu: thêm được món hết hàng, khách chưa đăng nhập vẫn thêm, toast không
// ghi size. Giờ đi cùng luật với Menu.
import { fireEvent, render, screen } from '@testing-library/react-native'

import SliderRelatedProducts from '@/components/menu/slider-related-products'

type Item = {
  slug: string
  isLocked: boolean
  currentStock: number
  promotion: null
  product: {
    slug: string
    name: string
    image: string
    images: string[]
    isLimit: boolean
    variants: { slug: string; price: number; size: { name: string } }[]
  }
}

const item = (slug: string, over: Partial<Item> = {}): Item => ({
  slug,
  isLocked: false,
  currentStock: 0,
  promotion: null,
  product: {
    slug: `p-${slug}`,
    name: `Món ${slug}`,
    image: '',
    images: [],
    isLimit: false,
    variants: [
      { slug: `${slug}-m`, price: 41000, size: { name: 'M' } },
      { slug: `${slug}-s`, price: 35000, size: { name: 'S' } },
    ],
  },
  ...over,
})

let mockItems: Item[] = []
let mockUserSlug: string | undefined = 'u1'
const mockAdd = jest.fn()
const mockOpenLogin = jest.fn()
const mockToast = jest.fn()

jest.mock('@/hooks', () => ({
  useSpecificMenu: () => ({ data: { result: mockItems }, isPending: false }),
  usePublicSpecificMenu: () => ({
    data: { result: mockItems },
    isPending: false,
  }),
  usePressInPrefetchMenuItem: () => () => {},
}))
jest.mock('@/api/menu', () => ({
  extractMenuItems: (r: unknown) => (Array.isArray(r) ? r : []),
}))
jest.mock('@/stores', () => {
  const orderFlow = {
    isHydrated: true,
    currentStep: 'ordering',
    orderingData: { owner: 'u1' },
    setCurrentStep: () => {},
    initializeOrdering: () => {},
    addOrderingItem: (i: unknown) => mockAdd(i),
  }
  return {
    useOrderFlowStore: { getState: () => orderFlow },
    useBranchStore: (sel: (s: unknown) => unknown) =>
      sel({ branch: { slug: 'b1' } }),
    useUserStore: Object.assign(
      (sel: (s: unknown) => unknown) =>
        sel({ userInfo: mockUserSlug ? { slug: mockUserSlug } : null }),
      {
        getState: () => ({
          userInfo: mockUserSlug ? { slug: mockUserSlug } : null,
        }),
      },
    ),
  }
})
jest.mock('@/stores/login-sheet.store', () => ({
  useLoginSheetStore: { getState: () => ({ open: mockOpenLogin }) },
}))
jest.mock('@/stores/selectors', () => ({ useSetMenuFilter: () => () => {} }))
jest.mock('@/stores/transient-nav.store', () => ({
  useTransientNavStore: { getState: () => ({ setHeroImageUrls: () => {} }) },
}))
jest.mock('@/constants', () => ({
  OrderFlowStep: { ORDERING: 'ordering' },
  ROUTE: { CLIENT_PRODUCT_DETAIL: '/product/[id]' },
  colors: jest.requireActual('@/constants/colors.constant').colors,
}))
jest.mock('@/constants/navigation.config', () => ({
  TAB_ROUTES: { MENU: '/menu' },
}))
jest.mock('@/lib/navigation', () => ({ navigateNative: { push: () => {} } }))
jest.mock('@/hooks/use-primary-color', () => ({
  usePrimaryColor: () => '#F7A737',
}))
jest.mock('@/utils', () => ({
  formatCurrency: (n: number) => `${n}đ`,
  showToast: (m: string) => mockToast(m),
}))
jest.mock('@/utils/product-image-url', () => ({
  getProductImageUrl: (p: string) => (p ? `https://img/${p}` : null),
  IMAGE_PRESET: { THUMB: 1, HERO: 2 },
}))
jest.mock('@/assets/images', () => ({
  Images: { Food: { DefaultProductImage: 'default-product' } },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: () => {} }) }))
jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    Image: (p: { source: unknown }) => (
      <View testID="product-image" {...{ source: p.source }} />
    ),
  }
})
jest.mock('lucide-react-native', () => ({
  ChevronRight: () => null,
  Plus: () => null,
}))
jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, string>) =>
      o?.size ? `${k}:${o.name}:${o.size}` : o?.name ? `${k}:${o.name}` : k,
  }),
}))

function renderSlider() {
  return render(<SliderRelatedProducts currentProduct="x" catalog="c1" />)
}

beforeEach(() => {
  mockItems = [item('a')]
  mockUserSlug = 'u1'
  mockAdd.mockClear()
  mockOpenLogin.mockClear()
  mockToast.mockClear()
})

it('RP1 món hết hàng: ghi "Hết hàng", không có nút thêm', () => {
  mockItems = [
    item('a', {
      currentStock: 0,
      product: { ...item('a').product, isLimit: true },
    }),
  ]
  renderSlider()
  expect(screen.getByText('menu.outOfStock')).toBeTruthy()
  expect(screen.queryByLabelText('menu.addToCart')).toBeNull()
})

it('RP2 khách chưa đăng nhập bấm +: mở đăng nhập, không thêm', () => {
  mockUserSlug = undefined
  renderSlider()
  fireEvent.press(screen.getByLabelText('menu.addToCart'))
  expect(mockOpenLogin).toHaveBeenCalledTimes(1)
  expect(mockAdd).not.toHaveBeenCalled()
})

it('RP3 bấm +: thêm size rẻ nhất, toast ghi size', () => {
  renderSlider()
  fireEvent.press(screen.getByLabelText('menu.addToCart'))
  expect(mockAdd).toHaveBeenCalledWith(
    expect.objectContaining({ size: 'S', originalPrice: 35000 }),
  )
  expect(mockToast).toHaveBeenCalledWith('menu.addedToCartWithSize:Món a:S')
})

it('RP4 còn nhiều món hơn số thẻ: có "Xem thêm" ở tiêu đề', () => {
  mockItems = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => item(s))
  renderSlider()
  expect(screen.getByText('menu.seeMore')).toBeTruthy()
})

it('RP5 món không có ảnh: dùng ảnh mặc định như Menu', () => {
  renderSlider()
  expect(screen.getByTestId('product-image').props.source).toBe(
    'default-product',
  )
})

it('RP6 is wrapped in React.memo', () => {
  expect((SliderRelatedProducts as { $$typeof?: symbol }).$$typeof).toBe(
    Symbol.for('react.memo'),
  )
})
