/**
 * NativeNavigationTouchable — Phase 3: Native-first navigation trigger.
 *
 * Trên development build: dùng NavigationTriggerView (native thread touch).
 * Trên Expo Go: fallback sang TouchableOpacity (JS thread touch).
 *
 * @see docs/NAVIGATION_UI_THREAD_ARCHITECTURE.md
 */
import React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { TouchableOpacity, View } from 'react-native'

import type { HrefLike } from '@/lib/navigation'
import { executeNavFromGesture } from '@/lib/navigation'
import { isLockedShared } from '@/lib/navigation/navigation-lock-shared'

import NavigationTriggerModule from '../../modules/navigation-trigger/src/NavigationTriggerModule'

let NavigationTriggerView: React.ComponentType<{
  href: string
  type?: string
  onPress?: (event: { nativeEvent: { href: string; type: string } }) => void
  style?: StyleProp<ViewStyle>
  className?: string
  children?: React.ReactNode
}> | null = null

if (NavigationTriggerModule) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../modules/navigation-trigger') as {
      NavigationTriggerView: typeof NavigationTriggerView
    }
    NavigationTriggerView = mod.NavigationTriggerView
  } catch {
    // Native module unavailable
  }
}

export type NativeNavigationTouchableProps = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  navigation?:
    | { type: 'push'; href: HrefLike }
    | { type: 'replace'; href: HrefLike }
    | { type: 'back' }
  /** Chạy deferred sau nav (prefetch, preload) — không block phản hồi tap */
  onPressDeferred?: () => void
  disabled?: boolean
  className?: string
}

function serializeHref(href: HrefLike): string {
  if (typeof href === 'string') return href
  const { pathname, params } = href as { pathname?: string; params?: Record<string, string> }
  if (!pathname) return ''
  if (!params || Object.keys(params).length === 0) return pathname
  let result = pathname
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`[${key}]`, encodeURIComponent(value))
  }
  const rest = Object.fromEntries(
    Object.entries(params).filter(([k]) => !pathname.includes(`[${k}]`)),
  )
  const search = new URLSearchParams(rest).toString()
  return search ? `${result}?${search}` : result
}

export function NativeNavigationTouchable({
  children,
  style,
  navigation,
  onPressDeferred,
  disabled,
  className,
}: NativeNavigationTouchableProps) {
  const handleNativePress = React.useCallback(
    (event: { nativeEvent: { href: string; type: string } }) => {
      if (disabled || !navigation) return
      if (isLockedShared.value === 1) return

      const { href, type } = event.nativeEvent
      executeNavFromGesture(
        type as 'push' | 'replace' | 'back',
        type === 'back' ? undefined : href,
      )
      if (onPressDeferred) setImmediate(onPressDeferred)
    },
    [disabled, navigation, onPressDeferred],
  )

  const handleJsPress = React.useCallback(() => {
    if (disabled || !navigation) return
    if (isLockedShared.value === 1) return

    const href = navigation.type === 'back' ? undefined : serializeHref(navigation.href)
    executeNavFromGesture(
      navigation.type,
      href,
    )
    if (onPressDeferred) setImmediate(onPressDeferred)
  }, [disabled, navigation, onPressDeferred])

  if (!navigation || disabled) {
    return (
      <View style={style} className={className}>
        {children}
      </View>
    )
  }

  const href = navigation.type === 'back' ? '' : serializeHref(navigation.href)
  const type = navigation.type

  if (NavigationTriggerView) {
    return (
      <NavigationTriggerView
        href={href}
        type={type}
        onPress={handleNativePress}
        style={style}
        className={className}
      >
        {children}
      </NavigationTriggerView>
    )
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handleJsPress}
      style={style}
      className={className}
    >
      {children}
    </TouchableOpacity>
  )
}
