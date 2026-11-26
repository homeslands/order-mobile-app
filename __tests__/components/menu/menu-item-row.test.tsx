// Hàng món ở tab Menu: món hết hàng phải trông khác và không thêm nhanh được
// bằng nút "+" (trước đây vẫn thêm được món bị khoá / hết số lượng).
import { fireEvent, render, screen } from '@testing-library/react-native'

import { MenuItemRow } from '@/app/(tabs)/menu/menu-item-row'

jest.mock('@/components/menu/menu-item-image', () => ({
  MenuItemImage: () => null,
}))

jest.mock('@/utils', () => ({ capitalizeFirst: (s: string) => s }))

jest.mock('cart-price-calc', () => ({
  formatCurrencyNative: (n: number) => `${n}đ`,
}))

jest.mock('lucide-react-native', () => ({ Plus: () => null }))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (k: string) => k }),
}))

function renderRow(
  hasStock: boolean,
  onAddToCart = jest.fn(),
  over: Partial<{
    description: string
    isTopSell: boolean
    isNew: boolean
  }> = {},
) {
  render(
    <MenuItemRow
      id="tra-dao"
      name="Trà đào"
      description=""
      isTopSell={false}
      isNew={false}
      {...over}
      imageUrl={null}
      listIndex={0}
      rawPrice={45000}
      promotionValue={0}
      primaryColor="#F7A737"
      isDark={false}
      hasStock={hasStock}
      onDetail={jest.fn()}
      onAddToCart={onAddToCart}
    />,
  )
  return onAddToCart
}

it('còn hàng: nút + có nhãn trợ năng và thêm được', () => {
  const onAdd = renderRow(true)
  const button = screen.getByLabelText('menu.addToCartA11y')
  expect(button.props.accessibilityState).toEqual(
    expect.objectContaining({ disabled: false }),
  )
  fireEvent.press(button)
  expect(onAdd).toHaveBeenCalledWith('tra-dao')
  expect(screen.queryByText('menu.outOfStock')).toBeNull()
})

it('hết hàng: gắn nhãn "Hết hàng" và tắt nút +', () => {
  const onAdd = renderRow(false)
  expect(screen.getByText('menu.outOfStock')).toBeTruthy()
  const button = screen.getByLabelText('menu.addToCartA11y')
  expect(button.props.accessibilityState).toEqual(
    expect.objectContaining({ disabled: true }),
  )
  fireEvent.press(button)
  expect(onAdd).not.toHaveBeenCalled()
})

// Dòng món gọn (bố cục mới): mô tả một dòng dưới tên, nhãn Bán chạy / Mới.
it('có mô tả: hiện một dòng dưới tên món', () => {
  renderRow(true, jest.fn(), { description: 'Đào ngâm, trà đen' })
  const desc = screen.getByText('Đào ngâm, trà đen')
  expect(desc.props.numberOfLines).toBe(1)
})

it('mô tả trống / toàn khoảng trắng: không chừa dòng trống', () => {
  renderRow(true, jest.fn(), { description: '   ' })
  expect(screen.queryByTestId('menu-row-description')).toBeNull()
})

it('nhãn Bán chạy / Mới theo món', () => {
  renderRow(true, jest.fn(), { isTopSell: true, isNew: true })
  expect(screen.getByText('menu.isTopSell')).toBeTruthy()
  expect(screen.getByText('menu.isNewProduct')).toBeTruthy()
})

it('món thường: không có nhãn', () => {
  renderRow(true)
  expect(screen.queryByText('menu.isTopSell')).toBeNull()
  expect(screen.queryByText('menu.isNewProduct')).toBeNull()
})
