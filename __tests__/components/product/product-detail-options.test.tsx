// Trang chi tiết món (bố cục mới): món một size không còn "nút" cam như thể có
// lựa chọn; món nhiều size là thẻ có giá; khách ghi chú được bằng chip hoặc
// gõ — trước đây trang này không có chỗ ghi chú.
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
  noteChips: ['Ít đá', 'Ít ngọt'],
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

it('PD3 bấm chip ghi chú: thêm cụm vào ghi chú', () => {
  mockNote = 'Ít đá'
  renderSection([v('s', 35000)])
  fireEvent.press(screen.getByText('Ít ngọt'))
  expect(mockSetNote).toHaveBeenCalledWith('Ít đá, Ít ngọt')
})

it('PD4 chip đã có trong ghi chú thì hiện là đang chọn', () => {
  mockNote = 'Ít đá'
  renderSection([v('s', 35000)])
  const chip = screen.getByRole('checkbox', { name: 'Ít đá' })
  expect(chip.props.accessibilityState).toEqual(
    expect.objectContaining({ checked: true }),
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

it('PD6 không còn khối "Mô tả / Không có mô tả" ở phần lựa chọn', () => {
  renderSection([v('s', 35000)])
  expect(screen.queryByText(/mô tả/i)).toBeNull()
})
