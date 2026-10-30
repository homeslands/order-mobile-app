// Kiểm giá giỏ có thể đổi giá nhiều món cùng lúc. Mỗi lần ghi store là một
// lượt persist (JSON.stringify cả giỏ) và một lượt re-render mọi subscriber,
// nên N món đổi giá phải là MỘT lần ghi — kết quả y hệt ghi lần lượt.
import { createOrderingItemsMethods } from '@/stores/slices/ordering-items.slice'
import type { IOrderFlowStore } from '@/stores/order-flow.types'
import type { IOrderItem, IProductVariant } from '@/types'

const mockReset = jest.fn()
jest.mock('@/stores/cart-display.store', () => ({
  useCartDisplayStore: {
    getState: () => ({ resetAfterCartChange: mockReset }),
  },
}))

function variant(slug: string, price: number, size: string): IProductVariant {
  return { slug, price, size: { name: size } } as IProductVariant
}

function orderItem(id: string, price: number): IOrderItem {
  return {
    id,
    slug: `p-${id}`,
    quantity: 2,
    originalPrice: price,
    size: 'S',
    variant: variant(`v-${id}`, price, 'S'),
  } as IOrderItem
}

function makeStore() {
  let state = {
    orderingData: {
      orderItems: [orderItem('a', 10), orderItem('b', 20), orderItem('c', 30)],
    },
  } as unknown as IOrderFlowStore
  const set = jest.fn((partial: Partial<IOrderFlowStore>) => {
    state = { ...state, ...partial }
  })
  const get = () => state
  return { methods: createOrderingItemsMethods(set, get), set, get }
}

const UPDATES = [
  { itemId: 'a', variant: variant('v-a2', 15, 'M') },
  { itemId: 'c', variant: variant('v-c2', 35, 'L') },
]

beforeEach(() => {
  mockReset.mockClear()
})

it('SB1 kết quả giống hệt ghi lần lượt từng món', () => {
  const one = makeStore()
  for (const u of UPDATES) {
    one.methods.updateOrderingItemVariant(u.itemId, u.variant)
  }
  const batch = makeStore()
  batch.methods.updateOrderingItemVariants(UPDATES)

  const pick = (s: IOrderFlowStore) => ({
    items: s.orderingData?.orderItems,
    minOrderValue: s.minOrderValue,
    byId: s.orderItemsById,
  })
  expect(pick(batch.get())).toEqual(pick(one.get()))
  expect(batch.get().orderingData?.orderItems[0]).toMatchObject({
    variant: { slug: 'v-a2' },
    size: 'M',
    originalPrice: 15,
  })
})

it('SB2 chỉ một lần ghi store và một lần reset hiển thị', () => {
  const { methods, set } = makeStore()
  methods.updateOrderingItemVariants(UPDATES)
  expect(set).toHaveBeenCalledTimes(1)
  expect(mockReset).toHaveBeenCalledTimes(1)
})

it('SB3 danh sách rỗng thì không ghi gì', () => {
  const { methods, set } = makeStore()
  methods.updateOrderingItemVariants([])
  expect(set).not.toHaveBeenCalled()
  expect(mockReset).not.toHaveBeenCalled()
})
