/**
 * Lightweight Swipeable — no deferred gesture → no remount → no image flash.
 */
import { SPRING_CONFIGS, colors } from '@/constants'
import { Trash2 } from 'lucide-react-native'
import React, { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

const SWIPE_WIDTH = 80
const returnTrue = () => true

const SLIDE_OUT_DURATION = 180
const COLLAPSE_DURATION = 200

function CartSwipeableBase({
  itemId,
  onDelete,
  children,
}: {
  itemId: string
  onDelete: (id?: string) => void
  children: React.ReactNode
}) {
  const translateX = useSharedValue(0)
  const startX = useSharedValue(0)
  const rowHeight = useSharedValue(-1)
  const animatedHeight = useSharedValue(-1)
  const isRemoving = useSharedValue(false)

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-30, 30])
        .failOffsetY([-6, 6])
        .minDistance(8)
        .onStart(() => {
          startX.value = translateX.value
        })
        .onUpdate((e) => {
          if (isRemoving.value) return
          let next = startX.value + e.translationX
          if (next > 0) next *= 0.1
          if (next < -SWIPE_WIDTH)
            next = -SWIPE_WIDTH + (next + SWIPE_WIDTH) * 0.15
          translateX.value = next
        })
        .onEnd((e) => {
          if (isRemoving.value) return
          const open =
            translateX.value < -SWIPE_WIDTH * 0.72 || e.velocityX < -700
          translateX.value = withSpring(
            open ? -SWIPE_WIDTH : 0,
            SPRING_CONFIGS.swipe,
          )
        }),
    [translateX, startX, isRemoving],
  )

  const fgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  const deleteOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_WIDTH, 0], [1, 0], 'clamp'),
  }))

  const wrapperStyle = useAnimatedStyle(() => {
    if (animatedHeight.value < 0) return {}
    return {
      height: animatedHeight.value,
      opacity: interpolate(
        animatedHeight.value,
        [0, rowHeight.value * 0.3],
        [0, 1],
        'clamp',
      ),
      overflow: 'hidden' as const,
    }
  })

  const triggerDelete = useCallback(() => onDelete(itemId), [itemId, onDelete])

  const handleDelete = useCallback(() => {
    isRemoving.value = true
    translateX.value = withTiming(
      -400,
      { duration: SLIDE_OUT_DURATION },
      (done) => {
        if (!done) return
        animatedHeight.value = rowHeight.value
        animatedHeight.value = withTiming(
          0,
          { duration: COLLAPSE_DURATION },
          (finished) => {
            if (!finished) return
            runOnJS(triggerDelete)()
          },
        )
      },
    )
  }, [translateX, animatedHeight, rowHeight, isRemoving, triggerDelete])

  const [needsMeasure, setNeedsMeasure] = useState(true)
  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      rowHeight.value = e.nativeEvent.layout.height
      setNeedsMeasure(false)
    },
    [rowHeight],
  )

  return (
    <Animated.View
      style={wrapperStyle}
      onLayout={needsMeasure ? onLayout : undefined}
    >
      <Animated.View style={[swipeStyles.deleteBox, deleteOpacity]}>
        <View
          style={swipeStyles.deleteTap}
          onStartShouldSetResponder={returnTrue}
          onResponderRelease={handleDelete}
        >
          <Trash2 size={20} color={colors.white.light} />
        </View>
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={fgStyle}>{children}</Animated.View>
      </GestureDetector>
    </Animated.View>
  )
}

export const CartSwipeable = memo(CartSwipeableBase)

const swipeStyles = StyleSheet.create({
  deleteBox: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 16,
    width: SWIPE_WIDTH - 12,
    borderRadius: 16,
    backgroundColor: colors.destructive.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteTap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
