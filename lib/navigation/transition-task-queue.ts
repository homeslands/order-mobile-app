/**
 * Task 4 — Total Thread Isolation (Steel Curtain).
 *
 * Global Task Queue: Side effects (Analytics, Storage Write, Heavy Selectors)
 * được queue khi isTransitioning = true. Flush đồng bộ tại transitionEnd để
 * preserve FIFO ordering (xem setTransitionQueueing comment).
 */
const queue: Array<() => void> = []
let isQueueing = false
let flushTimeoutId: ReturnType<typeof setTimeout> | null = null

function clearFlushTimeout() {
  if (flushTimeoutId) {
    clearTimeout(flushTimeoutId)
    flushTimeoutId = null
  }
}

function flush() {
  clearFlushTimeout()
  const tasks = [...queue]
  queue.length = 0
  tasks.forEach((fn) => {
    try {
      fn()
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[TransitionTaskQueue] Task error:', err)
      }
    }
  })
}

/**
 * Gọi khi transition bắt đầu hoặc kết thúc.
 *
 * enabled=true (transitionStart): cancel flush đang pending từ transition trước.
 * Nếu không cancel, flush của transition B có thể fire giữa transition C,
 * gây state update bất ngờ trong lúc animation đang chạy.
 *
 * enabled=false (transitionEnd): flush đồng bộ NGAY (không schedule delay).
 * Flush sync bảo đảm FIFO ordering: tasks queue trong khi transition luôn
 * chạy trước các tasks sync mới đến sau khi transition kết thúc. Nếu schedule
 * flush 100ms sau, tasks sync mới trong 100ms window sẽ chạy trước tasks đã
 * queue → sai order.
 */
export function setTransitionQueueing(enabled: boolean) {
  if (enabled) {
    isQueueing = true
    // Transition mới bắt đầu — hủy flush từ transition trước.
    // Tasks đã queue vẫn còn trong queue, sẽ flush khi transition hiện tại kết thúc.
    clearFlushTimeout()
  } else {
    // Flush sync TRƯỚC khi disable queueing để preserve FIFO ordering.
    // Nếu disable trước rồi flush async, tasks sync mới có thể "cắt hàng".
    isQueueing = false
    flush()
  }
}

/**
 * Lên lịch side effect. Nếu đang transitioning → queue. Ngược lại → chạy ngay.
 * Dùng cho: Analytics, Storage Write, Zustand updates nặng, Heavy selectors.
 */
export function scheduleTransitionTask(fn: () => void) {
  if (isQueueing) {
    queue.push(fn)
  } else {
    try {
      fn()
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[TransitionTaskQueue] Task error:', err)
      }
    }
  }
}

/**
 * Kiểm tra có đang queue không (để tránh double-schedule).
 */
export function isTransitionQueueing() {
  return isQueueing
}
