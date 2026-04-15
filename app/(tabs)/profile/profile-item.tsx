/**
 * ProfileItem — press effect (scale 0.96).
 * Toàn bộ animation chạy trên UI Thread qua useAnimatedStyle, Gesture.Tap.
 */
import { ChevronRight, type LucideIcon } from 'lucide-react-native'
import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { colors } from '@/constants'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

const PRESS_SCALE = 0.96
const SPRING_PRESS_OUT = {
  damping: 25,
  stiffness: 200,
  mass: 0.5,
  overshootClamping: true,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
}

export interface ProfileItemProps {
  label: string
  icon: LucideIcon
  onPress: () => void
  index: number
}

export const ProfileItem = React.memo(function ProfileItem({
  label,
  icon: Icon,
  onPress,
}: ProfileItemProps) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(300)
        .maxDistance(20)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          'worklet'
          scale.value = PRESS_SCALE
          opacity.value = 0.8
        })
        .onFinalize(() => {
          'worklet'
          scale.value = withSpring(1, SPRING_PRESS_OUT)
          opacity.value = withSpring(1, SPRING_PRESS_OUT)
        })
        .onEnd((_, success) => {
          'worklet'
          if (success) runOnJS(onPress)()
        }),
    [scale, opacity, onPress],
  )

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <View>
      <GestureDetector gesture={tapGesture}>
        <Animated.View style={[styles.row, animatedStyle]}>
          <View style={styles.iconWrap}>
            <Icon size={22} color={colors.gray[500]} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          <View style={styles.chevronWrap}>
            <ChevronRight size={20} color={colors.mutedForeground.dark} />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.white.light,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  iconWrap: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.gray[900],
    marginLeft: 12,
  },
  chevronWrap: {
    marginLeft: 8,
  },
})
