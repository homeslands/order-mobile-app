import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'

export interface IDebouncedInputProps {
  defaultValue?: string
  delay?: number
}

export function useDebouncedInput({
  defaultValue = '',
  delay = 500,
}: IDebouncedInputProps = {}) {
  const [inputValue, setInputValue] = useState<string>(defaultValue)
  const [debouncedInputValue] = useDebounce(inputValue, delay)
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value)
    setIsLoading(true)
  }, [])

  useEffect(() => {
    if (!isLoading) return
    timerRef.current = setTimeout(() => setIsLoading(false), delay)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isLoading, inputValue, delay])

  return {
    inputValue,
    setInputValue: handleInputChange,
    debouncedInputValue,
    isLoading,
  }
}
