import { useSyncExternalStore } from 'react'
import { AccessibilityInfo } from 'react-native'

import { useGlassStore } from '@/stores/glass.store'
import { HAS_LIQUID_GLASS } from '@/utils/liquid-glass'

/**
 * Mức độ trong của Liquid Glass đang áp dụng, 0 đến 1.
 *
 * `isLiquidGlassAvailable()` chỉ nói máy có hỗ trợ; nó vẫn trả true khi
 * người dùng bật "Reduce Transparency" trong Trợ năng. Người bật tuỳ chọn đó
 * muốn nền đặc, nên hook trả 0 và mọi bề mặt quay về giao diện cũ.
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

/** Máy có hỗ trợ Liquid Glass hay không — dùng để ẩn/hiện mục cài đặt. */
export function useGlassSupported(): boolean {
  return HAS_LIQUID_GLASS
}

/** Người dùng có đang bật Giảm độ trong suốt hay không. */
export function useReduceTransparency(): boolean {
  return useSyncExternalStore(
    subscribe,
    getReduceTransparency,
    getReduceTransparency,
  )
}

export function useGlassLevel(): number {
  const level = useGlassStore((s) => s.level)
  const reduced = useReduceTransparency()
  if (!HAS_LIQUID_GLASS || reduced) return 0
  return level
}
