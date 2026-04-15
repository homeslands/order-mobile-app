import * as React from 'react'
import { Pressable } from 'react-native'

import type { NavigationTriggerViewProps } from './NavigationTrigger.types'

export default function NavigationTriggerView(props: NavigationTriggerViewProps) {
  const { href, type = 'push', onPress, style, children } = props

  const handlePress = React.useCallback(() => {
    onPress?.({
      nativeEvent: { href, type },
    })
  }, [href, type, onPress])

  return (
    <Pressable onPress={handlePress} style={style}>
      {children}
    </Pressable>
  )
}
