/**
 * useFirebaseToken — request notification permission + get FCM device token.
 *
 * - Only runs on physical device (simulator returns null)
 * - Compares new token vs stored token → skips if unchanged
 * - Saves new token to userStore (persisted AsyncStorage)
 * - Returns { token, permissionDenied } for upstream consumers
 */
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

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
    // eslint-disable-next-line no-console
    console.warn('[FCM] Push notifications are not supported on simulator')
    return { token: null, permissionDenied: false }
  }

  // Android 13+ needs explicit notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F7A737',
      sound: 'notification.wav',
    })
  }

  // Request permission
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    return { token: null, permissionDenied: true }
  }

  // Get FCM token (projectId from app.json > extra > eas > projectId)
  try {
    const pushToken = await Notifications.getDevicePushTokenAsync()
    return { token: pushToken.data as string, permissionDenied: false }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[FCM] Failed to get device push token:', error)
    return { token: null, permissionDenied: false }
  }
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

  // Listen for Firebase-side token rotation (e.g. token invalidated while app is open)
  useEffect(() => {
    if (!enabled) return

    const subscription = Notifications.addPushTokenListener(({ data }) => {
      const newToken = data as string
      if (!newToken) return
      setToken(newToken)
    })

    return () => subscription.remove()
  }, [enabled])

  return { token, permissionDenied, storedToken }
}
