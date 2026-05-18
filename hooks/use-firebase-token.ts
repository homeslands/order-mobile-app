/**
 * useFirebaseToken — request notification permission + get FCM device token.
 *
 * - Only runs on physical device (simulator returns null)
 * - iOS: uses @react-native-firebase/messaging to get FCM token (not raw APNs token)
 * - Android: same Firebase SDK, already worked before
 * - Returns { token, permissionDenied } for upstream consumers
 *
 * Cancellation:
 * - Each effect run owns a CancelToken. Cleanup flips `cancelled = true` so any
 *   pending await boundary bails out cleanly. When `enabled` flips false→true
 *   the next run gets a fresh token and re-fetches (no stale `hasRunRef` lock).
 */
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import messaging from '@react-native-firebase/messaging'

import { useUserStore } from '@/stores'

interface CancelToken {
  cancelled: boolean
}

async function requestPermissionAndGetToken(
  cancelToken: CancelToken,
): Promise<{ token: string | null; permissionDenied: boolean }> {
  // Only real devices can receive push notifications
  if (!Device.isDevice) {
    return { token: null, permissionDenied: false }
  }

  if (Platform.OS === 'android') {
    // Android 13+ (API 33+): must request POST_NOTIFICATIONS at runtime.
    // messaging().requestPermission() does NOT trigger the system dialog on Android.
    const { status } = await Notifications.requestPermissionsAsync()
    if (cancelToken.cancelled) return { token: null, permissionDenied: false }
    if (status !== 'granted') {
      return { token: null, permissionDenied: true }
    }
  } else {
    // iOS: Firebase handles the permission dialog + APNs registration
    const authStatus = await messaging().requestPermission()
    if (cancelToken.cancelled) return { token: null, permissionDenied: false }
    const granted =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    if (!granted) {
      return { token: null, permissionDenied: true }
    }
    try {
      await messaging().registerDeviceForRemoteMessages()
    } catch (e) {
      // APNs registration failure will cause getToken() to fail in the loop below
      // eslint-disable-next-line no-console
      console.error('[FCM] registerDeviceForRemoteMessages failed (iOS):', e)
    }
    if (cancelToken.cancelled) return { token: null, permissionDenied: false }
  }

  // Get FCM token — retry up to 5x with backoff (APNs token may arrive async on iOS)
  let lastError: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    if (cancelToken.cancelled) return { token: null, permissionDenied: false }
    try {
      const fcmToken = await messaging().getToken()
      if (cancelToken.cancelled) return { token: null, permissionDenied: false }
      return { token: fcmToken ?? null, permissionDenied: false }
    } catch (e) {
      lastError = e
      if (attempt < 4) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1)),
        )
        if (cancelToken.cancelled)
          return { token: null, permissionDenied: false }
      }
    }
  }
  // eslint-disable-next-line no-console
  console.error('[FCM] getToken failed after 5 attempts:', lastError)
  return { token: null, permissionDenied: false }
}

export function useFirebaseToken(enabled = true) {
  const [token, setToken] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const storedToken = useUserStore((s) => s.deviceToken)

  useEffect(() => {
    if (!enabled) return

    const cancelToken: CancelToken = { cancelled: false }

    requestPermissionAndGetToken(cancelToken)
      .then(({ token: newToken, permissionDenied: denied }) => {
        if (cancelToken.cancelled) return
        setPermissionDenied(denied)
        if (denied || !newToken) return
        setToken(newToken)
        // NOTE: Don't save to store here — only save AFTER server confirms registration
        // (handled in use-register-device-token.ts)
      })
      .catch((e) => {
        if (cancelToken.cancelled) return
        // eslint-disable-next-line no-console
        console.error('[FCM] requestPermissionAndGetToken rejected:', e)
      })

    return () => {
      cancelToken.cancelled = true
    }
  }, [enabled])

  // Listen for FCM token rotation (e.g. token invalidated while app is open)
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = messaging().onTokenRefresh((newToken: string) => {
      if (!newToken) return
      setToken(newToken)
    })

    return unsubscribe
  }, [enabled])

  return { token, permissionDenied, storedToken }
}
