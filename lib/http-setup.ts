/**
 * Bootstrap cho HTTP client — inject auth state từ stores.
 * Gọi ngay khi app khởi động để tránh require cycle (utils/http ↔ stores).
 */
import { configureHttpAuth } from '@/utils/http'
import { useAuthStore, useUserStore } from '@/stores'
import { useNotificationStore } from '@/stores/notification.store'

configureHttpAuth({
  getAuthState: () => {
    const state = useAuthStore.getState()
    return {
      token: state.token,
      expireTime: state.expireTime,
      refreshToken: state.refreshToken,
      expireTimeRefreshToken: state.expireTimeRefreshToken,
      setToken: state.setToken,
      setRefreshToken: state.setRefreshToken,
      setExpireTime: state.setExpireTime,
      setExpireTimeRefreshToken: state.setExpireTimeRefreshToken,
      setIsRefreshing: state.setIsRefreshing,
      setLogout: state.setLogout,
    }
  },
  onLogout: () => {
    // Capture token BEFORE removeUserInfo() clears it
    const capturedToken = useUserStore.getState().deviceToken
    // Clear notification store so next login starts with a clean slate
    useNotificationStore.getState().clearAll()
    useUserStore.getState().removeUserInfo()
    // Fire-and-forget: unregister FCM token so it's not routed to this account
    import('@/lib/fcm-token-manager').then(({ cleanupTokenOnLogout }) => {
      cleanupTokenOnLogout(capturedToken ?? undefined).catch(() => {})
    })
  },
})
