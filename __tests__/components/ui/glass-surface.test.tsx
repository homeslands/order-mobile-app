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

let mockGlass = true
jest.mock('@/hooks/use-glass', () => ({
  useGlassEnabled: () => mockGlass,
}))

describe('GlassSurface', () => {
  it('không có kính: nền đặc, không dựng GlassView', () => {
    mockGlass = false
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

  it('có kính: dựng GlassView, không pha màu', () => {
    mockGlass = true
    render(<GlassSurface color="#ffffff" testID="surface" />)

    const glass = screen.getByTestId('glass-view')
    expect(glass.props.tintColor).toBeUndefined()
    expect(glass.props.glassEffectStyle).toBe('regular')
    expect(screen.getByTestId('surface')).not.toHaveStyle({
      backgroundColor: '#ffffff',
    })
  })

  it('tint riêng giữ màu thương hiệu, cố ý đè lên lựa chọn hệ thống', () => {
    mockGlass = true
    render(<GlassSurface color="#ffffff" tint="#F7A737" testID="surface" />)

    expect(screen.getByTestId('glass-view').props.tintColor).toBe(
      'rgba(247, 167, 55, 0.5)',
    )
  })

  it('interactive truyền xuống GlassView', () => {
    mockGlass = true
    render(<GlassSurface color="#ffffff" interactive testID="surface" />)

    expect(screen.getByTestId('glass-view').props.isInteractive).toBe(true)
  })

  it('interactive: GlassView không bị pointerEvents "none" chặn chạm', () => {
    mockGlass = true
    render(<GlassSurface color="#ffffff" interactive testID="surface" />)

    expect(screen.getByTestId('glass-view').props.pointerEvents).not.toBe(
      'none',
    )
  })

  it('không interactive: GlassView vẫn giữ pointerEvents "none"', () => {
    mockGlass = true
    render(<GlassSurface color="#ffffff" testID="surface" />)

    expect(screen.getByTestId('glass-view').props.pointerEvents).toBe('none')
  })
})
