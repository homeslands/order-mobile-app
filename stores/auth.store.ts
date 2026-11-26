import { AuthState, IAuthStore } from '@/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { parseServerTime } from '@/lib/auth/parse-server-time'
import { serverNow } from '@/lib/auth/server-clock'
import { createSecureStorage } from '@/utils/storage'

// Đăng nhập = còn token + refresh token chưa hết hạn theo giờ server.
// Không phụ thuộc isRefreshing để UI không nháy khi đang refresh.
const hasValidSession = (
  s: Pick<IAuthStore, 'token' | 'refreshToken' | 'expireTimeRefreshToken'>,
): boolean => {
  if (!s.token || !s.refreshToken) return false
  const exp = parseServerTime(s.expireTimeRefreshToken)
  return exp === null || serverNow() < exp
}

export const useAuthStore = create<IAuthStore>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      slug: undefined,
      token: undefined,
      refreshToken: undefined,
      expireTime: undefined,
      expireTimeRefreshToken: undefined,
      isRefreshing: false,
      isAuthenticated: () => hasValidSession(get()),
      isTokenValid: () => hasValidSession(get()),

      needsUserInfo: () => {
        // Basic implementation - để tránh circular dependency
        // Full logic sẽ được implement trong auth-helpers.ts
        return false
      },

      getAuthState: () => {
        const { isRefreshing } = get()

        if (isRefreshing) {
          return AuthState.REFRESHING
        }

        if (!get().isTokenValid()) {
          return AuthState.UNAUTHENTICATED
        }

        // Note: Full userInfo check được implement trong auth-helpers.ts
        // để tránh circular dependency
        return AuthState.AUTHENTICATED
      },
      setTokens: (t) =>
        set({
          token: t.accessToken,
          refreshToken: t.refreshToken,
          expireTime: t.expireTime,
          expireTimeRefreshToken: t.expireTimeRefreshToken,
        }),
      setSlug: (slug: string) => set({ slug }),
      setToken: (token: string) => set({ token }),
      setRefreshToken: (refreshToken: string) => set({ refreshToken }),
      setExpireTime: (expireTime: string) => set({ expireTime }),
      setExpireTimeRefreshToken: (expireTimeRefreshToken) =>
        set({ expireTimeRefreshToken }),
      setIsRefreshing: (isRefreshing: boolean) => set({ isRefreshing }),
      setLogout: () =>
        set({
          token: undefined,
          expireTime: undefined,
          refreshToken: undefined,
          expireTimeRefreshToken: undefined,
          slug: undefined,
          isRefreshing: false,
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => createSecureStorage()),
      // isRefreshing is transient runtime state — never persist it
      partialize: (state) => ({
        slug: state.slug,
        token: state.token,
        refreshToken: state.refreshToken,
        expireTime: state.expireTime,
        expireTimeRefreshToken: state.expireTimeRefreshToken,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ _hasHydrated: true })
      },
    },
  ),
)
