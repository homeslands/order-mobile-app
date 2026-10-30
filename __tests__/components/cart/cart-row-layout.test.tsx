// Setter của useRecyclingState mặc định bắt FlashList tính lại bố cục cả danh
// sách. Số lượng đang chờ và chữ ghi chú không đổi chiều cao ô theo cách cần
// đo lại cả danh sách — mỗi phím gõ / mỗi lần +/- chỉ được render lại ô đó,
// như useState trước đây.
import 'react-native-gesture-handler/jestSetup'

import { act, fireEvent, render, screen } from '@testing-library/react-native'

import type { CartDisplayItem } from '@/components/cart/cart-display-item'
import { CartItemRow } from '@/components/cart/cart-item-row'

const mockAddNote = jest.fn()
const mockUpdateQuantity = jest.fn()

jest.mock('react-native-reanimated', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const mock = require('react-native-reanimated/mock')
  const { useRef } = require('react')
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    ...mock,
    // Mock gốc dựng shared value MỚI mỗi lần render, nên giá trị không bao giờ
    // sống qua một lần render lại — khác hẳn máy thật. Giữ nó trong ref.
    useSharedValue: (init: unknown) => useRef({ value: init }).current,
  }
})

const mockSkips: Array<boolean | undefined> = []
jest.mock('@shopify/flash-list', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useState } = require('react')
  return {
    useRecyclingState: (init: unknown) => {
      const [v, setV] = useState(init)
      return [
        v,
        (next: unknown, skipParentLayout?: boolean) => {
          mockSkips.push(skipParentLayout)
          setV(next)
        },
      ]
    },
  }
})

jest.mock('@/stores/cart.store', () => ({
  cartActions: {
    addNote: (...a: unknown[]) => mockAddNote(...a),
    updateQuantity: (...a: unknown[]) => mockUpdateQuantity(...a),
  },
  useCartItemVoucherDiscount: () => 0,
}))

jest.mock('@/utils', () => ({ capitalizeFirst: (s: string) => s }))

jest.mock('cart-price-calc', () => ({
  formatCurrencyNative: (n: number) => `${n}đ`,
}))

jest.mock('expo-image', () => ({ Image: () => null }))

jest.mock('lucide-react-native', () => ({
  NotebookText: () => null,
  Trash2: () => null,
}))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (k: string) => k }),
}))

function makeItem(over: Partial<CartDisplayItem>): CartDisplayItem {
  return {
    cartKey: 'a',
    productId: 'p',
    name: 'trà',
    variantSlug: 'v',
    sizeSlug: 's',
    sizeName: '',
    price: 10000,
    originalPrice: 10000,
    quantity: 1,
    promotionValue: 0,
    note: '',
    imageUrl: null,
    ...over,
  }
}

const noop = () => {}

function row(item: CartDisplayItem) {
  return (
    <CartItemRow
      item={item}
      primaryColor="#000"
      isDark={false}
      onDelete={noop}
    />
  )
}

const NOTE_PLACEHOLDER = 'cart.itemNotePlaceholder'

beforeEach(() => {
  jest.useFakeTimers()
  mockSkips.length = 0
})

afterEach(() => {
  jest.useRealTimers()
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('CL1 bấm +/- không bắt danh sách tính lại bố cục', () => {
  render(row(makeItem({ quantity: 1 })))
  fireEvent.press(screen.getByText('+'))
  act(() => {
    jest.runAllTimers()
  })
  expect(mockSkips.length).toBeGreaterThan(0)
  expect(mockSkips.every((s) => s === true)).toBe(true)
})

it('CL2 gõ ghi chú không bắt danh sách tính lại bố cục', () => {
  render(row(makeItem({})))
  fireEvent.changeText(screen.getByPlaceholderText(NOTE_PLACEHOLDER), 'nóng')
  expect(mockSkips).toEqual([true])
})
