/**
 * useFirebaseToken — request notification permission + get FCM device token.
 *
 * - Only runs on physical device (simulator returns null)
 * - iOS: uses @react-native-firebase/messaging to get FCM token (not raw APNs token)
 * - Android: same Firebase SDK, already worked before
 * - Returns { token, permissionDenied } for upstream consumers
 */
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import messaging from '@react-native-firebase/messaging'

import { useUserStore } from '@/stores'

// Foreground: suppress OS notification — app handles via toast + sound instead.
// Background: OS handles automatically (this handler only applies when app is in foreground).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
})

async function requestPermissionAndGetToken(): Promise<{
  token: string | null
  permissionDenied: boolean
}> {
  // Only real devices can receive push notifications
  if (!Device.isDevice) {
    return { token: null, permissionDenied: false }
  }

  if (Platform.OS === 'android') {
    // Android 13+ (API 33+): must create channel + request POST_NOTIFICATIONS
    // at runtime. messaging().requestPermission() does NOT trigger the system
    // dialog on Android — only expo-notifications does.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F7A737',
      sound: 'notification.mp3',
    })
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') {
      return { token: null, permissionDenied: true }
    }
  } else {
    // iOS: Firebase handles the permission dialog + APNs registration
    const authStatus = await messaging().requestPermission()
    const granted =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    if (!granted) {
      return { token: null, permissionDenied: true }
    }
    await messaging().registerDeviceForRemoteMessages()
  }

  // Get FCM token — retry up to 5x with backoff (APNs token may arrive async)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const fcmToken = await messaging().getToken()
      return { token: fcmToken ?? null, permissionDenied: false }
    } catch {
      if (attempt < 4) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1)),
        )
      }
    }
  }
  return { token: null, permissionDenied: false }
}

export function useFirebaseToken(enabled = true) {
  const [token, setToken] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const hasRunRef = useRef(false)

  const storedToken = useUserStore((s) => s.deviceToken)

  useEffect(() => {
    if (!enabled || hasRunRef.current) return
    hasRunRef.current = true

    let cancelled = false

    requestPermissionAndGetToken()
      .then(({ token: newToken, permissionDenied: denied }) => {
        if (cancelled) return

        setPermissionDenied(denied)

        if (denied || !newToken) return

        setToken(newToken)
        // NOTE: Don't save to store here — only save AFTER server confirms registration
        // (handled in use-register-device-token.ts)
      })
      .catch(() => {
        // Silent fail — will be retried on next auth cycle
      })

    return () => {
      cancelled = true
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
