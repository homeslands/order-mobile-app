// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
jest.mock('@/constants/navigation.config', () => ({ TAB_ROUTES: { CART: '/(tabs)/cart' } }))
jest.mock('@/stores/selectors', () => ({ useOrderFlowCartItemCount: () => 0 }))
jest.mock('@/components/navigation/native-gesture-pressable', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const { View } = require('react-native')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  return { NativeGesturePressable: View }
})

import { render } from '@testing-library/react-native'
import { FloatingCartButton } from '@/components/navigation/floating-cart-button'

describe('FloatingCartButton', () => {
  it('renders without crashing', () => {
    expect(() => render(<FloatingCartButton primaryColor="#4f46e5" />)).not.toThrow()
  })
  it('is wrapped in React.memo', () => {
    expect((FloatingCartButton as { $$typeof?: symbol }).$$typeof).toBe(Symbol.for('react.memo'))
  })
})
