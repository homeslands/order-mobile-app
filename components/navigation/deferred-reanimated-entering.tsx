import React from 'react'
import type { ViewStyle } from 'react-native'
import Animated, { FadeIn, type EntryOrExitLayoutType } from 'react-native-reanimated'

type Props = {
  children: React.ReactNode
  /** Layout entering animation — runs when this component mounts. Mount after transition (e.g. when isTransitionComplete) so UI thread stays unblocked. Default: FadeIn.duration(200) */
  entering?: EntryOrExitLayoutType
  style?: ViewStyle
}

/**
 * Wraps content in Reanimated's layout entering animation. For butter-smooth 60fps:
 * mount this component only after the screen transition completes (e.g. when
 * useScreenTransition().isTransitionComplete is true), so the native stack runs
 * first and Reanimated entrance runs on the destination without blocking.
 *
 * Strategy: Parent shows skeleton until transition complete → then renders
 * <DeferredReanimatedEntering><Content /></DeferredReanimatedEntering> → entering
 * runs on mount (e.g. hero fade/scale).
 *
 * @example
 * const { isTransitionComplete } = useScreenTransition()
 * if (!isTransitionComplete) return <DetailSkeleton />
 * return (
 *   <DeferredReanimatedEntering entering={FadeIn.duration(200)}>
 *     <Image source={{ uri: product.image }} />
 *   </DeferredReanimatedEntering>
 * )
 */
export function DeferredReanimatedEntering({
  children,
  entering = FadeIn.duration(200),
  style,
}: Props) {
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  )
}
