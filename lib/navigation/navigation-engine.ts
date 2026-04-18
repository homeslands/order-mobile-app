/**
 * Navigation Engine — Telegram-level instant response.
 *
 * Ưu tiên độ trễ cực thấp từ lúc chạm tới lúc bắt đầu transition.
 * - Khi router sẵn sàng: gọi push/replace/back ngay (không rAF thêm)
 * - Khi router null: retry tối đa MAX_RETRY_FRAMES frame (đã dùng rAF trong retry)
 * - Transition lock: drop tap thứ 2 trong lúc đang transition
 *
 * Flow (gesture):
 * Tap → runOnJS → executeNav → Native Stack animation (UI thread)
 */
import type { Href } from 'expo-router'
import {
  getNavigationRouter,
  isNavigationLocked,
  lockNavigation,
  scheduleUnlock,
  setNavigationRouter,
  unlockNavigation,
  type HrefLike as LockHrefLike,
  type RouterLike as LockRouterLike,
} from './navigation-lock'
import { STACK_TRANSITION_DURATION_MS } from './constants'
import { acquireTransitionLock } from './transition-lock'

export type HrefLike = Href | string

const MAX_RETRY_FRAMES = 20

// Monotonic ID cho retry loop — mỗi executeNav mới tăng ID. Retry callback
// check ID → nếu preempted bởi nav mới, tự hủy để tránh navigate chồng.
let activeRetryId = 0

export type RouterLike = LockRouterLike

export { setNavigationRouter }

const getRouter = () => getNavigationRouter()

/**
 * Push/replace/back — SYNC khi router sẵn sàng.
 * Không setImmediate: gọi push trực tiếp để animation bắt đầu ngay.
 */
export const executeNavFromGesture = (
  type: 'push' | 'replace' | 'navigate' | 'back',
  href?: HrefLike,
) => {
  // Instant path: không thêm rAF, để transition bắt đầu càng sớm càng tốt
  executeNav(type, href, STACK_TRANSITION_DURATION_MS)
}

const executeNav = (
  type: 'push' | 'replace' | 'navigate' | 'back',
  href?: HrefLike,
  duration = STACK_TRANSITION_DURATION_MS,
) => {
  const r = getRouter()
  if (r) {
    // Tab navigate: skip lock entirely. Tab switch là internal state update
    // trong Tabs navigator, không fire root stack transitionEnd → lock chỉ
    // release được qua timer 460ms. Nếu acquire lock, mọi tap tab khác trong
    // 460ms đó bị drop. Bỏ lock → tap tab nhanh luôn responsive.
    // expo-router native handles concurrent navigate calls (deduplication).
    if (type === 'navigate' && href) {
      r.navigate(href as LockHrefLike)
      return
    }

    const seq = lockNavigation()
    try {
      acquireTransitionLock(duration)
      if (type === 'push' && href) r.push(href as LockHrefLike)
      else if (type === 'replace' && href) r.replace(href as LockHrefLike)
      else if (type === 'back') r.back()
    } finally {
      scheduleUnlock(seq)
    }
    return
  }

  // Router null: retry với limit. Mỗi executeNav bump activeRetryId → retry
  // cũ thấy id khác sẽ tự hủy. Tránh race: notification cold-start retry
  // loop đang chạy, user tap nav khác, cả hai cùng push → chồng screen.
  const myId = ++activeRetryId
  let frame = 0
  const retry = () => {
    if (myId !== activeRetryId) return // preempted
    const router = getRouter()
    if (router) {
      // Tab navigate: skip lock (xem comment trong sync path).
      if (type === 'navigate' && href) {
        router.navigate(href as LockHrefLike)
        return
      }

      const seq = lockNavigation()
      try {
        acquireTransitionLock(duration)
        if (type === 'push' && href) router.push(href as LockHrefLike)
        else if (type === 'replace' && href)
          router.replace(href as LockHrefLike)
        else if (type === 'back') router.back()
      } catch (err) {
        unlockNavigation()
        throw err
      } finally {
        scheduleUnlock(seq)
      }
      return
    }
    frame++
    if (frame >= MAX_RETRY_FRAMES) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
          '[NavigationEngine] routerRef null after',
          MAX_RETRY_FRAMES,
          'retries',
        )
      }
      unlockNavigation()
      return
    }
    requestAnimationFrame(retry)
  }
  requestAnimationFrame(retry)
}

/**
 * navigateNative — Instant transition.
 * - Drop tap nếu đang transitioning (tránh double-push)
 * - Push sync khi router ready
 * - Unlock: MasterTransitionProvider gọi unlockNavigation trong transitionEnd
 */
export const navigateNative = {
  push: (href: HrefLike) => {
    if (isNavigationLocked()) return
    executeNav('push', href, STACK_TRANSITION_DURATION_MS)
  },
  replace: (href: HrefLike) => {
    if (isNavigationLocked()) return
    executeNav('replace', href, STACK_TRANSITION_DURATION_MS)
  },
  navigate: (href: HrefLike) => {
    if (isNavigationLocked()) return
    executeNav('navigate', href, STACK_TRANSITION_DURATION_MS)
  },
  back: () => {
    if (isNavigationLocked()) return
    executeNav('back', undefined, STACK_TRANSITION_DURATION_MS)
  },
}

export const navigateNativeImmediate = navigateNative

/** Alias — single entry point. Same as navigateNative. */
export const navigateSafely = navigateNative

const NAV_UNLOCK_WAIT_INTERVAL_MS = 16
const NAV_UNLOCK_WAIT_MAX_MS = 600

/**
 * navigateWhenUnlocked — giống navigateNative nhưng retry đến khi lock release.
 *
 * Dùng cho các flow mà navigation có thể fire trong lúc lock đang active —
 * ví dụ: login success sau khi bottom sheet đóng, deep link handler.
 * Tránh silent drop khi isNavigationLocked() = true tại thời điểm gọi.
 *
 * Không dùng cho gesture handler (dùng navigateNative để drop duplicate tap).
 */
export const navigateWhenUnlocked = {
  replace: (href: HrefLike) => {
    if (!isNavigationLocked()) {
      executeNav('replace', href, STACK_TRANSITION_DURATION_MS)
      return
    }
    let elapsed = 0
    const retry = () => {
      elapsed += NAV_UNLOCK_WAIT_INTERVAL_MS
      if (elapsed > NAV_UNLOCK_WAIT_MAX_MS) return
      if (isNavigationLocked()) {
        setTimeout(retry, NAV_UNLOCK_WAIT_INTERVAL_MS)
        return
      }
      executeNav('replace', href, STACK_TRANSITION_DURATION_MS)
    }
    setTimeout(retry, NAV_UNLOCK_WAIT_INTERVAL_MS)
  },
  push: (href: HrefLike) => {
    if (!isNavigationLocked()) {
      executeNav('push', href, STACK_TRANSITION_DURATION_MS)
      return
    }
    let elapsed = 0
    const retry = () => {
      elapsed += NAV_UNLOCK_WAIT_INTERVAL_MS
      if (elapsed > NAV_UNLOCK_WAIT_MAX_MS) return
      if (isNavigationLocked()) {
        setTimeout(retry, NAV_UNLOCK_WAIT_INTERVAL_MS)
        return
      }
      executeNav('push', href, STACK_TRANSITION_DURATION_MS)
    }
    setTimeout(retry, NAV_UNLOCK_WAIT_INTERVAL_MS)
  },
}
