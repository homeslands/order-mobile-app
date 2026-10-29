// Ảnh banner neo mép trên: admin đặt logo/tiêu đề ở mép trên ảnh. Với
// contentFit "cover" neo giữa, khung thấp hơn tỉ lệ ảnh sẽ cắt đều trên lẫn
// dưới và mất logo. Neo trên thì chỉ phần đáy bị cắt.
import { render } from '@testing-library/react-native'

import SwiperBanner from '@/components/home/swipper-banner'

const mockImageProps: Record<string, unknown>[] = []

jest.mock('expo-image', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { View } = require('react-native')
  const { createElement: h } = require('react')
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    Image: (p: Record<string, unknown>) => {
      mockImageProps.push(p)
      return h(View, null)
    },
  }
})

jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated/mock'),
)

afterEach(() => {
  // Đọc trước global lười của jest-expo khi môi trường test còn mở.
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('SB1 ảnh banner neo mép trên, chỉ cắt phần đáy', () => {
  render(
    <SwiperBanner
      height={195}
      bannerData={[
        {
          slug: 'b1',
          createdAt: '',
          title: 'x',
          content: '',
          url: '',
          useButtonUrl: false,
          image: 'banner/b1.jpg',
          isActive: true,
          page: 'home',
        } as never,
      ]}
    />,
  )
  expect(mockImageProps.length).toBeGreaterThan(0)
  expect(mockImageProps[0].contentFit).toBe('cover')
  expect(mockImageProps[0].contentPosition).toBe('top')
})
