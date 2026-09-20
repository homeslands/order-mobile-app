import { render, screen } from '@testing-library/react-native'

import { GlassSheetBackground } from '@/components/ui/glass-sheet-background'

jest.mock('@/components/ui/glass-surface', () => ({
  GlassSurface: (props: Record<string, unknown>) => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { createElement: h } = require('react')
    const { View } = require('react-native')
    /* eslint-enable @typescript-eslint/no-require-imports */
    return h(View, { testID: 'glass-surface', ...props })
  },
}))

describe('GlassSheetBackground', () => {
  it('bo góc trên của sheet và nhận style do gorhom truyền vào', () => {
    render(
      <GlassSheetBackground
        style={{ backgroundColor: 'red' }}
        animatedIndex={{ value: 0 } as never}
        animatedPosition={{ value: 0 } as never}
      />,
    )

    const surface = screen.getByTestId('glass-surface')
    expect(surface.props.radius).toBe(24)
    expect(surface.props.color).toBeDefined()
  })

  it('giữ đúng accessibility + pointerEvents của nền mặc định gorhom', () => {
    render(
      <GlassSheetBackground
        style={{ backgroundColor: 'red' }}
        pointerEvents="none"
        animatedIndex={{ value: 0 } as never}
        animatedPosition={{ value: 0 } as never}
      />,
    )

    const root = screen.getByLabelText('Bottom Sheet')
    expect(root.props.accessible).toBe(true)
    expect(root.props.accessibilityRole).toBe('adjustable')
    expect(root.props.pointerEvents).toBe('none')
  })
})
