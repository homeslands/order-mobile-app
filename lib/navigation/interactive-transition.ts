/**
 * Phase 7 — Velocity-Driven Interactive Transition (Telegram Level)
 *
 * OPEN (push): timing + ease-out-cubic, 350ms.
 * Telegram dùng CubicBezierInterpolator.EASE_OUT_QUINT cho page transition —
 * nhanh đầu, giảm tốc rõ rệt cuối ("hãm phanh"). Spring quá nhanh (~250ms)
 * khiến deceleration phase không đủ dài để mắt cảm nhận.
 *
 * CLOSE (pop / gesture completion): underdamped spring — velocity-aware.
 * Spring mềm hơn (~320ms settle) cho deceleration tự nhiên sau khi thả tay.
 * overshootClamping: false → nhẹ nhàng settle, không cắt cụt.
 *
 * React Navigation Stack gesture là progress-driven (1:1 finger mapping).
 * CLOSE_SPEC chỉ lái animation AFTER finger release.
 */
import { Easing } from 'react-native'

/**
 * Open timing — Ease-out-quint-ish, 380ms.
 *
 * Dùng cubic-bezier(0.19, 1, 0.22, 1) (EASE_OUT_EXPO-style) để
 * kéo dài pha deceleration cuối: 200ms đầu đi nhanh, ~180ms cuối hãm phanh rõ.
 */
export const OPEN_TIMING = {
  duration: 400, // Tăng thêm 20ms để pha hãm phanh "ngọt" hơn
  easing: Easing.bezier(0.21, 1.02, 0.35, 1), // Thêm một chút 'overshoot' cực nhẹ ở đỉnh để tạo độ căng
}

/**
 * Close spring — Underdamped, mềm hơn.
 *
 * ζ ≈ 0.82, ω₀ ≈ 12.9 → 95% settle ~280ms, full settle ~350ms.
 * Mass cao hơn → phản ứng "nặng" hơn với velocity, deceleration rõ hơn.
 */
export const CLOSE_SPRING = {
  damping: 26, // Tăng damping để triệt tiêu dao động nhanh hơn
  stiffness: 190, // Tăng stiffness để bám theo tay tốt hơn
  mass: 0.7, // Giảm mass để nhẹ hơn
  overshootClamping: true, // Telegram thường không cho nảy (bounce) khi đóng trang
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
}

/**
 * Reanimated parallax spring — UI thread.
 * Slightly underdamped for organic depth feel.
 */
export const REANIMATED_PARALLAX_SPRING = {
  damping: 18,
  stiffness: 220,
  mass: 0.9,
  overshootClamping: false,
  energyThreshold: 1e-6,
} as const

/** Progress threshold: > 0.45 → complete back (velocity projection) */
export const COMPLETE_THRESHOLD = 0.45

/** Velocity threshold (px/ms) — above this → complete regardless of progress */
export const VELOCITY_THRESHOLD = 0.3

/** Velocity impact for gesture: projected = progress + velocityX * factor */
export const VELOCITY_PROJECTION_FACTOR = 0.00025

/** Parallax: previous screen moves -30% for depth illusion */
export const PARALLAX_FACTOR = 0.3

/**
 * Gesture response distance — full screen nhưng đủ lớn cho swipe-back.
 * Nếu conflict với horizontal scroll, giảm về 50.
 * @see docs/GESTURE_TAP_VS_BACK_CONFLICT.md
 */
/** Khoảng cách từ cạnh trái để kích hoạt swipe-back. Nhỏ hơn = ít nhạy, tránh lỡ back khi cuộn. */
export const GESTURE_RESPONSE_DISTANCE = 50

/** Transition spec for open (push) — Timing ease-out-cubic, 350ms */
export const OPEN_SPEC = {
  animation: 'timing' as const,
  config: OPEN_TIMING,
}

/** Transition spec for close (pop) — Underdamped spring, velocity-aware */
export const CLOSE_SPEC = {
  animation: 'spring' as const,
  config: CLOSE_SPRING,
}
