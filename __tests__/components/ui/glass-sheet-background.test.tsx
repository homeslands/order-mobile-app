import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { GlassSheetBackground } from '@/components/ui/glass-sheet-background'

// Nền sheet phải đặc, nên không được đi qua GlassSurface ở bất kỳ mức nào.
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
  it('nền đặc, không dùng kính, bo góc theo quy ước sheet của app', () => {
    render(
      <GlassSheetBackground
        style={{ backgroundColor: 'red' }}
        animatedIndex={{ value: 0 } as never}
        animatedPosition={{ value: 0 } as never}
      />,
    )

    expect(screen.queryByTestId('glass-surface')).toBeNull()

    const root = screen.getByLabelText('Bottom Sheet')
    const flat = StyleSheet.flatten(root.props.style)
    expect(flat.borderRadius).toBe(24)
    // Màu nền của app đè lên màu gorhom truyền vào.
    expect(flat.backgroundColor).not.toBe('red')
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
