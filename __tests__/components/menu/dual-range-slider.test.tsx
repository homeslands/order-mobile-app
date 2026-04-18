jest.mock('react-native-css-interop', () => ({
  remapProps: (c: unknown) => c,
  cssInterop: (c: unknown) => c,
  useColorScheme: jest.fn(() => ({ colorScheme: 'light' })),
}))

jest.mock('react-native/Libraries/Utilities/Dimensions', () => {
  const mockGet = jest.fn(() => ({ width: 390, height: 844 }))
  return {
    default: {
      get: mockGet,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    get: mockGet,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }
})

jest.mock('@/constants/colors.constant', () => ({
  colors: {
    primary: { light: '#000000', dark: '#ffffff' },
    gray: {
      200: '#e5e7eb',
      400: '#9ca3af',
      500: '#6b7280',
      700: '#374151',
      800: '#1f2937',
    },
    white: { light: '#ffffff', dark: '#000000' },
  },
}))

import React from 'react'
import { PanResponder } from 'react-native'
import { render } from '@testing-library/react-native'
import DualRangeSlider from '@/components/menu/dual-range-slider'

describe('DualRangeSlider', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(
      <DualRangeSlider
        min={0}
        max={100}
        value={[20, 80]}
        onValueChange={jest.fn()}
      />,
    )
    expect(toJSON()).not.toBeNull()
  })

  it('does not recreate pan responders on re-render', () => {
    const createSpy = jest.spyOn(PanResponder, 'create')
    createSpy.mockClear()

    const onValueChange = jest.fn()
    const { rerender } = render(
      <DualRangeSlider
        min={0}
        max={100}
        value={[20, 80]}
        onValueChange={onValueChange}
      />,
    )
    const callsAfterMount = createSpy.mock.calls.length

    rerender(
      <DualRangeSlider
        min={0}
        max={100}
        value={[30, 70]}
        onValueChange={onValueChange}
      />,
    )
    expect(createSpy.mock.calls.length).toBe(callsAfterMount)
    createSpy.mockRestore()
  })
})
