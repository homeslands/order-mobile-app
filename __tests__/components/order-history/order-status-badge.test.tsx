// Nhãn trạng thái đơn dùng chung cho Lịch sử đơn và Chi tiết đơn — một nguồn
// màu, một cách gộp trạng thái (trước đây màn chi tiết để PAID và COMPLETED
// cùng màu, đơn thất bại hiện chữ thô "failed").
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { OrderStatusBadge } from '@/components/order-history/order-status-badge'
import { colors } from '@/constants'

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

it('SB1 nền theo trạng thái, chữ trắng', () => {
  render(<OrderStatusBadge status="failed" label="Thất bại" />)
  expect(
    StyleSheet.flatten(screen.getByTestId('order-status-badge').props.style)
      .backgroundColor,
  ).toBe(colors.destructive.light)
  expect(
    StyleSheet.flatten(screen.getByText('Thất bại').props.style).color,
  ).toBe(colors.white.light)
})
