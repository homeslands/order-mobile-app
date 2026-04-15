/**
 * NavigationLock — Singleton cho single-flight navigation.
 *
 * Triple unlock: 1) transitionEnd, 2) runAfterInteractions, 3) setTimeout failsafe.
 * Unlock is idempotent — multiple calls safe.
 */
import { InteractionManager } from 'react-native'

import { STACK_TRANSITION_DURATION_MS } from './constants'
import { isLockedShared } from './navigation-lock-shared'

import type { Href } from 'expo-router'

export type HrefLike = Href | string

export type RouterLike = {
  push: (href: HrefLike) => void
  replace: (href: HrefLike) => void
  navigate: (href: HrefLike) => void
  back: () => void
}

let routerRef: RouterLike | null = null

export const setNavigationRouter = (router: RouterLike | null) => {
  routerRef = router
}

export const getNavigationRouter = (): RouterLike | null => routerRef

let isTransitioning = false

// Monotonic sequence ID — tăng mỗi lần lockNavigation() gọi. Dùng để phân biệt
// "late unlock" từ transition cũ với transition mới. Khi native transitionEnd
// của nav A fire muộn (sau khi nav B đã bắt đầu), JS không phân biệt được event
// thuộc về nav nào — seq cho phép ignore unlock từ nav đã bị supersede.
let transitionSeq = 0

export const isNavigationLocked = () => isTransitioning

export const getCurrentTransitionSeq = () => transitionSeq

export const lockNavigation = (): number => {
  transitionSeq++
  isTransitioning = true
  isLockedShared.value = 1
  return transitionSeq
}

export const unlockNavigation = () => {
  isTransitioning = false
  isLockedShared.value = 0
}

/**
 * Unlock chỉ khi seq = current — bảo vệ khỏi late unlock từ transition đã bị supersede.
 * Dùng cho timers (setTimeout/InteractionManager) trong scheduleUnlock.
 * transitionEnd từ native vẫn dùng unlockNavigation() (unconditional) vì đó là
 * primary unlock mechanism, phải luôn chạy.
 */
export const unlockNavigationIfCurrent = (seq: number): boolean => {
  if (seq !== transitionSeq) return false
  isTransitioning = false
  isLockedShared.value = 0
  return true
}

let earlyTimeoutId: ReturnType<typeof setTimeout> | null = null
let failsafeTimeoutId: ReturnType<typeof setTimeout> | null = null
// Track InteractionManager handle để cancel khi transitionEnd fire — tránh race condition
// khi user navigate nhanh back-to-back: callback của lần trước có thể unlock lock của lần sau.
let interactionHandle: ReturnType<
  typeof InteractionManager.runAfterInteractions
> | null = null

const clearUnlockTimeouts = () => {
  if (earlyTimeoutId) {
    clearTimeout(earlyTimeoutId)
    earlyTimeoutId = null
  }
  if (failsafeTimeoutId) {
    clearTimeout(failsafeTimeoutId)
    failsafeTimeoutId = null
  }
}

const clearInteractionHandle = () => {
  if (interactionHandle) {
    interactionHandle.cancel()
    interactionHandle = null
  }
}

/** Cancel tất cả scheduled unlock (call từ transitionEnd để tự unlock trực tiếp) */
export const cancelScheduledUnlockTimers = () => {
  clearUnlockTimeouts()
  clearInteractionHandle()
}

const EARLY_UNLOCK_MS = STACK_TRANSITION_DURATION_MS + 100
const FAILSAFE_UNLOCK_MS = STACK_TRANSITION_DURATION_MS + 350

/**
 * Triple unlock: PRIMARY transitionEnd, SECONDARY runAfterInteractions, FAILSAFE setTimeout.
 * Tất cả đều idempotent. transitionEnd cancel các backup trước khi tự unlock.
 *
 * @param seq — sequence ID từ lockNavigation(). Timers chỉ unlock nếu seq vẫn
 *   là current — nếu nav mới đã bắt đầu (seq++), timer cũ sẽ no-op để không
 *   unlock nav đang chạy.
 */
export const scheduleUnlock = (seq: number) => {
  clearUnlockTimeouts()
  clearInteractionHandle()

  const doUnlock = () => {
    clearUnlockTimeouts()
    clearInteractionHandle()
    unlockNavigationIfCurrent(seq)
  }

  earlyTimeoutId = setTimeout(doUnlock, EARLY_UNLOCK_MS)
  failsafeTimeoutId = setTimeout(doUnlock, FAILSAFE_UNLOCK_MS)

  interactionHandle = InteractionManager.runAfterInteractions(() => {
    interactionHandle = null
    doUnlock()
  })
}
