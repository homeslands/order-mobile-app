import { render } from '@testing-library/react-native'
import { FlashList } from '@shopify/flash-list'
import UpdateOrderMenus from '@/app/update-order/components/update-order-menus'
import {
  UPDATE_ORDER_CATALOG_HEADER_HEIGHT,
  UPDATE_ORDER_MENU_ITEM_HEIGHT,
} from '@/constants/list-item-sizes'

// ---------------------------------------------------------------------------
// Store mocks
// ---------------------------------------------------------------------------
jest.mock('@/stores', () => ({
  useOrderFlowStore: jest.fn(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    (sel) => sel({ updatingData: { id: 'order-1' } }),
  ),
  useAuthStore: jest.fn(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    (sel) => sel({ isAuthenticated: () => false }),
  ),
}))

// ---------------------------------------------------------------------------
// Hook mocks — return data immediately so we bypass loading states
// ---------------------------------------------------------------------------
jest.mock('@/hooks', () => ({
  useCatalog: jest.fn(() => ({
    data: {
      result: [
        { slug: 'drinks', name: 'Đồ uống' },
        { slug: 'food', name: 'Đồ ăn' },
      ],
    },
    isPending: false,
  })),
}))

jest.mock('@/hooks/use-menu', () => ({
  useSpecificMenu: jest.fn(() => ({ data: null, isPending: false })),
  usePublicSpecificMenu: jest.fn(() => ({
    data: {
      result: {
        menuItems: [
          {
            slug: 'ca-phe-sua',
            isLocked: false,
            currentStock: 10,
            promotion: null,
            product: {
              slug: 'ca-phe-sua',
              name: 'Cà phê sữa',
              image: null,
              description: '',
              isLimit: false,
              isGift: false,
              catalog: { slug: 'drinks' },
              variants: [{ size: { name: 'M' }, price: 35000 }],
            },
          },
          {
            slug: 'tra-sua',
            isLocked: false,
            currentStock: 5,
            promotion: null,
            product: {
              slug: 'tra-sua',
              name: 'Trà sữa',
              image: null,
              description: '',
              isLimit: false,
              isGift: false,
              catalog: { slug: 'drinks' },
              variants: [{ size: { name: 'M' }, price: 40000 }],
            },
          },
          {
            slug: 'banh-mi',
            isLocked: false,
            currentStock: 8,
            promotion: null,
            product: {
              slug: 'banh-mi',
              name: 'Bánh mì',
              image: null,
              description: '',
              isLimit: false,
              isGift: false,
              catalog: { slug: 'food' },
              variants: [{ size: { name: 'M' }, price: 25000 }],
            },
          },
        ],
      },
    },
    isPending: false,
  })),
}))

// ---------------------------------------------------------------------------
// Heavy child component mock — keeps the test fast
// ---------------------------------------------------------------------------
jest.mock(
  '@/app/update-order/components/client-menu-item-for-update-order',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { View } = require('react-native')
    return function MockClientMenuItemForUpdateOrder() {
      return <View testID="menu-item" />
    }
  },
)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
it('renders a single FlashList (flat list)', () => {
  const { UNSAFE_getAllByType } = render(
    <UpdateOrderMenus branchSlug="q1" primaryColor="#FF6B00" />,
  )
  const lists = UNSAFE_getAllByType(FlashList)
  expect(lists.length).toBe(1)
})

it('overrideItemLayout sets correct size per item type', () => {
  const { UNSAFE_getAllByType } = render(
    <UpdateOrderMenus branchSlug="q1" primaryColor="#FF6B00" />,
  )
  const lists = UNSAFE_getAllByType(FlashList)
  expect(lists.length).toBe(1)
  const list = lists[0]
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  expect(typeof list.props.overrideItemLayout).toBe('function')

  const itemLayout: { size?: number } = {}
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  list.props.overrideItemLayout(itemLayout, { type: 'item' })
  expect(itemLayout.size).toBe(UPDATE_ORDER_MENU_ITEM_HEIGHT)

  const headerLayout: { size?: number } = {}
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  list.props.overrideItemLayout(headerLayout, { type: 'header' })
  expect(headerLayout.size).toBe(UPDATE_ORDER_CATALOG_HEADER_HEIGHT)
})

it('renders all menu items (2 drinks + 1 food = 3 total)', () => {
  const { getAllByTestId } = render(
    <UpdateOrderMenus branchSlug="q1" primaryColor="#FF6B00" />,
  )
  expect(getAllByTestId('menu-item').length).toBe(3)
})
