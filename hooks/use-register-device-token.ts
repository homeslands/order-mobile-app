/**
 * useRegisterDeviceToken — orchestrates token fetch + server registration.
 *
 * Runs when user is authenticated:
 * 1. Gets FCM token via useFirebaseToken
 * 2. If token is new (different from stored) → unregister old + register new
 * 3. Saves to userStore on success
 *
 * Does nothing if: not enabled, no token, token unchanged.
 */
import { useEffect, useRef } from 'react'

import {
  registerTokenWithRetry,
  unregisterToken,
} from '@/lib/fcm-token-registration'
import { useUserStore } from '@/stores'

import { useFirebaseToken } from './use-firebase-token'

export function useRegisterDeviceToken(enabled = true) {
  const { token, permissionDenied, storedToken } = useFirebaseToken(enabled)
  const isRegistering = useRef(false)
  const setDeviceToken = useUserStore((s) => s.setDeviceToken)

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[FCM] useRegisterDeviceToken:', { enabled, hasToken: !!token, isRegistering: isRegistering.current, storedToken: storedToken?.slice(0, 20) })
    if (!enabled || !token || isRegistering.current) {
      // eslint-disable-next-line no-console
      console.log('[FCM] Skipping register - early exit')
      return
    }
    // Token unchanged and already confirmed registered → skip
    if (token === storedToken) {
      // eslint-disable-next-line no-console
      console.log('[FCM] Token unchanged, skipping registration')
      return
    }

    // eslint-disable-next-line no-console
    console.log('[FCM] 🚀 Starting token registration...')
    isRegistering.current = true

    const run = async () => {
      try {
        // Unregister old token if different (best-effort)
        if (storedToken && storedToken !== token) {
          // eslint-disable-next-line no-console
          console.log('[FCM] Unregistering old token...')
          await unregisterToken(storedToken)
        }

        // eslint-disable-next-line no-console
        console.log('[FCM] Calling registerTokenWithRetry...')
        const result = await registerTokenWithRetry(token)
        // eslint-disable-next-line no-console
        console.log('[FCM] Register result:', result)

        if (result.success) {
          // eslint-disable-next-line no-console
          console.log('[FCM] ✅ Successfully registered, saving to store')
          // Only save to store AFTER server confirms — this is the gate
          setDeviceToken(token)
        } else {
          // eslint-disable-next-line no-console
          console.error('[FCM] ❌ Registration failed (all retries exhausted):', result.error)
        }
      } finally {
        isRegistering.current = false
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token])

  return { token, permissionDenied }
}
