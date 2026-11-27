/**
 * HTTP client với token injection — không import stores (tránh require cycle).
 * Dùng configureHttpAuth() tại bootstrap để inject provider từ auth store.
 * File này không bao giờ đăng xuất: việc đó thuộc về refreshSession().
 */
import { recordServerTime } from '@/lib/auth/server-clock'
import type { RefreshResult } from '@/types/auth.type'
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

export const baseURL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_BASE_API_URL ||
  'https://api.example.com'

const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/** Provider inject tại bootstrap — tránh circular dependency utils ↔ stores */
export type HttpAuthProvider = {
  getToken(): string | undefined
  isAccessTokenExpired(): boolean
  refreshSession(): Promise<RefreshResult>
  waitUntilReady(): Promise<void>
  resetRefresh(): void
}

/** Request không thể có access token hợp lệ để gửi (refresh thất bại) */
export class SessionRefreshError extends Error {
  reason: 'invalid' | 'transient'
  cause?: unknown

  constructor(reason: 'invalid' | 'transient', cause?: unknown) {
    super(`Session refresh failed: ${reason}`)
    this.name = 'SessionRefreshError'
    this.reason = reason
    this.cause = cause
  }
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let provider: HttpAuthProvider | null = null

/**
 * Cấu hình auth provider cho http client.
 * Gọi ngay khi app khởi động (vd. trong lib/http-setup.ts).
 */
export function configureHttpAuth(next: HttpAuthProvider): void {
  provider = next
}

/** Reset trạng thái refresh — gọi khi login/logout để không kẹt giữa phiên. */
export function resetHttpState(): void {
  provider?.resetRefresh()
}

const PUBLIC_AUTH_URL =
  /^\/auth\/(login|register|refresh|forgot-password)(\/|\?|$)/

const isPublicUrl = (url?: string): boolean =>
  !!url && PUBLIC_AUTH_URL.test(url)

const recordTimestamp = (data: unknown): void => {
  if (data && typeof data === 'object') {
    recordServerTime((data as { timestamp?: unknown }).timestamp)
  }
}

http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (!provider || isPublicUrl(config.url)) return config

  await provider.waitUntilReady()

  if (provider.getToken() && provider.isAccessTokenExpired()) {
    const result = await provider.refreshSession()
    if (result.status === 'invalid') throw new SessionRefreshError('invalid')
    if (result.status === 'transient') {
      throw new SessionRefreshError('transient', result.error)
    }
  }

  // Đọc lại SAU refresh: không dùng token đã bắt trước đó
  const token = provider.getToken()
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => {
    recordTimestamp(response.data)
    return response
  },
  async (error) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error)

    recordTimestamp(error.response?.data)

    const config = error.config as RetryableConfig | undefined
    const sentAuth = config?.headers?.['Authorization']

    if (
      !provider ||
      !config ||
      error.response?.status !== 401 ||
      !sentAuth ||
      config._retry ||
      isPublicUrl(config.url)
    ) {
      return Promise.reject(error)
    }

    config._retry = true

    // Request khác đã refresh xong trong lúc request này bay
    const current = provider.getToken()
    if (current && `Bearer ${current}` !== sentAuth) return http(config)

    const result = await provider.refreshSession()
    if (result.status === 'refreshed') return http(config)
    return Promise.reject(error)
  },
)

export { http }
