/**
 * NotificationProvider — orchestrates all notification hooks.
 *
 * Responsibilities:
 * 1. Register FCM token when authenticated (T2+T3)
 * 2. Start token refresh scheduler (T4)
 * 3. Listen foreground notifications → toast + sound (T5)
 * 4. Handle background tap → navigate (T7+T8)
 * 5. Show permission dialog when denied (T12)
 *
 * Mount once in _layout.tsx, inside QueryClientProvider.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { NotificationPermissionSheet } from '@/components/notification/notification-permission-sheet'
import { useRegisterDeviceToken } from '@/hooks/use-register-device-token'
import { useNotificationListener } from '@/hooks/use-notification-listener'
import { useNotificationResponse } from '@/hooks/use-notification-response'
import {
  startTokenRefreshScheduler,
  stopTokenRefreshScheduler,
} from '@/lib/fcm-token-manager'
import { useAuthStore } from '@/stores'

export function NotificationProvider() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const schedulerStartedRef = useRef(false)

  // T2+T3: Get FCM token + register with server (only when authenticated)
  const { permissionDenied } = useRegisterDeviceToken(isAuthenticated)

  // T5: Foreground listener — only when authenticated so foreground FCM
  // notifications are never added to the store while no user is logged in.
  useNotificationListener(isAuthenticated)

  // T7+T8: Background tap + cold start — gated on auth so cold-start taps
  // from a previous user's session are not processed under the new user.
  // The effect re-runs when isAuthenticated becomes true, so
  // getLastNotificationResponseAsync() is still called after login.
  useNotificationResponse(isAuthenticated)

  // T4: Token refresh scheduler
  useEffect(() => {
    if (isAuthenticated && !schedulerStartedRef.current) {
      startTokenRefreshScheduler()
      schedulerStartedRef.current = true
    } else if (!isAuthenticated && schedulerStartedRef.current) {
      stopTokenRefreshScheduler()
      schedulerStartedRef.current = false
    }
  }, [isAuthenticated])

  useEffect(() => {
    return () => {
      stopTokenRefreshScheduler()
    }
  }, [])

  // T12: Permission dialog — show once per session when denied
  const [showPermissionSheet, setShowPermissionSheet] = useState(false)
  const hasShownRef = useRef(false)

  useEffect(() => {
    if (permissionDenied && isAuthenticated && !hasShownRef.current) {
      // Delay to avoid showing during app mount animation
      const timer = setTimeout(() => {
        setShowPermissionSheet(true)
        hasShownRef.current = true
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [permissionDenied, isAuthenticated])

  const handleClosePermission = useCallback(() => {
    setShowPermissionSheet(false)
  }, [])

  return (
    <NotificationPermissionSheet
      visible={showPermissionSheet}
      onClose={handleClosePermission}
    />
  )
}
