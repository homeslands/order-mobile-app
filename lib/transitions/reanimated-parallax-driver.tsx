/**
 * Reanimated 3 Parallax Driver — Single SharedValue cho tất cả layers.
 *
 * Tất cả layers (translateX, scale, shadowOpacity) consume CÙNG MỘT progress SharedValue
 * → đồng bộ hoàn hảo, chạy trên UI thread (Worklets).
 *
 * Tích hợp với MasterTransitionProvider: dùng transitionProgress làm single source.
 */
import React, { createContext, useContext, useMemo } from 'react'
import { useWindowDimensions } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { interpolate, useAnimatedStyle } from 'react-native-reanimated'

import { MOTION } from '@/constants'
import {
  PARALLAX_BG_SCALE_END,
  PARALLAX_BG_SCALE_START,
  PARALLAX_SHADOW_OPACITY_END,
} from './reanimated-parallax-config'

export type ParallaxDriverContextValue = {
  /** Progress 0→1 (push) hoặc 1→0 (pop). Single source of truth. */
  progress: SharedValue<number>
  /** Screen width — dùng cho translateX */
  screenWidth: number
}

const ParallaxDriverContext = createContext<ParallaxDriverContextValue | null>(
  null,
)

export function ParallaxDriverProvider({
  children,
  progress,
}: {
  children: React.ReactNode
  progress: SharedValue<number>
}) {
  const { width: screenWidth } = useWindowDimensions()
  const value = useMemo(
    () => ({ progress, screenWidth }),
    [progress, screenWidth],
  )
  return (
    <ParallaxDriverContext.Provider value={value}>
      {children}
    </ParallaxDriverContext.Provider>
  )
}

export function useParallaxDriver(): ParallaxDriverContextValue {
  const ctx = useContext(ParallaxDriverContext)
  if (!ctx) {
    throw new Error(
      'useParallaxDriver must be used within ParallaxDriverProvider',
    )
  }
  return ctx
}

export function useParallaxDriverOptional(): ParallaxDriverContextValue | null {
  return useContext(ParallaxDriverContext)
}

/**
 * useAnimatedStyle cho incoming screen: translateX từ screenWidth -> 0
 */
export function useIncomingScreenStyle(isClosing: boolean) {
  const { progress, screenWidth } = useParallaxDriver()
  return useAnimatedStyle(() => {
    'worklet'
    const p = progress.value
    const translateX = interpolate(
      p,
      [0, 1],
      isClosing ? [0, screenWidth] : [screenWidth, 0],
    )
    return { transform: [{ translateX }] }
  })
}

/**
 * useAnimatedStyle cho background screen: scale 0.97 -> 1
 */
export function useBackgroundScaleStyle(isClosing: boolean) {
  const { progress } = useParallaxDriver()
  return useAnimatedStyle(() => {
    'worklet'
    const p = progress.value
    const scale = interpolate(
      p,
      [0, 1],
      isClosing
        ? [PARALLAX_BG_SCALE_END, PARALLAX_BG_SCALE_START]
        : [PARALLAX_BG_SCALE_START, PARALLAX_BG_SCALE_END],
    )
    return { transform: [{ scale }] }
  })
}

/**
 * useAnimatedStyle cho background screen: scale + translateX (parallax 0.3).
 * Màn phía sau scale nhỏ + dịch trái khi màn mới trượt vào — Telegram feel.
 */
export function useBackgroundParallaxStyle(isClosing: boolean) {
  const { progress, screenWidth } = useParallaxDriver()
  return useAnimatedStyle(() => {
    'worklet'
    const p = progress.value
    const scale = interpolate(
      p,
      [0, 1],
      isClosing
        ? [PARALLAX_BG_SCALE_END, PARALLAX_BG_SCALE_START]
        : [PARALLAX_BG_SCALE_START, PARALLAX_BG_SCALE_END],
    )
    const translateX = interpolate(
      p,
      [0, 1],
      isClosing
        ? [0, -screenWidth * MOTION.parallaxFactor]
        : [-screenWidth * MOTION.parallaxFactor, 0],
    )
    return { transform: [{ translateX }, { scale }] }
  })
}

/**
 * useAnimatedStyle cho shadow: opacity 0 -> 0.15
 */
export function useShadowOpacityStyle(isClosing: boolean) {
  const { progress } = useParallaxDriver()
  return useAnimatedStyle(() => {
    'worklet'
    const p = progress.value
    const shadowOpacity = interpolate(
      p,
      [0, 1],
      isClosing
        ? [PARALLAX_SHADOW_OPACITY_END, 0]
        : [0, PARALLAX_SHADOW_OPACITY_END],
    )
    return { shadowOpacity }
  })
}
