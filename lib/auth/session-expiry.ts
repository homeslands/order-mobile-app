import { create } from 'zustand'

import { QUERYKEY } from '@/constants'
import { cleanupTokenOnLogout } from '@/lib/fcm-token-manager'
import { queryClient } from '@/lib/query-client'
import { useAuthStore, useUserStore } from '@/stores'
import { useNotificationStore } from '@/stores/notification.store'

const CLEANUP_TIMEOUT_MS = 3000

interface ISessionExpiryState {
  pending: boolean
  markExpired: () => void
  consume: () => void
}

export const useSessionExpiryStore = create<ISessionExpiryState>((set) => ({
  pending: false,
  markExpired: () => set({ pending: true }),
  consume: () => set({ pending: false }),
}))

let inflight: Promise<void> | null = null

async function run(silent: boolean): Promise<void> {
  // Capture token BEFORE anything is cleared
  const deviceToken = useUserStore.getState().deviceToken
  // Synchronous on purpose: callers rely on logout being done on return
  useAuthStore.getState().setLogout()
  // Silent: no UI owns userInfo, clear it now so nothing sees it without a token
  if (silent) useUserStore.getState().removeUserInfo()
  queryClient.removeQueries({ queryKey: [QUERYKEY.loyaltyPoints] })
  if (!silent) useSessionExpiryStore.getState().markExpired()

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    // Race with timeout so slow network doesn't block auto-logout flow
    await Promise.race([
      cleanupTokenOnLogout(deviceToken ?? undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, CLEANUP_TIMEOUT_MS)
      }),
    ])
  } catch {
    // Best-effort cleanup
  } finally {
    clearTimeout(timer)
  }

  // Clear notification store so next login starts with a clean slate
  useNotificationStore.getState().clearAll()
}

/** Single-flight: concurrent calls share one promise. */
export function expireSession(options: { silent: boolean }): Promise<void> {
  if (inflight) return inflight
  inflight = run(options.silent).finally(() => {
    inflight = null
  })
  return inflight
}
