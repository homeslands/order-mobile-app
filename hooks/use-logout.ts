/**
 * Đăng xuất dùng chung: dọn http state, cache query, FCM token, store, rồi về home.
 *
 * Logic này vốn được chép tay trong app/(tabs)/profile/index.tsx và
 * app/(tabs)/profile/general-info.tsx — hai bản đã lệch nhau (bản general-info
 * thiếu clearOrderDisplayCache). Hook này là bản chuẩn; hai chỗ kia nên chuyển
 * sang dùng nó khi có dịp.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'

import { clearOrderDisplayCache } from '@/app/profile/history'
import { QUERYKEY } from '@/constants'
import { useAuthStore, useUserStore } from '@/stores'
import { useNotificationStore } from '@/stores/notification.store'
import { showToast } from '@/utils'
import { resetHttpState } from '@/utils/http'

export function useLogout() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { t: tToast } = useTranslation('toast')
  const setLogout = useAuthStore((s) => s.setLogout)
  const removeUserInfo = useUserStore((s) => s.removeUserInfo)

  return useCallback(async () => {
    resetHttpState()
    queryClient.removeQueries({ queryKey: [QUERYKEY.loyaltyPoints] })
    // Đọc deviceToken TRƯỚC removeUserInfo() — xoá trước thì cleanup đọc phải
    // null và bỏ qua bước huỷ đăng ký với server.
    const capturedToken = useUserStore.getState().deviceToken ?? undefined
    const { cleanupTokenOnLogout } = await import('@/lib/fcm-token-manager')
    // Chạy đua với timeout 3s để mạng chậm không treo luôn thao tác đăng xuất.
    await Promise.race([
      cleanupTokenOnLogout(capturedToken),
      new Promise<void>((r) => setTimeout(r, 3000)),
    ]).catch(() => {})
    useNotificationStore.getState().clearAll()
    clearOrderDisplayCache()
    setLogout()
    removeUserInfo()
    router.replace('/(tabs)/home' as never)
    showToast(tToast('logoutSuccess', 'Đăng xuất thành công'))
  }, [queryClient, removeUserInfo, router, setLogout, tToast])
}
