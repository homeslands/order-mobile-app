import axios, { AxiosError, AxiosResponse } from 'axios'

import { expireSession } from '@/lib/auth/session-expiry'
import { parseServerTime } from '@/lib/auth/parse-server-time'
import { recordServerTime, serverNow } from '@/lib/auth/server-clock'
import { useAuthStore } from '@/stores/auth.store'
import { IApiResponse, IRefreshTokenResponse, RefreshResult } from '@/types'
import { baseURL } from '@/utils/http'

export const ACCESS_TOKEN_EXPIRY_MARGIN_MS = 1000
export const REFRESH_TIMEOUT_MS = 15000

// Hết hạn theo giờ server, chừa biên để tránh gọi sát mốc
export function isAccessTokenExpired(): boolean {
  const { token, expireTime } = useAuthStore.getState()
  if (!token) return false
  const expireAt = parseServerTime(expireTime)
  if (expireAt === null) return true
  return serverNow() > expireAt + ACCESS_TOKEN_EXPIRY_MARGIN_MS
}

// Chỉ 4xx (trừ 408/429) mới chắc chắn là refresh token không dùng được
const isInvalidSessionError = (error: unknown): boolean => {
  if (!(error instanceof AxiosError)) return false
  const status = error.response?.status
  return (
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  )
}

// 401 nhưng access token vẫn còn hạn theo giờ server → BE từ chối vì chưa hết hạn
const isAccessTokenStillValid = (error: unknown): boolean => {
  if (!(error instanceof AxiosError) || error.response?.status !== 401) {
    return false
  }
  const expireAt = parseServerTime(useAuthStore.getState().expireTime)
  return expireAt !== null && serverNow() < expireAt
}

const doRefresh = async (): Promise<RefreshResult> => {
  const auth = useAuthStore.getState()
  if (!auth.refreshToken) {
    // Có token mà không có refreshToken là phiên hỏng: không dọn thì mọi request bị từ chối mãi
    if (auth.token) void expireSession({ silent: false }).catch(() => {})
    return { status: 'invalid' }
  }

  const sentRefreshToken = auth.refreshToken
  auth.setIsRefreshing(true)
  try {
    // axios trần, không qua instance để tránh vòng interceptor
    const response: AxiosResponse<IApiResponse<IRefreshTokenResponse>> =
      await axios.post(
        `${baseURL}/auth/refresh`,
        { refreshToken: sentRefreshToken, accessToken: auth.token },
        { timeout: REFRESH_TIMEOUT_MS },
      )

    recordServerTime(response.data?.timestamp)
    const result = response.data?.result
    // Phản hồi thiếu token → coi là lỗi tạm, không ghi store
    if (!result?.accessToken || !result?.refreshToken) {
      return {
        status: 'transient',
        error: new Error('Invalid refresh response'),
      }
    }
    // Đã đăng xuất hoặc đăng nhập lại trong lúc chờ → bỏ kết quả
    if (useAuthStore.getState().refreshToken !== sentRefreshToken) {
      return { status: 'invalid' }
    }
    useAuthStore.getState().setTokens(result)
    return { status: 'refreshed', accessToken: result.accessToken }
  } catch (error) {
    // Ghi giờ server từ body lỗi trước khi phân loại
    if (error instanceof AxiosError) {
      recordServerTime(
        (error.response?.data as { timestamp?: unknown } | undefined)
          ?.timestamp,
      )
    }
    if (isInvalidSessionError(error)) {
      // Phiên đã đổi trong lúc chờ → không đụng vào phiên mới
      if (useAuthStore.getState().refreshToken !== sentRefreshToken) {
        return { status: 'invalid' }
      }
      if (isAccessTokenStillValid(error)) return { status: 'still-valid' }
      void expireSession({ silent: false }).catch(() => {})
      return { status: 'invalid' }
    }
    return { status: 'transient', error }
  } finally {
    useAuthStore.getState().setIsRefreshing(false)
  }
}

let inflight: Promise<RefreshResult> | null = null

// Mọi lời gọi đồng thời dùng chung một request refresh
export function refreshSession(): Promise<RefreshResult> {
  if (!inflight) {
    const promise: Promise<RefreshResult> = doRefresh().finally(() => {
      // Sau resetRefreshState, con trỏ có thể đã thuộc lượt mới
      if (inflight === promise) inflight = null
    })
    inflight = promise
  }
  return inflight
}

// Bỏ con trỏ in-flight (dùng cho resetHttpState)
export function resetRefreshState(): void {
  inflight = null
}
