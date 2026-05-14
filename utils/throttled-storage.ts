import type { StateStorage } from 'zustand/middleware'

/**
 * Wraps a StateStorage with a trailing debounce on setItem.
 * Reads and removes are pass-through (immediate).
 * The latest value is always what gets written when the timer fires —
 * never a stale snapshot.
 *
 * @param base  The underlying storage (e.g. createSafeStorage())
 * @param ms    Debounce window in milliseconds (default 300)
 */
export function throttledStorage(base: StateStorage, ms = 300): StateStorage {
  let pending: { key: string; value: string } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  return {
    getItem: (key) => base.getItem(key),
    removeItem: (key) => base.removeItem(key),
    setItem: (key, value) => {
      pending = { key, value }
      if (timer !== null) return
      timer = setTimeout(() => {
        timer = null
        if (pending) {
          base.setItem(pending.key, pending.value)
          pending = null
        }
      }, ms)
    },
  }
}
