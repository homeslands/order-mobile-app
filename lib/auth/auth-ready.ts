import { parseServerTime } from '@/lib/auth/parse-server-time'
import { serverNow } from '@/lib/auth/server-clock'
import { expireSession } from '@/lib/auth/session-expiry'
import { useAuthStore } from '@/stores/auth.store'

export const AUTH_HYDRATION_TIMEOUT_MS = 3000

function waitForHydration(): Promise<void> {
  if (useAuthStore.persist.hasHydrated()) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      clearTimeout(timer)
      unsubscribe()
      resolve()
    })
    // Never block requests forever if SecureStore hangs
    const timer = setTimeout(() => {
      unsubscribe()
      resolve()
    }, AUTH_HYDRATION_TIMEOUT_MS)
  })
}

function cleanupIfRefreshTokenDead(): void {
  const { refreshToken, expireTimeRefreshToken } = useAuthStore.getState()
  if (!refreshToken) return
  const exp = parseServerTime(expireTimeRefreshToken)
  if (exp === null || serverNow() < exp) return
  // setLogout runs synchronously inside, so the token is cleared on return
  void expireSession({ silent: true })
}

let ready: Promise<void> | null = null

/** Resolves once the auth store is hydrated; memoized for the app session. */
export function waitUntilAuthReady(): Promise<void> {
  if (!ready) {
    ready = waitForHydration().then(cleanupIfRefreshTokenDead)
  }
  return ready
}
