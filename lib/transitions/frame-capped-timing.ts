/**
 * Animation tiến theo KHUNG HÌNH ĐÃ VẼ, không theo đồng hồ thật.
 *
 * `withTiming`/`withSpring` tính vị trí từ thời gian trôi qua. Khi luồng UI bị
 * chặn — lúc đổi tab, app dựng view mới mất cả trăm mili giây — không khung nào
 * được vẽ, nhưng đồng hồ vẫn chạy; tới khi vẽ lại được thì vật thể đã ở gần
 * đích. Người dùng thấy nó "nhảy" một phát, tưởng animation hỏng.
 *
 * Ở đây mỗi khung chỉ được cộng tối đa `maxFrameMs` vào thời gian đã trôi, nên
 * một cú đơ dài chỉ tốn đúng một bước. Quãng đường luôn liền mạch; đổi lại là
 * chuyển động kéo dài thêm đúng bằng phần bị đơ.
 */
import { defineAnimation } from 'react-native-reanimated'
import type { AnimationObject } from 'react-native-reanimated'

type FrameCappedAnimation = AnimationObject<number> & {
  startValue: number
  elapsed: number
  lastTimestamp: number
}

export type FrameCappedTimingConfig = {
  /** Thời lượng khi không rớt khung, tính bằng mili giây. */
  duration: number
  /**
   * Mức thời gian tối đa một khung được cộng vào. Đặt quanh hai lần chu kỳ
   * khung hình: đủ rộng để không làm chậm lúc chạy bình thường (kể cả máy
   * 60Hz), đủ hẹp để một cú đơ 100ms không nuốt mất nửa quãng đường.
   */
  maxFrameMs: number
}

/** Tần số góc và hệ số tắt dần của đường cong lò xo bên dưới. */
const OMEGA = 10
const ZETA = 0.75

/**
 * Vị trí của một lò xo tắt dần yếu, chuẩn hoá về [0, 1].
 *
 * Dùng đúng đường cong lò xo chứ không phải `easeOut` vì lò xo xuất phát từ vận
 * tốc 0: nó đi chậm ở khoảnh khắc đầu rồi mới tăng tốc. `easeOut` thì ngược lại
 * — nhanh nhất ngay khung đầu tiên, nên khung đầu đã nuốt mất một phần ba quãng
 * đường và chính nó trông như một cú giật. Bộ số này vượt đích ~3% rồi lắng.
 */
function springCurve(t: number): number {
  'worklet'
  const damped = OMEGA * Math.sqrt(1 - ZETA * ZETA)
  return (
    1 -
    Math.exp(-ZETA * OMEGA * t) *
      (Math.cos(damped * t) + ((ZETA * OMEGA) / damped) * Math.sin(damped * t))
  )
}

/**
 * Trả về `number` chứ không phải object animation — giống cách Reanimated khai
 * báo `withTiming`, để gán thẳng vào `sharedValue.value` mà không phải ép kiểu
 * ở từng chỗ gọi.
 */
export function withFrameCappedTiming(
  toValue: number,
  config: FrameCappedTimingConfig,
): number {
  'worklet'
  return defineAnimation<FrameCappedAnimation>(toValue, () => {
    'worklet'
    const onFrame = (animation: FrameCappedAnimation, now: number): boolean => {
      const step = Math.min(now - animation.lastTimestamp, config.maxFrameMs)
      animation.lastTimestamp = now
      animation.elapsed += Math.max(step, 0)

      const progress = Math.min(animation.elapsed / config.duration, 1)
      animation.current =
        animation.startValue +
        (toValue - animation.startValue) * springCurve(progress)

      if (progress < 1) return false
      animation.current = toValue
      return true
    }

    const onStart = (
      animation: FrameCappedAnimation,
      value: number,
      now: number,
    ): void => {
      animation.startValue = value
      animation.current = value
      animation.elapsed = 0
      animation.lastTimestamp = now
    }

    return {
      onFrame,
      onStart,
      current: toValue,
      startValue: toValue,
      elapsed: 0,
      lastTimestamp: 0,
    }
  }) as unknown as number
}
