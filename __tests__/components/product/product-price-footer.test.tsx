// Nút "Thêm vào giỏ" ở trang chi tiết món: đang tải / lỗi / hết hàng là ba
// trạng thái khác nhau. Trước đây cả ba đều ghi "Hết hàng".
import { fireEvent, render, screen } from '@testing-library/react-native'

import { ProductPriceFooter } from '@/components/product/product-price-footer'

let mockSelectedVariant: unknown = { slug: 'm', price: 45000 }

jest.mock('@/stores/selectors', () => ({
  useDetailPrice: () => 45000,
  useDetailComputedTotalPrice: () => 45000,
  useDetailSelectedVariant: () => mockSelectedVariant,
}))

jest.mock('@/hooks/use-primary-color', () => ({
  usePrimaryColor: () => '#F7A737',
}))

jest.mock('@/components/ui/glass-surface', () => ({ GlassSurface: () => null }))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('lucide-react-native', () => ({
  ShoppingBag: () => null,
  RotateCw: () => null,
}))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

jest.mock('@/utils', () => ({ formatCurrency: (n: number) => `${n}đ` }))

const labels = {
  totalPriceLabel: 'total',
  chooseSizeLabel: 'chooseSize',
  addToCartLabel: 'addToCart',
  outOfStockLabel: 'outOfStock',
  retryLabel: 'retry',
}

function renderFooter(
  over: Partial<{ isLoaded: boolean; isError: boolean; hasStock: boolean }>,
) {
  const onAddToCart = jest.fn()
  const onRetry = jest.fn()
  render(
    <ProductPriceFooter
      {...labels}
      isLoaded
      isError={false}
      hasStock
      onAddToCart={onAddToCart}
      onRetry={onRetry}
      {...over}
    />,
  )
  return { onAddToCart, onRetry }
}

beforeEach(() => {
  mockSelectedVariant = { slug: 'm', price: 45000 }
})

it('đang tải: nút tắt và không ghi "Hết hàng"', () => {
  const { onAddToCart } = renderFooter({ isLoaded: false, hasStock: false })
  expect(screen.queryByText('outOfStock')).toBeNull()
  const button = screen.getByRole('button')
  expect(button.props.accessibilityState).toEqual(
    expect.objectContaining({ disabled: true, busy: true }),
  )
  fireEvent.press(button)
  expect(onAddToCart).not.toHaveBeenCalled()
})

it('lỗi tải: nút "Thử lại" gọi onRetry', () => {
  const { onAddToCart, onRetry } = renderFooter({
    isLoaded: false,
    isError: true,
    hasStock: false,
  })
  expect(screen.queryByText('outOfStock')).toBeNull()
  fireEvent.press(screen.getByText('retry'))
  expect(onRetry).toHaveBeenCalledTimes(1)
  expect(onAddToCart).not.toHaveBeenCalled()
})

it('hết hàng thật: ghi "Hết hàng" và tắt nút', () => {
  const { onAddToCart } = renderFooter({ hasStock: false })
  expect(screen.getByText('outOfStock')).toBeTruthy()
  fireEvent.press(screen.getByRole('button'))
  expect(onAddToCart).not.toHaveBeenCalled()
})

it('chưa chọn size: chờ, không ghi "Hết hàng"', () => {
  mockSelectedVariant = null
  renderFooter({})
  expect(screen.queryByText('outOfStock')).toBeNull()
})

it('sẵn sàng: bấm thêm vào giỏ', () => {
  const { onAddToCart } = renderFooter({})
  fireEvent.press(screen.getByText('addToCart'))
  expect(onAddToCart).toHaveBeenCalledTimes(1)
})
