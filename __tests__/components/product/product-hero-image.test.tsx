jest.mock('expo-image', () => ({
  Image: () => null,
}))
// eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
  expect((ProductHeroImage as { $$typeof?: symbol }).$$typeof).toBe(Symbol.for('react.memo'))
})
