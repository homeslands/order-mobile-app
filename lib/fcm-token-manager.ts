/**
 * FCM Token Manager — refresh scheduler + logout cleanup.
 *
 * - Checks token age every 24h, refreshes if > 48h
 * - Re-checks when app returns to foreground (AppState)
 * - Unregisters token from server on logout
 */
import { AppState, type AppStateStatus } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'

import { useUserStore } from '@/stores'
import {
  registerTokenWithRetry,
  unregisterToken,
} from '@/lib/fcm-token-registration'

const TOKEN_CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24h
const TOKEN_REFRESH_THRESHOLD = 48 * 60 * 60 * 1000 // 48h
const STORAGE_KEY_TIMESTAMP = 'fcm_token_registered_at'

let intervalId: ReturnType<typeof setInterval> | null = null
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null =
  null

async function getStoredTimestamp(): Promise<number> {
  try {
    const { createSafeStorage } = await import('@/utils/storage')
    const storage = createSafeStorage()
    const raw = storage.getItem(STORAGE_KEY_TIMESTAMP)
    // createSafeStorage may return string or Promise<string>
    const value = raw instanceof Promise ? await raw : raw
    return value ? Number(value) : 0
  } catch {
    return 0
  }
}

async function setStoredTimestamp(ts: number): Promise<void> {
  try {
    const { createSafeStorage } = await import('@/utils/storage')
    const storage = createSafeStorage()
    storage.setItem(STORAGE_KEY_TIMESTAMP, String(ts))
  } catch {
    // Silent fail
  }
}

async function checkAndRefresh(): Promise<void> {
  const storedToken = useUserStore.getState().deviceToken
  if (!storedToken) return
  if (!Device.isDevice) return

  try {
    const pushToken = await Notifications.getDevicePushTokenAsync()
    const currentToken = pushToken.data as string

    if (currentToken !== storedToken) {
      // Firebase rotated the token — re-register immediately regardless of age
      const result = await registerTokenWithRetry(currentToken)
      if (result.success) {
        useUserStore.getState().setDeviceToken(currentToken)
        await setStoredTimestamp(Date.now())
      }
      return
    }

    // Token unchanged — only refresh if older than threshold
    const registeredAt = await getStoredTimestamp()
    if (!registeredAt) {
      await setStoredTimestamp(Date.now())
      return
    }

    const age = Date.now() - registeredAt
    if (age < TOKEN_REFRESH_THRESHOLD) return

    // Token is stale — re-register to keep server in sync
    const result = await registerTokenWithRetry(currentToken)
    if (result.success) {
      await setStoredTimestamp(Date.now())
    }
  } catch {
    // Silent fail — refresh will be retried on next interval/foreground
  }
}

function startInterval(): void {
  if (intervalId) return
  intervalId = setInterval(checkAndRefresh, TOKEN_CHECK_INTERVAL)
}

function stopInterval(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function handleAppStateChange(state: AppStateStatus): void {
  if (state === 'active') {
    // Resume interval + re-check on foreground. Android Doze pauses timers
    // in background anyway — pausing explicitly releases the closure ref.
    startInterval()
    checkAndRefresh()
  } else if (state === 'background') {
    stopInterval()
  }
}

/** Start periodic token refresh — call after login */
export function startTokenRefreshScheduler(): void {
  stopTokenRefreshScheduler()

  // Initial check
  checkAndRefresh()

  // Periodic check every 24h (only while foreground)
  startInterval()

  // Re-check when app comes to foreground, pause when backgrounded
  appStateSubscription = AppState.addEventListener(
    'change',
    handleAppStateChange,
  )
}

/** Stop scheduler + cleanup — call on logout */
export function stopTokenRefreshScheduler(): void {
  stopInterval()
  if (appStateSubscription) {
    appStateSubscription.remove()
    appStateSubscription = null
  }
}

/**
 * Unregister token from server + stop scheduler — call on logout.
 *
 * Pass `capturedToken` when you need to capture the token BEFORE clearing
 * the store (e.g. the token is cleared synchronously right after this call).
 * If omitted, reads from the store (legacy path — may race with removeUserInfo).
 */
export async function cleanupTokenOnLogout(
  capturedToken?: string,
): Promise<void> {
  stopTokenRefreshScheduler()

  const token = capturedToken ?? useUserStore.getState().deviceToken
  if (token) {
    await unregisterToken(token)
  }
  // deviceToken cleared by removeUserInfo() / clearUserData() in the caller
}
