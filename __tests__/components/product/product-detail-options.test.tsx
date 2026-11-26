// Trang chi tiết món (bố cục mới): món một size không còn "nút" cam như thể có
// lựa chọn; món nhiều size là thẻ có giá; khách gõ được ghi chú cho quán —
// trước đây trang này không có chỗ ghi chú.
import { fireEvent, render, screen } from '@testing-library/react-native'

import { ProductDetailOptionsSection } from '@/components/product/product-detail-options-section'
import type { IProductVariant } from '@/types'

let mockNote = ''
const mockSetNote = jest.fn()
const mockSetSelection = jest.fn()

jest.mock('@/stores/selectors', () => ({
  useDetailSize: () => 's',
  useDetailSetSelection: () => mockSetSelection,
  useDetailNote: () => mockNote,
  useDetailSetNote: () => mockSetNote,
}))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

const v = (slug: string, price: number) =>
  ({ slug, price, size: { name: slug } }) as unknown as IProductVariant

const labels = {
  sizeLabel: 'Size',
  noteTitle: 'Ghi chú cho quán',
  notePlaceholder: 'Ghi chú thêm',
  stockLabel: 'Còn',
}

function renderSection(variants: IProductVariant[]) {
  return render(
    <ProductDetailOptionsSection
      productSlug="p1"
      variants={variants}
      isLimit={false}
      currentStock={0}
      defaultStock={0}
      {...labels}
    />,
  )
}

beforeEach(() => {
  mockNote = ''
  mockSetNote.mockClear()
  mockSetSelection.mockClear()
})

it('PD1 một size: hiện tên size, không phải nút chọn', () => {
  renderSection([v('Tiêu chuẩn', 39000)])
  expect(screen.getByText('Tiêu chuẩn')).toBeTruthy()
  expect(screen.queryAllByRole('radio')).toHaveLength(0)
})

it('PD2 nhiều size: thẻ ghi giá / phần chênh, bấm thì chọn size', () => {
  renderSection([v('s', 35000), v('m', 41000)])
  expect(screen.getAllByRole('radio')).toHaveLength(2)
  expect(screen.getByText('35.000 đ')).toBeTruthy()
  expect(screen.getByText('+6.000 đ')).toBeTruthy()
  fireEvent.press(screen.getByText('m'))
  expect(mockSetSelection).toHaveBeenLastCalledWith(
    expect.objectContaining({ size: 'm', price: 41000 }),
  )
})

it('PD5 gõ ghi chú: ghi thẳng vào ghi chú của món', () => {
  renderSection([v('s', 35000)])
  fireEvent.changeText(
    screen.getByPlaceholderText('Ghi chú thêm'),
    'giao sau 5 phút',
  )
  expect(mockSetNote).toHaveBeenCalledWith('giao sau 5 phút')
})

it('PD6 không có chip ghi chú (menu có cả đồ ăn), không còn khối "Mô tả / Không có mô tả" ở phần lựa chọn', () => {
  renderSection([v('s', 35000)])
  expect(screen.queryByText(/mô tả/i)).toBeNull()
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
})
