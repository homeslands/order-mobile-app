import { useSyncExternalStore } from 'react'
import { AccessibilityInfo } from 'react-native'

import { HAS_LIQUID_GLASS } from '@/utils/liquid-glass'

/**
 * Có được vẽ Liquid Glass lúc này hay không.
 *
 * `isLiquidGlassAvailable()` chỉ nói máy có hỗ trợ; nó vẫn trả về true khi
 * người dùng bật "Reduce Transparency" trong Trợ năng. Người bật tuỳ chọn đó
 * muốn nền đặc, nên hook trả về false và app quay lại giao diện cũ.
 *
 * Trạng thái nằm ở cấp module và chia chung cho mọi màn: chỉ một subscription
 * tới hệ thống, và mọi component đọc cùng một giá trị.
 */
let reduceTransparency = false
let asked = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function setReduceTransparency(value: boolean) {
  if (value === reduceTransparency) return
  reduceTransparency = value
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  // Giá trị ban đầu chỉ lấy được qua Promise, nên lần render đầu coi như
  // chưa bật; nếu thật ra đang bật thì emit() bên dưới sẽ sửa ngay sau đó.
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

function getSnapshot() {
  return HAS_LIQUID_GLASS && !reduceTransparency
}

export function useLiquidGlass(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
