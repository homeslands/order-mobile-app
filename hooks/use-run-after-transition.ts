import { type DependencyList, useEffect, useRef } from 'react'
import { InteractionManager, Platform } from 'react-native'

import { STACK_TRANSITION_DURATION_MS, TRANSITION_DURATION_MS } from '@/lib/navigation'

export type UseRunAfterTransitionOptions = {
  /**
   * Delay (ms) — chỉ Android.
   * - > 0: thêm delay sau runAfterInteractions (tránh mount trong transition).
   * - < 0: pre-emptive fire — callback chạy (ESTIMATED_TRANSITION_MS + androidDelayMs) ms từ mount.
   *   VD: -20 → fire ~280ms, content xuất hiện ngay khi slide sắp xong.
   */
  androidDelayMs?: number
  /**
   * Loại transition đang chạy — ảnh hưởng đến thời điểm pre-emptive fire trên Android
   * và timeout failsafe trên iOS.
   * - 'tab': tab navigator transition (~200ms) — mặc định
   * - 'stack': native stack push/pop (~360ms)
   */
  transitionType?: 'tab' | 'stack'
}

/**
 * Chạy callback sau khi animation chuyển màn (và mọi interaction) xong.
 * Dùng để delay API/heavy work → tránh drop frame, mượt như Telegram.
 *
 * @param androidDelayMs — Trên Android:
 *   - > 0: delay thêm sau runAfterInteractions.
 *   - < 0: pre-emptive fire ~20–30ms trước transitionEnd (thử -20 hoặc -30).
 *
 * @param transitionType — 'tab' (200ms) hoặc 'stack' (360ms). Dùng 'stack' khi
 *   hook được gọi trong NativeStack screens (product detail, payment, profile).
 *
 * @example
 * useRunAfterTransition(() => setReady(true), [])
 * useRunAfterTransition(() => setReady(true), [], { androidDelayMs: -20, transitionType: 'stack' })
 */
export function useRunAfterTransition(
  callback: () => void,
  deps: DependencyList = [],
  options?: UseRunAfterTransitionOptions,
) {
  const cancelled = useRef(false)
  const androidDelay = options?.androidDelayMs ?? 0
  const transitionType = options?.transitionType ?? 'tab'

  useEffect(() => {
    cancelled.current = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    // Duration tương ứng với loại transition thực tế — tránh fire quá sớm/muộn
    const estimatedDurationMs =
      transitionType === 'stack' ? STACK_TRANSITION_DURATION_MS : TRANSITION_DURATION_MS

    if (Platform.OS === 'android' && androidDelay < 0) {
      const fireAtMs = Math.max(0, estimatedDurationMs + androidDelay)
      timeoutId = setTimeout(() => {
        if (!cancelled.current) callback()
        timeoutId = null
      }, fireAtMs)
      return () => {
        cancelled.current = true
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    // iOS failsafe: nếu InteractionManager không resolve (gesture cancel, JS thread stall),
    // timeout đảm bảo callback vẫn chạy sau khi transition chắc chắn đã xong.
    // Failsafe buffer 400ms: trên slow device (iPhone SE 1st gen, memory pressure),
    // transition có thể thực tế chạy 450-500ms — buffer 200ms cũ fire trước
    // khi settle, gây drop frame. 400ms an toàn mà vẫn không quá chậm.
    let failsafeId: ReturnType<typeof setTimeout> | null = null
    if (Platform.OS === 'ios') {
      failsafeId = setTimeout(() => {
        failsafeId = null
        if (!cancelled.current) callback()
      }, estimatedDurationMs + 400)
    }

    const task = InteractionManager.runAfterInteractions(() => {
      // Cancel failsafe — InteractionManager đã resolve bình thường
      if (failsafeId) {
        clearTimeout(failsafeId)
        failsafeId = null
      }
      if (cancelled.current) return
      if (Platform.OS === 'android' && androidDelay > 0) {
        timeoutId = setTimeout(() => {
          if (!cancelled.current) callback()
          timeoutId = null
        }, androidDelay)
      } else {
        callback()
      }
    })
    return () => {
      cancelled.current = true
      if (timeoutId) clearTimeout(timeoutId)
      if (failsafeId) clearTimeout(failsafeId)
      task.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
