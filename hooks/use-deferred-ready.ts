import { useEffect, useRef, useState } from 'react'
import { InteractionManager } from 'react-native'

import { unlockNavigation } from '@/lib/navigation'

/**
 * Post-Transition Hydration: set ready=true sau khi navigation animation xong.
 * Dùng InteractionManager.runAfterInteractions để tránh JS congestion trong lúc transition.
 *
 * Unify với NavigationLock: unlockNavigation() gọi trong callback → lock release
 * trùng với hydration start.
 *
 * @returns ready — true khi có thể render heavy content (Zustand, Query, FlatList)
 */
export function useDeferredReady(): boolean {
  const [ready, setReady] = useState(false)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled.current) return
      unlockNavigation()
      setReady(true)
    })
    return () => {
      cancelled.current = true
      task.cancel()
    }
  }, [])

  return ready
}
