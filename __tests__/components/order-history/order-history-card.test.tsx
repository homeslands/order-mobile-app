// Thẻ đơn gọn ở Lịch sử đơn: loại đơn + giờ + ngày, nhãn trạng thái đúng màu, dải
// ảnh món (tối đa 4, "+N"), tên món gộp một dòng, số món + tổng tiền. Bảng
// tính tiền chi tiết nằm ở màn chi tiết đơn.
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { OrderHistoryCard } from '@/components/order-history/order-history-card'
import { colors } from '@/constants'
import type { IOrder } from '@/types'

const mockImages: string[] = []
jest.mock('@/components/menu/menu-item-image', () => ({
  MenuItemImage: (p: { id: string }) => {
    mockImages.push(p.id)
    return null
  },
}))
jest.mock('@/utils/product-image-url', () => ({
  IMAGE_PRESET: { THUMB: 384 },
  getProductImageUrl: (p?: string) => (p ? `https://cdn/${p}` : null),
}))
jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))
jest.mock('lucide-react-native', () => ({
  ShoppingBag: () => null,
  Utensils: () => null,
  Truck: () => null,
}))

const item = (slug: string, name: string, quantity = 1) => ({
  slug,
  quantity,
  variant: { product: { name, image: `${slug}.jpg` } },
})

function order(over: Partial<IOrder> = {}): IOrder {
  return {
    slug: 'o1',
    createdAt: new Date(2026, 10, 26, 14, 32).toISOString(),
    type: 'take-out',
    status: 'paid',
    payment: { statusCode: 'completed' },
    subtotal: 126000,
    orderItems: [item('a', 'cà phê sữa', 2), item('b', 'bạc xỉu')],
    ...over,
  } as unknown as IOrder
}

const labels = {
  type: { 'at-table': 'Tại bàn', 'take-out': 'Mang về', delivery: 'Giao hàng' },
  status: {
    unpaid: 'Chưa thanh toán',
    paid: 'Đã thanh toán',
    completed: 'Hoàn tất',
    failed: 'Thất bại',
  },
  itemCount: (n: number) => `${n} món`,
  total: 'Tổng',
  formatPrice: (n: number) => `${n}đ`,
}

function renderCard(o: IOrder, onPress = jest.fn()) {
  render(
    <OrderHistoryCard
      order={o}
      primaryColor="#F7A737"
      isDark={false}
      labels={labels}
      onPress={onPress}
    />,
  )
  return onPress
}

beforeEach(() => {
  mockImages.length = 0
})

it('OC1 loại đơn + giờ + ngày, tổng tiền, số món tính theo số lượng', () => {
  renderCard(order())
  expect(screen.getByText('Mang về · 14:32 26/11/2026')).toBeTruthy()
  expect(screen.getByText('126000đ')).toBeTruthy()
  expect(screen.getByText('3 món')).toBeTruthy()
})

it('OC2 tên món gộp một dòng, kèm số lượng khi >1', () => {
  renderCard(order())
  const names = screen.getByText('Cà phê sữa ×2, Bạc xỉu')
  expect(names.props.numberOfLines).toBe(1)
})

it('OC3 dải ảnh tối đa 4, phần còn lại ghi "+N"', () => {
  renderCard(
    order({
      orderItems: ['a', 'b', 'c', 'd', 'e', 'f'].map((s) =>
        item(s, s),
      ) as unknown as IOrder['orderItems'],
    }),
  )
  expect(mockImages).toHaveLength(4)
  expect(screen.getByText('+2')).toBeTruthy()
})

it('OC4 nhãn trạng thái theo trạng thái đơn, đúng màu', () => {
  renderCard(order({ status: 'failed' } as Partial<IOrder>))
  const badge = screen.getByText('Thất bại')
  expect(StyleSheet.flatten(badge.props.style).color).toBe(
    colors.destructive.light,
  )
})

it('OC5 bấm thẻ mở đơn', () => {
  const onPress = renderCard(order())
  fireEvent.press(screen.getByText('Cà phê sữa ×2, Bạc xỉu'))
  expect(onPress).toHaveBeenCalledWith('o1')
})

// Bốn nhãn phải khác tông: trước đây "Chưa thanh toán" (vàng) và "Đã thanh
// toán" (cam thương hiệu) trông như nhau.
it('OC6 bốn trạng thái, bốn màu chữ khác nhau, không trùng màu giá (cam)', () => {
  const textColor = (status: string, pay?: string) => {
    renderCard(
      order({
        status,
        payment: pay ? { statusCode: pay } : undefined,
      } as Partial<IOrder>),
    )
    const label = screen.getByTestId('order-status-badge-text')
    const c = StyleSheet.flatten(label.props.style).color as string
    screen.unmount()
    return c
  }
  const all = [
    textColor('pending'),
    textColor('paid', 'completed'),
    textColor('completed', 'completed'),
    textColor('failed'),
  ]
  expect(new Set(all).size).toBe(4)
  expect(all).not.toContain('#F7A737')
  expect(all[1]).toBe(colors.success.borderDark)
})
