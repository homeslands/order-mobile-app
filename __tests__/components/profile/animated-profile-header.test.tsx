import { render } from '@testing-library/react-native'
import { useSharedValue } from 'react-native-reanimated'

jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return
  require('react-native-reanimated/mock'),
)
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }))
jest.mock('@/constants', () => ({
  colors: {
    primary: { light: '#000', dark: '#fff' },
    background: { light: '#fff', dark: '#000' },
    gray: {
      100: '#f3f4f6',
      300: '#d1d5db',
      500: '#6b7280',
      900: '#111827',
    },
    destructive: { light: '#ef4444', dark: '#f87171' },
  },
  SPRING_CONFIGS: {},
}))
jest.mock('@/constants/status-bar', () => ({
  STATIC_TOP_INSET: 44,
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}))

import { AnimatedProfileHeader } from '@/components/profile/animated-profile-header'

describe('AnimatedProfileHeader', () => {
  it('renders without crashing when scrollY is a SharedValue', () => {
    function Wrapper() {
      const scrollY = useSharedValue(0)
      return (
        <AnimatedProfileHeader
          firstName="Test"
          lastName="User"
          phoneNumber="0900000000"
          initials="TU"
          scrollY={scrollY}
          onEditPress={() => {}}
          onQRPress={() => {}}
        />
      )
    }
    expect(() => render(<Wrapper />)).not.toThrow()
  })

  it('renders user name', () => {
    function Wrapper() {
      const scrollY = useSharedValue(0)
      return (
        <AnimatedProfileHeader
          firstName="Test"
          lastName="User"
          phoneNumber="0900000000"
          initials="TU"
          scrollY={scrollY}
          onEditPress={() => {}}
          onQRPress={() => {}}
        />
      )
    }
    const { getByText } = render(<Wrapper />)
    expect(getByText(/Test/)).toBeTruthy()
  })
})
