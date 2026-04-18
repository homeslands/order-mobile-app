/**
 * FCM Token Registration — register/unregister device token with server.
 *
 * Retry queue: 3 attempts with exponential backoff (1s → 5s → 15s).
 * Classifies errors: network/server → retry, auth/validation → abort.
 * Also handles unregistering old token before registering new one.
 */
import { Platform } from 'react-native'

import { registerDeviceToken, unregisterDeviceToken } from '@/api/notification'

const MAX_RETRIES = 3
const BACKOFF_DELAYS = [1000, 5000, 15000]

type RegistrationResult = { success: boolean; error?: string }

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true
  const axiosError = error as {
    response?: { status?: number }
    code?: string
  }
  // Network errors — retry
  if (!axiosError.response) return true
  if (axiosError.code === 'ECONNABORTED') return true

  const status = axiosError.response.status
  if (!status) return true
  // 400 (validation), 401/403 (auth) — don't retry
  if (status === 400 || status === 401 || status === 403) return false
  // 429 (rate limit), 5xx (server) — retry
  return status === 429 || status >= 500
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getPlatform(): 'android' | 'ios' | 'web' {
  if (Platform.OS === 'android') return 'android'
  if (Platform.OS === 'ios') return 'ios'
  return 'web'
}

export async function registerTokenWithRetry(
  token: string,
): Promise<RegistrationResult> {
  const platform = getPlatform()
  const userAgent = `${Platform.OS}/${Platform.Version}`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await registerDeviceToken({ token, platform, userAgent })
      return { success: true }
    } catch (error) {
      const isLast = attempt === MAX_RETRIES
      const isRetryable = isRetryableError(error)

      if (isLast || !isRetryable) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
      // Wait before retry
      const backoffMs = BACKOFF_DELAYS[attempt] ?? 15000
      await delay(backoffMs)
    }
  }
  return { success: false, error: 'Max retries exceeded' }
}

export async function unregisterToken(
  token: string,
): Promise<RegistrationResult> {
  try {
    await unregisterDeviceToken({ token })
    return { success: true }
  } catch {
    // Silent fail — old token cleanup is best-effort
    return { success: false }
  }
}
