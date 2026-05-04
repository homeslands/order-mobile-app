jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
)

import { render, fireEvent } from '@testing-library/react-native'
import { DeliveryInfoRow } from '@/components/delivery/delivery-info-row'

describe('DeliveryInfoRow', () => {
  it('renders CTA text when no address', () => {
    const { getByText } = render(
      <DeliveryInfoRow address="" onPress={jest.fn()} isDark={false} />,
    )
    expect(getByText('Chọn địa chỉ giao hàng')).toBeTruthy()
  })

  it('renders address text when address provided', () => {
    const { getByText } = render(
      <DeliveryInfoRow
        address="123 Nguyễn Trãi, Q.5"
        onPress={jest.fn()}
        isDark={false}
      />,
    )
    expect(getByText('123 Nguyễn Trãi, Q.5')).toBeTruthy()
  })

  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    const { getByTestId } = render(
      <DeliveryInfoRow address="" onPress={onPress} isDark={false} />,
    )
    fireEvent.press(getByTestId('delivery-info-row'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
