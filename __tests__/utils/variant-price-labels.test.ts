// Món nhiều size: thẻ size rẻ nhất ghi giá đầy đủ, các size khác ghi phần
// chênh (+6.000 đ) để khách thấy ngay lên size tốn thêm bao nhiêu.
import type { IProductVariant } from '@/types'
import { variantPriceLabels } from '@/utils/product-detail-calc'

const v = (slug: string, price: number) =>
  ({ slug, price, size: { name: slug } }) as unknown as IProductVariant

it('VP1 rẻ nhất ghi giá đầy đủ, size khác ghi phần chênh', () => {
  const labels = variantPriceLabels([
    v('s', 35000),
    v('m', 41000),
    v('l', 45000),
  ])
  expect(labels.get('s')).toBe('35.000 đ')
  expect(labels.get('m')).toBe('+6.000 đ')
  expect(labels.get('l')).toBe('+10.000 đ')
})

it('VP2 không phụ thuộc thứ tự API trả về', () => {
  const labels = variantPriceLabels([v('l', 45000), v('s', 35000)])
  expect(labels.get('s')).toBe('35.000 đ')
  expect(labels.get('l')).toBe('+10.000 đ')
})

it('VP3 hai size cùng giá thấp nhất: cả hai ghi giá đầy đủ', () => {
  const labels = variantPriceLabels([v('a', 30000), v('b', 30000)])
  expect(labels.get('a')).toBe('30.000 đ')
  expect(labels.get('b')).toBe('30.000 đ')
})
