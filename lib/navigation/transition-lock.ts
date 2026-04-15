/**
 * Transition Lock — Prefetch lock (isTransitionLocked).
 * Navigation lock: navigation-lock.ts (isNavigationLocked).
 */
import { STACK_TRANSITION_DURATION_MS } from './constants'

const FALLBACK_LOCK_MS = 600

let lockUntil = 0
let timeoutId: ReturnType<typeof setTimeout> | null = null

const clearTimeoutIfAny = () => {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

export const isTransitionLocked = () => Date.now() < lockUntil

export const acquireTransitionLock = (durationMs = STACK_TRANSITION_DURATION_MS) => {
  clearTimeoutIfAny()
  const lockMs = Math.min(durationMs + 200, FALLBACK_LOCK_MS)
  lockUntil = Date.now() + lockMs
  timeoutId = setTimeout(() => {
    lockUntil = 0
    timeoutId = null
  }, lockMs)
}

export const releaseTransitionLock = () => {
  clearTimeoutIfAny()
  lockUntil = 0
}

export const runWhenUnlocked = <T>(fn: () => T): Promise<T> => {
  return new Promise((resolve) => {
    const check = () => {
      if (!isTransitionLocked()) {
        resolve(fn())
        return
      }
      requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  })
}
