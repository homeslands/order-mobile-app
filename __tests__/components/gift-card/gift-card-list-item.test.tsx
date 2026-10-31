// Ô thẻ quà dùng chung pipeline ảnh với Menu: thumbnail thu nhỏ trên máy, khoá
// theo thẻ khi FlashList tái dùng ô, không crossfade. Trước đây ô hiện thẳng
// ảnh gốc tới 1080px với transition 200ms.
import { render, screen } from '@testing-library/react-native'

import { GiftCardListItem } from '@/components/gift-card/gift-card-list-item'
import type { IGiftCard } from '@/types'
import { getProductImageUrl, IMAGE_PRESET } from '@/utils/product-image-url'

const mockImageProps: Array<Record<string, unknown>> = []
jest.mock('@/components/menu/menu-item-image', () => ({
  MenuItemImage: (props: Record<string, unknown>) => {
    mockImageProps.push(props)
    return null
  },
}))

jest.mock('lucide-react-native', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { Text } = require('react-native')
  const { createElement: h } = require('react')
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    Coins: () => null,
    Plus: () => null,
    Gift: () => h(Text, null, '[GIFT_ICON]'),
  }
})

jest.mock('@/utils', () => ({
  capitalizeFirst: (s: string) => s,
  formatCurrency: (n: number) => `${n}đ`,
  formatPoints: (n: number) => `${n}`,
}))

jest.mock('@/utils/product-image-url', () => ({
  IMAGE_PRESET: { THUMB: 384, HERO: 1080 },
  getProductImageUrl: (p: string | null) => (p ? `https://cdn/${p}` : null),
}))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (k: string) => k }),
}))

function card(over: Partial<IGiftCard>): IGiftCard {
  return {
    slug: 'gc-1',
    title: 'Thẻ 100k',
    image: 'gift/100k.jpg',
    points: 100,
    price: 100000,
    isActive: true,
    ...over,
  } as IGiftCard
}

beforeEach(() => {
  mockImageProps.length = 0
})

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('GC1 có ảnh: dùng MenuItemImage, khoá theo slug, URL thumbnail, không crossfade', () => {
  const item = card({})
  render(
    <GiftCardListItem
      item={item}
      primaryColor="#000"
      isDark={false}
      inCart={false}
      onSelect={() => {}}
    />,
  )
  expect(mockImageProps).toHaveLength(1)
  const props = mockImageProps[0]
  expect(props.id).toBe('gc-1')
  expect(props.imageUrl).toBe(
    getProductImageUrl(item.image, { maxWidth: IMAGE_PRESET.THUMB }),
  )
  expect(props.transitionMs ?? 0).toBe(0)
})

it('GC2 không ảnh: vẫn icon quà dự phòng', () => {
  render(
    <GiftCardListItem
      item={card({ image: '' })}
      primaryColor="#000"
      isDark={false}
      inCart={false}
      onSelect={() => {}}
    />,
  )
  expect(mockImageProps).toHaveLength(0)
  expect(screen.getByText('[GIFT_ICON]')).toBeTruthy()
})
