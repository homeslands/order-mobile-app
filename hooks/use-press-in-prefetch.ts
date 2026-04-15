/**
 * PressIn Prefetch — prefetch data khi user nhấn (trước khi release).
 * Mục tiêu: Màn đích đã warm trước khi navigate.
 *
 * Khi fetch resolve: nếu đang transition → defer cache update qua scheduleTransitionTask
 * để tránh block JS Thread trong lúc slide animation.
 *
 * @example
 * const prefetchMenuItem = usePressInPrefetch()
 * <Pressable onPressIn={() => prefetchMenuItem(slug)} onPress={handleNavigate}>
 */
import { useCallback } from 'react'

import { getSpecificMenuItem } from '@/api/menu'
import { useQueryClient } from '@tanstack/react-query'
import {
  isTransitionQueueing,
  scheduleTransitionTask,
} from '@/lib/navigation/transition-task-queue'
import { isTransitionLocked } from '@/lib/navigation/transition-lock'

const QUERY_KEY = ['specific-menu-item'] as const

export function usePressInPrefetchMenuItem() {
  const queryClient = useQueryClient()

  return useCallback(
    (slug: string) => {
      if (!slug?.trim() || isTransitionLocked()) return

      const queryKey = [...QUERY_KEY, slug] as [string, string]

      getSpecificMenuItem(slug)
        .then((data) => {
          const setCache = () => {
            queryClient.setQueryData(queryKey, data)
          }
          if (isTransitionQueueing()) {
            scheduleTransitionTask(setCache)
          } else {
            setCache()
          }
        })
        .catch(() => {
          // Silent fail — prefetch không ảnh hưởng UX
        })
    },
    [queryClient],
  )
}
