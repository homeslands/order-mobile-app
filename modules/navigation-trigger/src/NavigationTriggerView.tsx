import * as React from 'react'
import { TouchableOpacity } from 'react-native'

import type { NavigationTriggerViewProps } from './NavigationTrigger.types'
import NavigationTriggerModule from './NavigationTriggerModule'

let NativeView: React.ComponentType<NavigationTriggerViewProps> | null = null

if (NavigationTriggerModule) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeView } = require('expo') as typeof import('expo')
    NativeView = requireNativeView('NavigationTrigger')
  } catch {
    // Native view registration failed — fallback below
  }
}

export default function NavigationTriggerView(
  props: NavigationTriggerViewProps,
) {
  if (NativeView) {
    return <NativeView {...props} />
  }

  const { onPress, href, type, children, ...rest } = props
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress?.({ nativeEvent: { href, type: type ?? 'push' } })}
      {...rest}
    >
      {children}
    </TouchableOpacity>
  )
}
