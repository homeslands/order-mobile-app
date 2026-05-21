/**
 * NotificationProvider — orchestrates all notification hooks.
 *
 * Responsibilities:
 * 1. Register FCM token when authenticated
 * 2. Start token refresh scheduler
 * 3. Listen foreground notifications → toast + sound
 * 4. Handle background tap + cold start → navigate
 * 5. Show permission dialog when denied
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { NotificationPermissionSheet } from '@/components/notification/notification-permission-sheet'
import { clearProcessed } from '@/lib/notification-dedup'
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
  const hasToken = useAuthStore((s) => !!s.token)
  const schedulerStartedRef = useRef(false)

  const { permissionDenied } = useRegisterDeviceToken(isAuthenticated)

  useNotificationListener(isAuthenticated)

  useNotificationResponse(isAuthenticated)

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

  useEffect(() => {
    if (!hasToken) {
      clearProcessed()
    }
  }, [hasToken])

  const [showPermissionSheet, setShowPermissionSheet] = useState(false)
  const hasShownRef = useRef(false)

  useEffect(() => {
    if (permissionDenied && isAuthenticated && !hasShownRef.current) {
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
