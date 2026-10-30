// Ảnh banner hiện ĐỦ, không bị cắt: khung theo tỉ lệ 16:9 của ảnh admin, ảnh
// dùng contentFit "contain". Ảnh đúng 16:9 vừa khít (giống cover); ảnh lệch tỉ
// lệ (vd. 21:9) hiện đủ với dải trống thay vì bị cắt chữ âm thầm.
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

it('SB1 ảnh banner hiện đủ, không cắt (contain)', () => {
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
  expect(mockImageProps[0].contentFit).toBe('contain')
})
