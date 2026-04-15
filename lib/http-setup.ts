/**
 * Bootstrap cho HTTP client — inject auth state từ stores.
 * Gọi ngay khi app khởi động để tránh require cycle (utils/http ↔ stores).
 */
import { configureHttpAuth } from '@/utils/http'
import { useAuthStore, useUserStore } from '@/stores'

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
    useUserStore.getState().removeUserInfo()
  },
})
