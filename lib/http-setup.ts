/**
 * Bootstrap cho HTTP client — inject auth provider từ stores.
 * Gọi ngay khi app khởi động để tránh require cycle (utils/http ↔ stores).
 */
import { configureHttpAuth } from '@/utils/http'
import { useAuthStore } from '@/stores'
import { waitUntilAuthReady } from '@/lib/auth/auth-ready'
import {
  isAccessTokenExpired,
  refreshSession,
  resetRefreshState,
} from '@/lib/auth/auth-refresh'

configureHttpAuth({
  getToken: () => useAuthStore.getState().token,
  isAccessTokenExpired,
  refreshSession,
  waitUntilReady: waitUntilAuthReady,
  resetRefresh: resetRefreshState,
})

// Kick off now so a dead session is cleaned up before any request is sent
void waitUntilAuthReady()
