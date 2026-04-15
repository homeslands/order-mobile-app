import { MOTION } from '@/constants'

/** Tab transition duration (~200ms) — dùng cho useRunAfterTransition, tab overlay */
export const TRANSITION_DURATION_MS = MOTION.transitionDurationMs

/** Native stack push/pop duration — dùng cho navigation-lock, transition-lock */
export const STACK_TRANSITION_DURATION_MS = MOTION.nativeStack.durationMs

/** Buffer after transition before content mount — tránh tail collision với FPS monitor */
export const TRANSITION_SAFE_DELAY_ANDROID = 150
export const TRANSITION_SAFE_DELAY_IOS = 80

/** Cart shell → content: lần đầu (cold) — 250ms animation + 30ms buffer */
export const CART_SHELL_DELAY_ANDROID_MS = 280
/** Lần 2+ (warm): 0ms — giống lần đầu (fade in, không thấy skeleton) */
export const CART_SHELL_DELAY_RETURNING_MS = 0

/** hitSlop cho nút nhỏ — tăng vùng nhận diện chạm, tránh bấm hụt (Telegram-style) */
export const HIT_SLOP_SMALL = { top: 12, bottom: 12, left: 12, right: 12 } as const
export const HIT_SLOP_ICON = { top: 8, bottom: 8, left: 8, right: 8 } as const

/** hitSlop cho Topping row — hàng ngang, mở rộng dọc hơn để tap nhanh liên tiếp */
export const HIT_SLOP_TOPPING = {
  top: 16,
  bottom: 16,
  left: 12,
  right: 12,
} as const
