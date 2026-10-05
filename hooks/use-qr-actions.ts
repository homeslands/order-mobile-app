/**
 * Ba lối vào QR, dùng chung giữa sheet chọn QR ở màn Profile và khối lối tắt
 * trên Home.
 *
 * Rút ra khỏi `components/profile/qr-selection-sheet.tsx` khi Home thành
 * consumer thứ hai: ba handler này mang theo tri thức về thứ tự rAF giữa hai
 * sheet (xem comment trong `openMemberId`), nên một bản copy sẽ phân kỳ.
 *
 * `useAuthStore` import từ `@/stores` (không phải `@/stores/auth.store`) vì
 * test `__tests__/screens/point-qr/entry-and-dialog.test.tsx` mock đường đó.
 */
import { useRouter } from 'expo-router'
import { useCallback, useRef } from 'react'

import { scheduleTransitionTask } from '@/lib/navigation'
import { useAuthStore } from '@/stores'
import { useQRSelectionSheetStore } from '@/stores/qr-selection-sheet.store'
import { useScanSheetStore } from '@/stores/scan-sheet.store'

/**
 * Bỏ qua cú chạm thứ hai trong khoảng này.
 *
 * Ba hàm dưới dùng `router.push` trần, không đi qua navigation lock của
 * `lib/navigation` (lock chỉ nằm trong `navigateNative`/`navigateWhenUnlocked`).
 * Trong sheet rủi ro thấp vì sheet tự đóng sau cú chạm; trên Home ba tile vẫn
 * nằm đó, nên chạm nhanh hai tile đẩy hai màn chồng nhau. 600ms dài hơn
 * `MOTION.nativeStack.durationMs` (360) nhưng ngắn hơn khoảng nghỉ giữa hai cú
 * chạm có ý thức.
 */
const TAP_GUARD_MS = 600

export function useQrActions(): {
  openMemberId: () => void
  openCoinPayment: () => void
  openScanPay: () => void
} {
  const router = useRouter()
  const closeSelection = useQRSelectionSheetStore((s) => s.close)
  const openScanSheet = useScanSheetStore((s) => s.open)
  const closeScanSheet = useScanSheetStore((s) => s.close)
  // Một ref dùng chung cho cả ba hàm: "chạm tile 1 rồi tile 2" cũng phải chặn.
  // Per-instance, không module-level — Home và sheet không chặn lẫn nhau.
  const lastTapRef = useRef(0)

  /** true nếu nhận cú chạm này; false nếu là chạm trùng trong TAP_GUARD_MS. */
  const claimTap = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < TAP_GUARD_MS) return false
    lastTapRef.current = now
    return true
  }, [])

  const pushLogin = useCallback(() => {
    scheduleTransitionTask(() => router.push('/auth/login'))
    // router intentionally omitted — push destination is a string literal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openMemberId = useCallback(() => {
    if (!claimTap()) return
    if (!useAuthStore.getState().isAuthenticated()) {
      // KHÔNG gọi openScanSheet ở nhánh này: ScanSheetPortal mount toàn cục
      // nên nó sẽ bật lên chồng trên màn login với ô QR rỗng.
      pushLogin()
      return
    }
    // closeSelection() → useEffect → dismiss() → willUnmountSheet(QRS) chạy
    // đồng bộ. openScanSheet() → useEffect → present(SSP) xếp hàng qua rAF.
    // rAF chạy sau toàn bộ code đồng bộ, nên willUnmount=true trên QRS trước
    // khi mountSheet(SSP) chạy — provider bỏ qua minimize(SSP), không chồng
    // sheet, không delay.
    closeSelection()
    openScanSheet()
  }, [claimTap, pushLogin, closeSelection, openScanSheet])

  const openCoinPayment = useCallback(() => {
    if (!claimTap()) return
    closeSelection()
    closeScanSheet()
    if (!useAuthStore.getState().isAuthenticated()) {
      pushLogin()
      return
    }
    scheduleTransitionTask(() => router.push('/payment/qr-generate'))
    // router intentionally omitted — push destination is a string literal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimTap, pushLogin, closeSelection, closeScanSheet])

  const openScanPay = useCallback(() => {
    if (!claimTap()) return
    closeSelection()
    closeScanSheet()
    // Chưa đăng nhập thì sang login trước, để khỏi mở camera rồi nhận 401.
    if (!useAuthStore.getState().isAuthenticated()) {
      pushLogin()
      return
    }
    scheduleTransitionTask(() => router.push('/payment/scan-point'))
    // router intentionally omitted — same reason as openCoinPayment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimTap, pushLogin, closeSelection, closeScanSheet])

  return { openMemberId, openCoinPayment, openScanPay }
}
