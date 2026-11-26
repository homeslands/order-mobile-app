// Mô tả món nằm ngay dưới giá và ẩn hẳn khi trống (trước đây là khối
// "Note / No description" trông như ô ghi chú). Món bán chạy / mới có nhãn.
import { render, screen } from '@testing-library/react-native'

import { ProductInfoCard } from '@/components/product/product-info-card'

jest.mock('cart-price-calc', () => ({
  formatCurrencyNative: (n: number) => `${n}đ`,
}))
jest.mock('@/hooks/use-primary-color', () => ({
  usePrimaryColor: () => '#F7A737',
}))
jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

const base = {
  name: 'nước dừa',
  basePrice: 39000,
  promotionValue: 0,
  topSellLabel: 'Bán chạy',
  newLabel: 'Mới',
}

it('PI1 có mô tả: hiện dưới giá', () => {
  render(<ProductInfoCard {...base} description="Dừa xiêm Bến Tre" />)
  expect(screen.getByText('Dừa xiêm Bến Tre')).toBeTruthy()
})

it('PI2 mô tả trống / toàn khoảng trắng: không hiện gì', () => {
  const blank = render(<ProductInfoCard {...base} description="   " />)
  const blankTree = JSON.stringify(blank.toJSON())
  blank.unmount()
  const none = render(<ProductInfoCard {...base} description="" />)
  expect(blankTree).toBe(JSON.stringify(none.toJSON()))
  expect(screen.queryByText(/description|mô tả/i)).toBeNull()
})

it('PI3 nhãn Bán chạy / Mới theo món', () => {
  render(<ProductInfoCard {...base} description="" isTopSell isNew />)
  expect(screen.getByText('Bán chạy')).toBeTruthy()
  expect(screen.getByText('Mới')).toBeTruthy()
})

it('PI4 món thường: không có nhãn', () => {
  render(<ProductInfoCard {...base} description="" />)
  expect(screen.queryByText('Bán chạy')).toBeNull()
  expect(screen.queryByText('Mới')).toBeNull()
})
