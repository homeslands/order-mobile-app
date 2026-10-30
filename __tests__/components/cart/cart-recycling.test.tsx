// FlashList v2 tái dùng ô: cùng một instance component được render lại với món
// khác, state bên trong KHÔNG tự reset. Ô giỏ hàng không được mang ghi chú, số
// lượng chờ hay trạng thái vuốt của món trước sang món mới.
import 'react-native-gesture-handler/jestSetup'

import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { State } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'

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
  jest.clearAllMocks()
})

afterEach(() => {
  jest.useRealTimers()
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

describe('CartItemRow khi bị tái dùng sang món khác', () => {
  it('CR1 ô ghi chú hiện ghi chú của món mới', () => {
    const { rerender } = render(row(makeItem({ cartKey: 'a', note: 'ít đá' })))
    rerender(row(makeItem({ cartKey: 'b', note: '' })))
    expect(screen.getByPlaceholderText(NOTE_PLACEHOLDER).props.value).toBe('')
  })

  it('CR2 số lượng đang chờ của món cũ không hiện ở món mới', () => {
    const { rerender } = render(row(makeItem({ cartKey: 'a', quantity: 1 })))
    fireEvent.press(screen.getByText('+'))
    expect(screen.getByText('2')).toBeTruthy()
    rerender(row(makeItem({ cartKey: 'b', quantity: 5 })))
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.queryByText('2')).toBeNull()
  })

  it('CR3 ghi chú gõ dở ở món cũ vẫn lưu vào món cũ', () => {
    const { rerender } = render(row(makeItem({ cartKey: 'a' })))
    fireEvent.changeText(screen.getByPlaceholderText(NOTE_PLACEHOLDER), 'nóng')
    rerender(row(makeItem({ cartKey: 'b' })))
    act(() => {
      jest.runAllTimers()
    })
    expect(mockAddNote).toHaveBeenCalledWith('a', 'nóng')
    expect(mockAddNote).not.toHaveBeenCalledWith('b', expect.anything())
  })

  it('CR4 ô đã vuốt mở trở về đóng khi sang món khác', () => {
    const { rerender, UNSAFE_root } = render(row(makeItem({ cartKey: 'a' })))
    fireGestureHandler(getByGestureTestId('cart-swipe'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: -100 },
      { state: State.END, translationX: -100, velocityX: -1000 },
    ])
    const translateXOf = () => {
      const fg = UNSAFE_root.findAll((n) => {
        const t = StyleSheet.flatten(n.props.style)?.transform
        return Array.isArray(t) && 'translateX' in (t[0] ?? {})
      })[0]
      return StyleSheet.flatten(fg.props.style).transform[0].translateX
    }
    rerender(row(makeItem({ cartKey: 'a' })))
    expect(translateXOf()).toBe(-80)
    rerender(row(makeItem({ cartKey: 'b' })))
    expect(translateXOf()).toBe(0)
  })
})
