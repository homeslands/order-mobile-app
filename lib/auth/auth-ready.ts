import { parseServerTime } from '@/lib/auth/parse-server-time'
import { serverNow } from '@/lib/auth/server-clock'
import { expireSession } from '@/lib/auth/session-expiry'
import { useAuthStore } from '@/stores/auth.store'
import { useUserStore } from '@/stores/user.store'

export const AUTH_HYDRATION_TIMEOUT_MS = 3000

/** Resolves `true` once hydrated, `false` when the timeout fired first. */
function waitForHydration(): Promise<boolean> {
  if (useAuthStore.persist.hasHydrated()) return Promise.resolve(true)
  return new Promise<boolean>((resolve) => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      clearTimeout(timer)
      unsubscribe()
      resolve(true)
    })
    // Never block requests forever if SecureStore hangs
    const timer = setTimeout(() => {
      unsubscribe()
      resolve(false)
    }, AUTH_HYDRATION_TIMEOUT_MS)
  })
}

// App killed while the login sheet was open: tokens are gone but userInfo was
// kept for the sheet, so the UI would show a logged-in customer
function cleanupOrphanedUserInfo(): void {
  const { token, refreshToken } = useAuthStore.getState()
  if (token || refreshToken) return
  const { userInfo, removeUserInfo } = useUserStore.getState()
  if (userInfo) removeUserInfo()
}

function cleanupIfRefreshTokenDead(): void {
  const { refreshToken, expireTimeRefreshToken } = useAuthStore.getState()
  if (!refreshToken) return
  const exp = parseServerTime(expireTimeRefreshToken)
  if (exp === null || serverNow() < exp) return
  // setLogout runs synchronously inside, so the token is cleared on return
  void expireSession({ silent: true }).catch(() => {})
}

let ready: Promise<void> | null = null

/** Resolves once the auth store is hydrated; memoized for the app session. */
export function waitUntilAuthReady(): Promise<void> {
  if (!ready) {
    ready = waitForHydration().then((hydrated) => {
      // Only trust "no token" after a real hydration: on timeout the Keychain
      // may still be locked and the tokens simply not read yet
      if (hydrated) cleanupOrphanedUserInfo()
      cleanupIfRefreshTokenDead()
    })
  }
  return ready
}
