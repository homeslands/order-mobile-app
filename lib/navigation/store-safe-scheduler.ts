/**
 * Task 4 — Store Safe Scheduler.
 * Defer Zustand/store updates khi transition đang chạy.
 * - isTransitionQueueing: queue vào Global Task Queue, flush sau transition + 100ms
 * - isTransitionLocked: delay sang requestIdleCallback (fallback)
 */
import { isTransitionLocked } from './transition-lock'
import { isTransitionQueueing, scheduleTransitionTask } from './transition-task-queue'

const hasRequestIdleCallback = typeof requestIdleCallback === 'function'

export const scheduleStoreUpdate = (fn: () => void) => {
  if (isTransitionQueueing()) {
    scheduleTransitionTask(fn)
    return
  }
  if (!isTransitionLocked()) {
    fn()
    return
  }
  if (hasRequestIdleCallback) {
    requestIdleCallback(() => fn(), { timeout: 100 })
  } else {
    setTimeout(fn, 50)
  }
}
