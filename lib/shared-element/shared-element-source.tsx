/**
 * SharedElementSource — Hook + Wrapper cho source thumbnail.
 *
 * useSharedElementSource(): returns { animatedRef, capture }
 *   - animatedRef: gắn vào Animated.View chứa thumbnail
 *   - capture(): đo vị trí + trigger overlay (gọi trong onPressIn)
 *
 * measure() của Reanimated v4 chạy đồng bộ từ JS thread
 * (block JS cho đến khi UI thread trả kết quả).
 */
import { useCallback } from 'react'
import { measure, useAnimatedRef } from 'react-native-reanimated'
import type Animated from 'react-native-reanimated'

import {
  useSharedElementOptional,
  type ElementRect,
} from './shared-element-provider'

export function useSharedElementSource(imageUri: string) {
  const animatedRef = useAnimatedRef<Animated.View>()
  const sharedElement = useSharedElementOptional()

  const capture = useCallback(() => {
    if (!sharedElement) return

    try {
      const measured = measure(animatedRef)
      if (measured && measured.width > 0 && measured.height > 0) {
        const rect: ElementRect = {
          x: measured.pageX,
          y: measured.pageY,
          w: measured.width,
          h: measured.height,
        }
        sharedElement.triggerTransition(rect, imageUri)
      }
    } catch {
      // measure() throws if view is detached or not yet laid out
    }
  }, [animatedRef, imageUri, sharedElement])

  return { animatedRef, capture }
}
