/**
 * Task 2 — Transition Progress đồng bộ với react-native-screens.
 *
 * Progress KHÔNG dùng withSpring độc lập — lái theo tiến độ thực từ native stack
 * qua transitionStart/End listeners. Parallax interpolate dựa trên progress này.
 *
 * Parallax tạm tắt (PARALLAX_ENABLED = false) → không cần frame-by-frame syncer
 * (chỉ snap 0↔1 ở start/end là đủ cho isTransitioning flag).
 */
import { useQueryClient } from '@tanstack/react-query'
import { usePathname } from 'expo-router'
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { InteractionManager, View } from 'react-native'
import { runOnUI } from 'react-native-reanimated'

import { GlobalLoadingOverlay } from '@/components/ui/global-loading-overlay'
import type { SharedValue } from 'react-native-reanimated'
import { useSharedValue } from 'react-native-reanimated'

import { markCartFlowEvent } from '@/lib/qa/cart-flow-benchmark'
import { useSharedElementOptional } from '@/lib/shared-element'
import { ParallaxDriverProvider } from '@/lib/transitions/reanimated-parallax-driver'
import {
  cancelScheduledUnlockTimers,
  unlockNavigation,
} from './navigation-lock'
import { setTransitionQueueing } from './transition-task-queue'

export type MasterTransitionContextValue = {
  /** Progress 0→1 (push) hoặc 1→0 (pop). Physics-based, không timing. */
  transitionProgress: SharedValue<number>
  /** true trong suốt animation. Task 4: Queue side effects khi true. */
  isTransitioning: SharedValue<boolean>
  /** Listeners để merge vào screenOptions của Stack. */
  screenListeners: {
    transitionStart: (e: { data: { closing: boolean } }) => void
    transitionEnd: (e: { data: { closing: boolean } }) => void
  }
  /** Hiện overlay loading trong ms (vd: tab switch). */
  showLoadingFor: (ms?: number) => void
  /** Hiện overlay (không timeout), ẩn bằng hideLoadingOverlay. */
  showLoadingOverlay: () => void
  /** Ẩn overlay (khi content ready). */
  hideLoadingOverlay: () => void
}

const MasterTransitionContext =
  createContext<MasterTransitionContextValue | null>(null)

/** Tạm tắt overlay — bật lại khi cần */
const OVERLAY_ENABLED = false
/** P3: Tắt Parallax — bỏ frame-by-frame progress listener. Bật lại nếu cần hiệu ứng depth. */
const PARALLAX_ENABLED = false
/** Delay sau transitionEnd trước khi ẩn overlay — bù khoảng delay skeleton */
const OVERLAY_HIDE_DELAY_MS = 180
/** Mặc định khi gọi showLoadingFor() (vd: tab switch) */
const TAB_SWITCH_OVERLAY_MS = 400
/** Perf mode: tắt InteractionHandle để giảm bookkeeping JS trong transition. */
const USE_INTERACTION_HANDLE = false
/**
 * Deep-dive A/B: queueing global thường tăng overhead trong flow hiện tại.
 * Mặc định tắt queueing; chỉ bật khi cần test/điều tra.
 */
function shouldEnableTransitionQueueing(): boolean {
  const g = globalThis as { __ENABLE_TRANSITION_QUEUEING?: boolean } | undefined
  if (typeof g?.__ENABLE_TRANSITION_QUEUEING === 'boolean') {
    return g.__ENABLE_TRANSITION_QUEUEING
  }
  return false
}

/** Route pattern → query key để kiểm tra cache. Nếu có cache thì bỏ qua overlay. */
const ROUTE_CACHE_QUERY_MAP: Array<{
  pattern: RegExp
  getQueryKey: (param: string) => unknown[]
}> = [
  {
    pattern: /\/menu\/product\/([^/]+)/,
    getQueryKey: (id) => ['specific-menu-item', id],
  },
  {
    pattern: /\/product\/([^/]+)/,
    getQueryKey: (id) => ['specific-menu-item', id],
  }, // redirect target
  {
    pattern: /\/update-order\/([^/]+)/,
    getQueryKey: (slug) => ['order', slug],
  },
  {
    pattern: /\/payment\/([^/]+)/,
    getQueryKey: (orderSlug) => ['order', orderSlug],
  },
]

export function MasterTransitionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const transitionProgress = useSharedValue(0)
  const isTransitioning = useSharedValue(false)
  const sharedElement = useSharedElementOptional()
  // Ref để onTransitionStart/End luôn đọc sharedElement mới nhất mà không cần
  // đưa vào deps — tránh recreate callbacks (và screenListeners) mỗi khi
  // SharedElementProvider re-render trong lúc animation đang chạy.
  // Update trong useEffect để không vi phạm react-hooks/refs (không mutate ref
  // trong render). Callbacks fired async sau commit → ref đã fresh.
  const sharedElementRef = useRef(sharedElement)
  React.useEffect(() => {
    sharedElementRef.current = sharedElement
  }, [sharedElement])
  const interactionHandleRef = useRef<ReturnType<
    typeof InteractionManager.createInteractionHandle
  > | null>(null)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current)
      }
    }
  }, [])

  const onTransitionStart = useCallback(
    (e: { data: { closing: boolean } }) => {
      if (USE_INTERACTION_HANDLE) {
        if (interactionHandleRef.current != null) {
          InteractionManager.clearInteractionHandle(
            interactionHandleRef.current,
          )
          interactionHandleRef.current = null
        }
        interactionHandleRef.current =
          InteractionManager.createInteractionHandle()
      }
      markCartFlowEvent('transition_start', {
        closing: e.data.closing,
        pathname,
      })
      if (shouldEnableTransitionQueueing()) {
        setTransitionQueueing(true)
      }
      const closing = e.data.closing

      // Shared Element: reverse overlay animation when swiping back.
      // Dùng ref thay vì closure để không cần sharedElement trong deps.
      const se = sharedElementRef.current
      if (closing && se?.isActive.value) {
        se.reverseTransition()
      }

      runOnUI(() => {
        'worklet'
        isTransitioning.value = true
        transitionProgress.value = closing ? 1 : 0
      })()
      // Không hiện overlay ở transitionStart — chờ transitionEnd để tránh chồng lên animation trượt.
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current)
        overlayTimeoutRef.current = null
      }
    },
    [isTransitioning, transitionProgress, pathname],
  )

  const onTransitionEnd = useCallback(
    (e: { data: { closing: boolean } }) => {
      if (USE_INTERACTION_HANDLE) {
        if (interactionHandleRef.current != null) {
          InteractionManager.clearInteractionHandle(
            interactionHandleRef.current,
          )
          interactionHandleRef.current = null
        }
      }
      markCartFlowEvent('transition_end', {
        closing: e.data.closing,
        pathname,
      })
      cancelScheduledUnlockTimers()
      unlockNavigation()
      const closing = e.data.closing

      // Shared Element: complete transition when push finishes.
      // Dùng ref thay vì closure để không cần sharedElement trong deps.
      const se = sharedElementRef.current
      if (!closing && se) {
        se.completeTransition()
      }

      runOnUI(() => {
        'worklet'
        isTransitioning.value = false
        transitionProgress.value = closing ? 0 : 1
      })()
      if (shouldEnableTransitionQueueing()) {
        setTransitionQueueing(false)
      }
      // Hiện overlay SAU khi transition xong (push) — tránh chồng lên animation trượt.
      // Bỏ qua overlay nếu đã có cache (product, menu, ...).
      if (!closing) {
        const isProfileContext =
          typeof pathname === 'string' &&
          (pathname.includes('/profile') || pathname.includes('profile/'))
        if (isProfileContext) return

        // Bỏ qua overlay nếu route có cache (product, order, payment, ...)
        if (typeof pathname === 'string') {
          for (const { pattern, getQueryKey } of ROUTE_CACHE_QUERY_MAP) {
            const match = pathname.match(pattern)
            if (match) {
              const queryKey = getQueryKey(match[1])
              if (queryClient.getQueryData(queryKey)) return
              break // Chỉ match 1 pattern
            }
          }
        }

        if (OVERLAY_ENABLED) setShowLoadingOverlay(true)
      }
      if (closing) {
        // Pop: ẩn overlay ngay — overlay từ push trước không cần chờ 180ms
        if (overlayTimeoutRef.current) {
          clearTimeout(overlayTimeoutRef.current)
          overlayTimeoutRef.current = null
        }
        setShowLoadingOverlay(false)
      } else {
        overlayTimeoutRef.current = setTimeout(() => {
          setShowLoadingOverlay(false)
          overlayTimeoutRef.current = null
        }, OVERLAY_HIDE_DELAY_MS)
      }
    },
    [isTransitioning, transitionProgress, pathname, queryClient],
  )

  const showLoadingFor = useCallback((ms = TAB_SWITCH_OVERLAY_MS) => {
    if (!OVERLAY_ENABLED) return
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current)
      overlayTimeoutRef.current = null
    }
    setShowLoadingOverlay(true)
    overlayTimeoutRef.current = setTimeout(() => {
      setShowLoadingOverlay(false)
      overlayTimeoutRef.current = null
    }, ms)
  }, [])

  const showLoadingOverlayNoTimeout = useCallback(() => {
    if (!OVERLAY_ENABLED) return
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current)
      overlayTimeoutRef.current = null
    }
    setShowLoadingOverlay(true)
  }, [])

  const hideLoadingOverlay = useCallback(() => {
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current)
      overlayTimeoutRef.current = null
    }
    setShowLoadingOverlay(false)
  }, [])

  const screenListeners = useMemo(
    () => ({
      transitionStart: onTransitionStart,
      transitionEnd: onTransitionEnd,
    }),
    [onTransitionStart, onTransitionEnd],
  )

  const value = useMemo<MasterTransitionContextValue>(
    () => ({
      transitionProgress,
      isTransitioning,
      screenListeners,
      showLoadingFor,
      showLoadingOverlay: showLoadingOverlayNoTimeout,
      hideLoadingOverlay,
    }),
    [
      transitionProgress,
      isTransitioning,
      screenListeners,
      showLoadingFor,
      showLoadingOverlayNoTimeout,
      hideLoadingOverlay,
    ],
  )

  return (
    <MasterTransitionContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {PARALLAX_ENABLED ? (
          <ParallaxDriverProvider progress={transitionProgress}>
            {children}
          </ParallaxDriverProvider>
        ) : (
          children
        )}
        <GlobalLoadingOverlay visible={showLoadingOverlay} />
      </View>
    </MasterTransitionContext.Provider>
  )
}

export function useMasterTransition(): MasterTransitionContextValue {
  const ctx = useContext(MasterTransitionContext)
  if (!ctx) {
    throw new Error(
      'useMasterTransition must be used within MasterTransitionProvider',
    )
  }
  return ctx
}

export function useMasterTransitionOptional(): MasterTransitionContextValue | null {
  return useContext(MasterTransitionContext)
}
