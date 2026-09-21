import { useSyncExternalStore } from 'react'
import { AccessibilityInfo } from 'react-native'

import { HAS_LIQUID_GLASS } from '@/utils/liquid-glass'

/**
 * Độ trong của kính do HỆ ĐIỀU HÀNH quyết, app không chỉnh.
 *
 * iOS 26 đã có sẵn núm này ở Cài đặt (Clear ↔ Tinted) và `UIGlassEffect`
 * kiểu `.regular` tự bám theo lựa chọn đó — miễn là mình KHÔNG gán
 * `tintColor`. App từng có thanh kéo riêng; nó chỉ làm đúng một việc là gán
 * tintColor, tức tắt hành vi của hệ thống rồi thay bằng một thang đo mà quá
 * nửa khoảng kéo không đổi gì nhìn thấy được. Đã gỡ.
 *
 * `isLiquidGlassAvailable()` chỉ nói máy có hỗ trợ; nó vẫn trả true khi
 * người dùng bật "Giảm độ trong suốt" trong Trợ năng. Người bật tuỳ chọn đó
 * muốn nền đặc, nên hook trả false và mọi bề mặt quay về giao diện cũ.
 *
 * Trạng thái trợ năng nằm ở cấp module và chia chung cho mọi màn: chỉ một
 * subscription tới hệ thống, mọi component đọc cùng một giá trị.
 */
let reduceTransparency = false
let asked = false
const listeners = new Set<() => void>()

function setReduceTransparency(value: boolean) {
  if (value === reduceTransparency) return
  reduceTransparency = value
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  // Giá trị ban đầu chỉ lấy được qua Promise, nên lần render đầu coi như
  // chưa bật; nếu thật ra đang bật thì thông báo ngay sau đó sẽ sửa lại.
  if (!asked) {
    asked = true
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then(setReduceTransparency)
      .catch(() => {})
  }

  const sub = AccessibilityInfo.addEventListener(
    'reduceTransparencyChanged',
    setReduceTransparency,
  )

  return () => {
    listeners.delete(listener)
    sub.remove()
  }
}

function getReduceTransparency() {
  return reduceTransparency
}

/** Người dùng có đang bật "Giảm độ trong suốt" hay không. */
export function useReduceTransparency(): boolean {
  return useSyncExternalStore(
    subscribe,
    getReduceTransparency,
    getReduceTransparency,
  )
}

/** Bề mặt có được vẽ bằng Liquid Glass hay không. */
export function useGlassEnabled(): boolean {
  const reduced = useReduceTransparency()
  return HAS_LIQUID_GLASS && !reduced
}
