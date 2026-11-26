/**
 * Bootstrap cho HTTP client — inject auth provider từ stores.
 * Gọi ngay khi app khởi động để tránh require cycle (utils/http ↔ stores).
 */
import { configureHttpAuth } from '@/utils/http'
import { useAuthStore } from '@/stores'
import {
  isAccessTokenExpired,
  refreshSession,
  resetRefreshState,
} from '@/lib/auth/auth-refresh'

configureHttpAuth({
  getToken: () => useAuthStore.getState().token,
  isAccessTokenExpired,
  refreshSession,
  // Task 6 thay bằng chờ hydrate
  waitUntilReady: () => Promise.resolve(),
  resetRefresh: resetRefreshState,
})
