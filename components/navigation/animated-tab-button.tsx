/**
 * AnimatedTabButton — Icon + label, màu đổi theo active (indicator trượt ở parent).
 */
import type { LucideIcon } from 'lucide-react-native'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { NativeGesturePressable } from './native-gesture-pressable'

type AnimatedTabButtonProps = {
  href: string
  iconSize?: number
  itemWidth?: number
  label?: string
  Icon: LucideIcon
  active: boolean
  primaryColor: string
  mutedColor: string
  onBeforeTabSwitch?: () => void
  onPressIn?: () => void
}

export const AnimatedTabButton = React.memo(function AnimatedTabButton({
  href,
  iconSize = 36,
  itemWidth = 70,
  label,
  Icon,
  active,
  mutedColor,
  onBeforeTabSwitch,
  onPressIn,
}: AnimatedTabButtonProps) {
  return (
    <NativeGesturePressable
      navigation={{ type: 'navigate', href }}
      beforeNavigate={onBeforeTabSwitch}
      onPressIn={onPressIn}
      hapticStyle="light"
      style={styles.container}
    >
      <View style={[styles.content, { width: itemWidth }]}>
        <Icon color={active ? '#fff' : mutedColor} size={iconSize * 0.55} />
        {label ? (
          <Text
            style={[
              styles.label,
              { color: active ? '#fff' : mutedColor, maxWidth: itemWidth - 20 },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </NativeGesturePressable>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
})
