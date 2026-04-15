import { DependencyList, useCallback, useEffect, useRef, useState } from 'react'
import { InteractionManager } from 'react-native'

type UseScreenTransitionOptions = {
  /** Called once when the screen transition (and interactions) complete. Use to enable data fetch. */
  onTransitionComplete?: () => void
}

/**
 * Manages loading state during screen transitions for butter-smooth 60fps.
 * Uses InteractionManager so heavy work runs after the native transition (and other
 * interactions) finish — keeps the UI thread unblocked.
 *
 * Use with Native Stack + react-native-screens:
 * - Show a lightweight skeleton when !isTransitionComplete.
 * - Render real content when isTransitionComplete; run fetches via onTransitionComplete
 *   or runAfterTransition, or enable useQuery when isTransitionComplete.
 *
 * @example
 * function DetailScreen() {
 *   const [allowFetch, setAllowFetch] = useState(false)
 *   const { isTransitionComplete } = useScreenTransition({
 *     onTransitionComplete: () => setAllowFetch(true),
 *   })
 *
 *   if (!isTransitionComplete) return <DetailSkeleton />
 *   return <DetailContent allowFetch={allowFetch} />
 * }
 */
export function useScreenTransition(options: UseScreenTransitionOptions = {}) {
  const { onTransitionComplete } = options
  const [isTransitionComplete, setTransitionComplete] = useState(false)
  const taskRef = useRef<{ cancel: () => void } | null>(null)
  const onCompleteRef = useRef(onTransitionComplete)

  useEffect(() => {
    onCompleteRef.current = onTransitionComplete
  }, [onTransitionComplete])

  useEffect(() => {
    taskRef.current = InteractionManager.runAfterInteractions(() => {
      setTransitionComplete(true)
      onCompleteRef.current?.()
      taskRef.current = null
    })
    return () => {
      taskRef.current?.cancel()
      taskRef.current = null
    }
  }, [])

  const runAfterTransition = useCallback((callback: () => void) => {
    const task = InteractionManager.runAfterInteractions(() => {
      callback()
    })
    return () => task.cancel()
  }, [])

  return { isTransitionComplete, runAfterTransition }
}

/**
 * Runs a callback once after the current screen transition (and interactions) complete.
 * Use to enable data fetching (e.g. setState to enable useQuery) without blocking the animation.
 *
 * @example
 * const [allowFetch, setAllowFetch] = useState(false)
 * useRunAfterScreenTransition(() => setAllowFetch(true), [])
 * useQuery({ ..., enabled: allowFetch })
 */
export function useRunAfterScreenTransition(callback: () => void, deps: DependencyList = []) {
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled.current) return
      callback()
    })
    return () => {
      cancelled.current = true
      task.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
