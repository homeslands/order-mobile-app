import { act, renderHook } from '@testing-library/react-native'
import { useDebouncedInput } from '@/hooks/use-debounced-input'

describe('useDebouncedInput', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('sets isLoading to true immediately when input changes', () => {
    const { result } = renderHook(() => useDebouncedInput({ delay: 300 }))
    act(() => result.current.setInputValue('hello'))
    expect(result.current.isLoading).toBe(true)
  })

  it('sets isLoading to false after delay when still mounted', () => {
    const { result } = renderHook(() => useDebouncedInput({ delay: 300 }))
    act(() => result.current.setInputValue('hello'))
    expect(result.current.isLoading).toBe(true)
    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(result.current.isLoading).toBe(false)
  })

  it('does not throw when unmounted before delay expires', () => {
    const { result, unmount } = renderHook(() =>
      useDebouncedInput({ delay: 500 }),
    )
    act(() => result.current.setInputValue('abc'))
    expect(result.current.isLoading).toBe(true)
    // Unmount before delay — should NOT fire setState
    unmount()
    // Advance past delay — must not throw "Can't perform state update on unmounted"
    expect(() =>
      act(() => {
        jest.advanceTimersByTime(600)
      }),
    ).not.toThrow()
  })

  it('clears previous timeout when input changes rapidly', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    const { result } = renderHook(() => useDebouncedInput({ delay: 300 }))
    act(() => result.current.setInputValue('a'))
    act(() => result.current.setInputValue('ab'))
    // Second setInputValue should trigger cleanup of first timer
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('returns correct debouncedInputValue after delay', () => {
    const { result } = renderHook(() => useDebouncedInput({ delay: 300 }))
    act(() => result.current.setInputValue('search'))
    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(result.current.debouncedInputValue).toBe('search')
  })
})
