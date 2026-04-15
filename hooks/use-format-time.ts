import { useMemo } from 'react'

/**
 * Memoized time formatter for countdown displays
 * Converts seconds to MM:SS format
 */
export function useFormatTime(seconds: number): string {
  return useMemo(() => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }, [seconds])
}
