/**
 * Post-Transition Hydration Pattern.
 *
 * HOC bọc screen: ban đầu render ScreenShell (skeleton nhẹ), sau khi animation xong
 * mới render content thật (Zustand, TanStack Query, FlatList).
 *
 * Tránh JS thread congestion trong lúc transition → animation mượt.
 */
import React, { ComponentType } from 'react'

import { ScreenShell } from '@/components/skeletons/screen-shell'
import { useDeferredReady } from '@/hooks/use-deferred-ready'

export type WithDeferredRenderingOptions<_P extends object> = {
  /** Shell component — render khi chưa ready. Default: ScreenShell */
  Shell?: ComponentType
  /** Display name cho debug */
  displayName?: string
}

/**
 * withDeferredRendering(Component, options?)
 *
 * @example
 * const MenuItemScreen = withDeferredRendering(MenuItemContent, {
 *   Shell: MenuItemSkeletonShell,
 * })
 */
export function withDeferredRendering<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithDeferredRenderingOptions<P> = {},
): ComponentType<P> {
  const { Shell = ScreenShell, displayName } = options

  function DeferredRenderingWrapper(props: P) {
    const ready = useDeferredReady()

    if (!ready) {
      return <Shell />
    }

    return <WrappedComponent {...props} />
  }

  DeferredRenderingWrapper.displayName =
    displayName ?? `WithDeferredRendering(${WrappedComponent.displayName ?? WrappedComponent.name ?? 'Component'})`

  return DeferredRenderingWrapper
}
