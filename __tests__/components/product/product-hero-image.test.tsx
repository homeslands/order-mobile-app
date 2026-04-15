jest.mock('expo-image', () => ({
  Image: () => null,
}))
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  createAnimatedComponent: (c: unknown) => c,
}))
jest.mock('react-native-reanimated-carousel', () => ({
  default: () => null,
}))
jest.mock('@/constants', () => ({
  colors: { gray: {}, primary: '#000' },
  publicFileURL: '',
}))

import { ProductHeroImage } from '@/components/product/product-hero-image'

it('is wrapped in React.memo', () => {
  expect((ProductHeroImage as any).$$typeof).toBe(Symbol.for('react.memo'))
})
