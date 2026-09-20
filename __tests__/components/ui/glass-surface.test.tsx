import { render, screen } from '@testing-library/react-native'

import { GlassSurface } from '@/components/ui/glass-surface'
import { Text } from '@/components/ui/text'

// Mock tối giản để đọc được props truyền xuống GlassView.
jest.mock('expo-glass-effect', () => ({
  GlassView: (props: Record<string, unknown>) => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    // Không đặt tên "createElement": NativeWind babel plugin viết lại lệnh
    // gọi đó và tham chiếu biến ngoài factory.
    const { createElement: h } = require('react')
    const { View } = require('react-native')
    /* eslint-enable @typescript-eslint/no-require-imports */
    return h(View, { testID: 'glass-view', ...props })
  },
  isLiquidGlassAvailable: () => true,
}))

let mockLevel = 1
jest.mock('@/hooks/use-glass-level', () => ({
  useGlassLevel: () => mockLevel,
}))

describe('GlassSurface', () => {
  it('mức 0: nền đặc, không dựng GlassView', () => {
    mockLevel = 0
    render(
      <GlassSurface color="#ffffff" radius={16} testID="surface">
        <Text>nội dung</Text>
      </GlassSurface>,
    )

    expect(screen.queryByTestId('glass-view')).toBeNull()
    expect(screen.getByTestId('surface')).toHaveStyle({
      backgroundColor: '#ffffff',
      borderRadius: 16,
    })
    expect(screen.getByText('nội dung')).toBeTruthy()
  })

  it('mức 1: dựng GlassView, không pha màu', () => {
    mockLevel = 1
    render(<GlassSurface color="#ffffff" testID="surface" />)

    const glass = screen.getByTestId('glass-view')
    expect(glass.props.tintColor).toBeUndefined()
    expect(glass.props.glassEffectStyle).toBe('regular')
    expect(screen.getByTestId('surface')).not.toHaveStyle({
      backgroundColor: '#ffffff',
    })
  })

  it('mức giữa: pha chính màu nền theo độ đục còn lại', () => {
    mockLevel = 0.25
    render(<GlassSurface color="#ffffff" testID="surface" />)

    expect(screen.getByTestId('glass-view').props.tintColor).toBe(
      'rgba(255, 255, 255, 0.75)',
    )
  })

  it('tint riêng giữ màu thương hiệu', () => {
    mockLevel = 0.5
    render(<GlassSurface color="#ffffff" tint="#F7A737" testID="surface" />)

    expect(screen.getByTestId('glass-view').props.tintColor).toBe(
      'rgba(247, 167, 55, 0.5)',
    )
  })

  it('interactive truyền xuống GlassView', () => {
    mockLevel = 1
    render(<GlassSurface color="#ffffff" interactive testID="surface" />)

    expect(screen.getByTestId('glass-view').props.isInteractive).toBe(true)
  })

  it('interactive: GlassView không bị pointerEvents "none" chặn chạm', () => {
    mockLevel = 1
    render(<GlassSurface color="#ffffff" interactive testID="surface" />)

    expect(screen.getByTestId('glass-view').props.pointerEvents).not.toBe(
      'none',
    )
  })

  it('không interactive: GlassView vẫn giữ pointerEvents "none"', () => {
    mockLevel = 1
    render(<GlassSurface color="#ffffff" testID="surface" />)

    expect(screen.getByTestId('glass-view').props.pointerEvents).toBe('none')
  })

  it('prop level thắng giá trị từ hook (dùng cho ô xem trước)', () => {
    mockLevel = 1
    render(<GlassSurface color="#ffffff" level={0.25} testID="surface" />)

    expect(screen.getByTestId('glass-view').props.tintColor).toBe(
      'rgba(255, 255, 255, 0.75)',
    )
  })
})
