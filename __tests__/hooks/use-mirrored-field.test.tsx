import { act, renderHook } from '@testing-library/react-native'

import { useMirroredField } from '@/hooks/use-mirrored-field'

describe('useMirroredField', () => {
  it('đẩy giá trị vào form ngay, không chờ debounce', () => {
    const onChange = jest.fn()
    const { result } = renderHook(
      ({ value }) => useMirroredField({ value, onChange }),
      { initialProps: { value: '' } },
    )

    act(() => result.current.onChangeText('0901234567'))

    expect(onChange).toHaveBeenCalledWith('0901234567')
    expect(result.current.value).toBe('0901234567')
  })

  it('bỏ qua tiếng vọng của chính lần đẩy vừa rồi', () => {
    const onChange = jest.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useMirroredField({ value, onChange }),
      { initialProps: { value: '' } },
    )

    act(() => result.current.onChangeText('090'))
    rerender({ value: '090' })

    expect(result.current.value).toBe('090')
  })

  it('đồng bộ khi form đổi giá trị từ bên ngoài', () => {
    const onChange = jest.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useMirroredField({ value, onChange }),
      { initialProps: { value: '' } },
    )

    act(() => result.current.onChangeText('0901'))
    rerender({ value: '0901' })

    expect(result.current.value).toBe('0901')

    rerender({ value: '' })

    expect(result.current.value).toBe('')
  })

  it('áp dụng transform trước khi đẩy vào form', () => {
    const onChange = jest.fn()
    const { result } = renderHook(() =>
      useMirroredField({
        value: '',
        onChange,
        transform: (v) => v.replace(/\D/g, ''),
      }),
    )

    act(() => result.current.onChangeText('090 123 4567'))

    expect(onChange).toHaveBeenCalledWith('0901234567')
    expect(result.current.value).toBe('0901234567')
  })
})
