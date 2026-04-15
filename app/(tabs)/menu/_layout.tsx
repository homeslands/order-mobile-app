import { useMemo } from 'react'

import { profileNativeStackScreenOptions } from '@/layouts/custom-stack'
import { useMasterTransition } from '@/lib/navigation/master-transition-provider'
import {
  startTransitionFPSMonitor,
  stopTransitionFPSMonitor,
} from '@/lib/qa/transition-fps-monitor'
import { Stack } from 'expo-router'

function isTransitionFPSMonitorEnabled(): boolean {
  const g = globalThis as { __ENABLE_TRANSITION_FPS_MONITOR?: boolean } | undefined
  return !!g?.__ENABLE_TRANSITION_FPS_MONITOR
}

/**
 * Menu tab stack — index (danh sách món) + product/[id] (chi tiết món) + cart.
 *
 * screenOptions forces statusBarTranslucent: true at the NAVIGATOR level.
 * Why: setting statusBarTranslucent per-screen via <Stack.Screen options>
 * only takes effect AFTER the component renders, so the first frame uses
 * non-translucent layout on Android → header shifts when native layer
 * recalculates. Setting it here ensures the layout mode is known before
 * any screen in this stack renders.
 */
const menuScreenOptions = {
  ...profileNativeStackScreenOptions,
  statusBarTranslucent: true,
} as const

export default function MenuLayout() {
  const { screenListeners } = useMasterTransition()

  const mergedListeners = useMemo(() => {
    if (!__DEV__ || !isTransitionFPSMonitorEnabled()) return screenListeners
    return {
      ...screenListeners,
      transitionStart: (e: { data: { closing: boolean } }) => {
        startTransitionFPSMonitor()
        screenListeners.transitionStart?.(e)
      },
      transitionEnd: (e: { data: { closing: boolean } }) => {
        screenListeners.transitionEnd?.(e)
        stopTransitionFPSMonitor()
      },
    }
  }, [screenListeners])

  return (
    <Stack
      screenOptions={menuScreenOptions}
      screenListeners={mergedListeners}
    />
  )
}
