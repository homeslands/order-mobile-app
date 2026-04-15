/**
 * HTTP client với token injection — không import stores (tránh require cycle).
 * Dùng configureHttpAuth() tại bootstrap để inject token getter từ auth store.
 */
import { IApiResponse, IRefreshTokenResponse } from '@/types'
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

const baseURL =
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

/** Auth state cần cho request interceptor */
export type HttpAuthState = {
  token?: string
  expireTime?: string
  refreshToken?: string
  setToken: (token: string) => void
  setRefreshToken: (token: string) => void
  setExpireTime: (time: string) => void
  setExpireTimeRefreshToken: (time: string) => void
  setIsRefreshing: (v: boolean) => void
  setLogout: () => void
}

/** Callback khi logout (401 hoặc refresh fail) — gọi removeUserInfo, v.v. */
export type HttpOnLogout = () => void

/** Provider inject tại bootstrap — tránh circular dependency utils ↔ stores */
let getAuthState: (() => HttpAuthState) | null = null
let onLogout: HttpOnLogout | null = null

/**
 * Cấu hình auth provider cho http client.
 * Gọi ngay khi app khởi động (vd. trong lib/http-setup.ts).
 */
export function configureHttpAuth(
  provider: {
    getAuthState: () => HttpAuthState
    onLogout: HttpOnLogout
  },
): void {
  getAuthState = provider.getAuthState
  onLogout = provider.onLogout
}

// Token refresh state
let isRefreshing = false
const failedQueue: {
  resolve: (token: string) => void
  reject: (error: unknown) => void
}[] = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token)
    } else {
      prom.reject(error)
    }
  })
  failedQueue.length = 0
}

const isTokenExpired = (expiryTime: string): boolean => {
  const currentDate = new Date()
  const expireDate = new Date(expiryTime)
  return currentDate.getTime() >= expireDate.getTime()
}

const publicRoutes = [
  { path: /^\/auth\/login$/, methods: ['post'] },
  { path: /^\/auth\/register$/, methods: ['post'] },
  { path: /^\/auth\/refresh$/, methods: ['post'] },
  { path: /^\/auth\/forgot-password$/, methods: ['post'] },
]

const isPublicRoute = (url: string, method: string): boolean =>
  publicRoutes.some(
    (route) =>
      route.path.test(url) && route.methods.includes(method.toLowerCase()),
  )

http.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // ─── Logging: Request Details ───
    // const hasToken = !!getAuthState?.()?.token
    // const logData = {
    //   method: config.method?.toUpperCase(),
    //   url: config.url,
    //   hasToken,
    //   timestamp: new Date().toISOString(),
    // }
    // if (__DEV__) {
    //   console.log('[HTTP Request]', logData)
    // }

    if (!getAuthState) {
      return config
    }

    const auth = getAuthState()
    const {
      token,
      expireTime,
      refreshToken: refreshTokenValue,
      setToken,
      setRefreshToken,
      setExpireTime,
      setExpireTimeRefreshToken,
      setIsRefreshing,
      setLogout,
    } = auth

    if (config.url && isPublicRoute(config.url, config.method || '')) {
      return config
    }

    if (token && expireTime && isTokenExpired(expireTime) && !isRefreshing) {
      isRefreshing = true
      setIsRefreshing(true)

      try {
        const response = await axios.post<IApiResponse<IRefreshTokenResponse>>(
          `${baseURL}/auth/refresh`,
          {
            refreshToken: refreshTokenValue,
            accessToken: token,
          },
        )

        const result = response.data.result
        setToken(result.accessToken)
        setRefreshToken(result.refreshToken)
        setExpireTime(result.expireTime)
        setExpireTimeRefreshToken(result.expireTimeRefreshToken)

        // if (__DEV__) {
        //   console.log('[HTTP] Token refreshed successfully')
        // }

        processQueue(null, result.accessToken)
      } catch (error) {
        // if (__DEV__) {
        //   console.error('[HTTP] Token refresh failed:', error)
        // }
        processQueue(error, null)
        setLogout()
        onLogout?.()
        return Promise.reject(error)
      } finally {
        isRefreshing = false
        setIsRefreshing(false)
      }
    } else if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (currentToken: string) => {
            config.headers['Authorization'] = `Bearer ${currentToken}`
            resolve(config)
          },
          reject: (error: unknown) => {
            reject(error)
          },
        })
      })
    }

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error),
)

http.interceptors.response.use(
  (response) => {
    // // ─── Logging: Success Response ───
    // if (__DEV__) {
    //   console.log('[HTTP Response]', {
    //     status: response.status,
    //     url: response.config.url,
    //     code: response.data?.code,
    //     message: response.data?.message,
    //     timestamp: new Date().toISOString(),
    //   })
    // }
    return response
  },
  (error) => {
    // ─── Logging: Error Response ───
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status
      // const apiCode = error.response?.data?.code
      // const apiMessage = error.response?.data?.message

      // if (__DEV__) {
      //   console.error('[HTTP Error]', {
      //     httpStatus: statusCode,
      //     apiCode,
      //     apiMessage,
      //     url: error.config?.url,
      //     method: error.config?.method?.toUpperCase(),
      //     hasToken: !!error.config?.headers?.Authorization,
      //     timestamp: new Date().toISOString(),
      //     fullError: {
      //       message: error.message,
      //       response: error.response?.data,
      //     },
      //   })
      // }

      if (statusCode === 401) {
        getAuthState?.().setLogout()
        onLogout?.()
      }
    } else {
      // if (__DEV__) {
      //   console.error('[HTTP Error] Non-Axios error:', error)
      // }
    }
    return Promise.reject(error)
  },
)

export { http }
