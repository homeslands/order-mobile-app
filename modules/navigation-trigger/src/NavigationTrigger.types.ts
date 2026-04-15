import type { StyleProp, ViewStyle } from 'react-native'

export type NavType = 'push' | 'replace' | 'back'

export type OnPressEventPayload = {
  href: string
  type: NavType
}

export type NavigationTriggerViewProps = {
  href: string
  type?: NavType
  onPress?: (event: { nativeEvent: OnPressEventPayload }) => void
  style?: StyleProp<ViewStyle>
  className?: string
  children?: React.ReactNode
}
