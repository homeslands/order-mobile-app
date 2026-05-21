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
  onLogout: async () => {
    // Capture token BEFORE removeUserInfo() clears it
    const capturedToken = useUserStore.getState().deviceToken
    const { cleanupTokenOnLogout } = await import('@/lib/fcm-token-manager')
    // Race with 3s timeout so slow network doesn't block auto-logout flow
    await Promise.race([
      cleanupTokenOnLogout(capturedToken ?? undefined),
      new Promise<void>((r) => setTimeout(r, 3000)),
    ]).catch(() => {})
    // Clear notification store so next login starts with a clean slate
    useNotificationStore.getState().clearAll()
    useUserStore.getState().removeUserInfo()
  },
})
