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
    if (!enabled || !token || isRegistering.current) return
    // Token unchanged and already confirmed registered → skip
    if (token === storedToken) return

    isRegistering.current = true
    let cancelled = false

    const run = async () => {
      try {
        // Unregister old token if different (best-effort)
        if (storedToken && storedToken !== token) {
          await unregisterToken(storedToken)
        }
        if (cancelled) return

        const result = await registerTokenWithRetry(token)
        if (cancelled) return

        if (result.success) {
          // Only save to store AFTER server confirms — this is the gate
          setDeviceToken(token)
        } else {
          // eslint-disable-next-line no-console
          console.error('[FCM] Token registration failed permanently:', result.error)
        }
      } finally {
        isRegistering.current = false
      }
    }

    run()

    return () => {
      cancelled = true
    }
    // setDeviceToken is stable (Zustand); storedToken intentionally omitted —
    // including it would re-run on server write-back and create a registration loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token])

  return { token, permissionDenied }
}
