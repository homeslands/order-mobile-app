// Mock all dependencies so the module can be imported without crashing
jest.mock('@/assets/images', () => ({
  Images: {},
}))

jest.mock('@/constants', () => ({
  OrderFlowStep: {},
  ROUTE: { CLIENT_MENU: '/menu' },
  publicFileURL: jest.fn((path: string) => path),
}))

jest.mock('@/hooks/use-primary-color', () => ({
  usePrimaryColor: jest.fn(() => '#000000'),
}))

jest.mock('@/hooks', () => ({
  usePressInPrefetchMenuItem: jest.fn(() => jest.fn()),
  usePublicSpecificMenu: jest.fn(() => ({ data: null })),
  useSpecificMenu: jest.fn(() => ({ data: null })),
}))

jest.mock('@/lib/navigation', () => ({
  navigateNative: { replace: jest.fn(), push: jest.fn() },
}))

jest.mock('@/stores', () => ({
  useOrderFlowStore: jest.fn(() => ({})),
  useBranchStore: jest.fn(() => ({})),
  useUserStore: jest.fn(() => ({})),
}))

jest.mock('@/utils', () => ({
  formatCurrency: jest.fn((v: number) => String(v)),
  showToast: jest.fn(),
}))

jest.mock('expo-image', () => ({
  Image: () => null,
}))

jest.mock('lucide-react-native', () => ({
  Plus: () => null,
}))

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(() => ({ t: (k: string) => k })),
}))

import SliderRelatedProducts from '@/components/menu/slider-related-products'

it('is wrapped in React.memo', () => {
  expect((SliderRelatedProducts as any).$$typeof).toBe(
    Symbol.for('react.memo'),
  )
})
