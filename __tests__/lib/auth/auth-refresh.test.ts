const mockExpireSession = jest.fn()

jest.mock('@/lib/auth/session-expiry', () => ({
  expireSession: (...args: unknown[]) => mockExpireSession(...args),
}))

import axios, { AxiosError } from 'axios'

import {
  ACCESS_TOKEN_EXPIRY_MARGIN_MS,
  REFRESH_TIMEOUT_MS,
  isAccessTokenExpired,
  refreshSession,
  resetRefreshState,
} from '@/lib/auth/auth-refresh'
import { resetServerClock } from '@/lib/auth/server-clock'
import { useAuthStore } from '@/stores/auth.store'
import { baseURL } from '@/utils/http'

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

const seedAuth = (over: Record<string, unknown> = {}) =>
  useAuthStore.setState({
    token: 'OLD',
    refreshToken: 'REFRESH',
    expireTime: iso(-60000),
    expireTimeRefreshToken: iso(86400000),
    isRefreshing: false,
    ...over,
  } as never)

const newTokens = () => ({
  accessToken: 'NEW',
  refreshToken: 'NEW_REFRESH',
  expireTime: iso(600000),
  expireTimeRefreshToken: iso(86400000),
})

const okResponse = (result: unknown = newTokens(), timestamp?: string) => ({
  data: { result, timestamp },
})

const httpError = (status: number, data?: unknown) =>
  new AxiosError('fail', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data,
  } as never)

// Promise reject có spy trên .catch: biết được caller fire-and-forget đã gắn
// handler hay chưa
const mockExpireSessionRejecting = () => {
  const catchSpy = jest.fn()
  mockExpireSession.mockImplementation(() => {
    const rejected = Promise.reject(new Error('boom'))
    // Gắn handler thật ngay để test không tự sinh unhandled rejection
    rejected.catch(() => {})
    rejected.catch = catchSpy as never
    return rejected
  })
  return catchSpy
}

describe('auth-refresh', () => {
  let postSpy: jest.SpyInstance

  beforeEach(() => {
    jest.restoreAllMocks()
    mockExpireSession.mockReset()
    mockExpireSession.mockResolvedValue(undefined)
    resetRefreshState()
    resetServerClock()
    seedAuth()
    postSpy = jest.spyOn(axios, 'post')
  })

  describe('isAccessTokenExpired', () => {
    it('không có token → false', () => {
      seedAuth({ token: undefined })
      expect(isAccessTokenExpired()).toBe(false)
    })

    it('expireTime rác → true', () => {
      seedAuth({ expireTime: 'rác' })
      expect(isAccessTokenExpired()).toBe(true)
    })

    it('trong biên margin → false, quá margin → true', () => {
      seedAuth({ expireTime: iso(-ACCESS_TOKEN_EXPIRY_MARGIN_MS + 500) })
      expect(isAccessTokenExpired()).toBe(false)
      seedAuth({ expireTime: iso(-ACCESS_TOKEN_EXPIRY_MARGIN_MS - 500) })
      expect(isAccessTokenExpired()).toBe(true)
    })
  })

  describe('refreshSession', () => {
    it('3 lần gọi đồng thời → axios.post 1 lần, cùng kết quả refreshed', async () => {
      postSpy.mockResolvedValue(okResponse())
      const results = await Promise.all([
        refreshSession(),
        refreshSession(),
        refreshSession(),
      ])
      expect(postSpy).toHaveBeenCalledTimes(1)
      for (const r of results) {
        expect(r).toEqual({ status: 'refreshed', accessToken: 'NEW' })
      }
    })

    it('gọi /auth/refresh với token hiện tại và timeout, ghi store', async () => {
      const tokens = newTokens()
      postSpy.mockResolvedValue(okResponse(tokens))
      await refreshSession()
      expect(postSpy).toHaveBeenCalledWith(
        `${baseURL}/auth/refresh`,
        { refreshToken: 'REFRESH', accessToken: 'OLD' },
        { timeout: REFRESH_TIMEOUT_MS },
      )
      expect(REFRESH_TIMEOUT_MS).toBe(15000)
      expect(useAuthStore.getState()).toMatchObject({
        token: 'NEW',
        refreshToken: 'NEW_REFRESH',
        expireTime: tokens.expireTime,
        expireTimeRefreshToken: tokens.expireTimeRefreshToken,
        isRefreshing: false,
      })
    })

    it('đặt isRefreshing=true trong lúc chờ, false khi xong', async () => {
      let during: boolean | undefined
      postSpy.mockImplementation(async () => {
        during = useAuthStore.getState().isRefreshing
        return okResponse()
      })
      await refreshSession()
      expect(during).toBe(true)
      expect(useAuthStore.getState().isRefreshing).toBe(false)
    })

    it.each([
      ['lỗi mạng', new AxiosError('Network Error', 'ERR_NETWORK')],
      ['ECONNABORTED', new AxiosError('timeout', 'ECONNABORTED')],
      ['500', httpError(500)],
      ['408', httpError(408)],
      ['429', httpError(429)],
    ])(
      '%s → transient, store giữ nguyên, không expireSession',
      async (_n, e) => {
        postSpy.mockRejectedValueOnce(e)
        const result = await refreshSession()
        expect(result.status).toBe('transient')
        expect(useAuthStore.getState()).toMatchObject({
          token: 'OLD',
          refreshToken: 'REFRESH',
          isRefreshing: false,
        })
        expect(mockExpireSession).not.toHaveBeenCalled()
      },
    )

    it('401 khi access token đã hết hạn theo giờ server → invalid, expireSession 1 lần', async () => {
      postSpy.mockRejectedValueOnce(httpError(401))
      expect(await refreshSession()).toEqual({ status: 'invalid' })
      expect(mockExpireSession).toHaveBeenCalledTimes(1)
      expect(mockExpireSession).toHaveBeenCalledWith({ silent: false })
    })

    it('401 nhưng giờ server cho thấy access token còn hạn → still-valid, không đăng xuất', async () => {
      // Máy nhanh 5 phút: giờ máy đã quá hạn, server thì chưa
      seedAuth({ expireTime: iso(-3 * 60000) })
      postSpy.mockRejectedValueOnce(
        httpError(401, { timestamp: iso(-5 * 60000) }),
      )
      expect(await refreshSession()).toEqual({ status: 'still-valid' })
      expect(mockExpireSession).not.toHaveBeenCalled()
      expect(useAuthStore.getState().refreshToken).toBe('REFRESH')
    })

    it('422 (tài khoản bị khoá) → invalid', async () => {
      postSpy.mockRejectedValueOnce(httpError(422))
      expect(await refreshSession()).toEqual({ status: 'invalid' })
      expect(mockExpireSession).toHaveBeenCalledWith({ silent: false })
    })

    it('expireSession reject (đường 401) → đã gắn catch, không thành unhandled rejection', async () => {
      const catchSpy = mockExpireSessionRejecting()
      postSpy.mockRejectedValueOnce(httpError(401))
      expect(await refreshSession()).toEqual({ status: 'invalid' })
      expect(catchSpy).toHaveBeenCalledTimes(1)
    })

    it('expireSession reject (thiếu refreshToken) → đã gắn catch, không thành unhandled rejection', async () => {
      const catchSpy = mockExpireSessionRejecting()
      seedAuth({ refreshToken: undefined })
      expect(await refreshSession()).toEqual({ status: 'invalid' })
      expect(catchSpy).toHaveBeenCalledTimes(1)
    })

    it('có token nhưng không có refreshToken → invalid, không gọi mạng, dọn phiên 1 lần', async () => {
      seedAuth({ refreshToken: undefined })
      expect(await refreshSession()).toEqual({ status: 'invalid' })
      expect(postSpy).not.toHaveBeenCalled()
      expect(mockExpireSession).toHaveBeenCalledTimes(1)
      expect(mockExpireSession).toHaveBeenCalledWith({ silent: false })
    })

    it('200 thiếu accessToken → transient, store không đổi', async () => {
      postSpy.mockResolvedValueOnce(okResponse({ refreshToken: 'X' }))
      expect((await refreshSession()).status).toBe('transient')
      expect(useAuthStore.getState()).toMatchObject({
        token: 'OLD',
        refreshToken: 'REFRESH',
      })
      expect(mockExpireSession).not.toHaveBeenCalled()
    })

    it('phiên đổi trong lúc chờ (đường thành công) → invalid, không ghi store', async () => {
      postSpy.mockImplementation(async () => {
        seedAuth({ token: 'OTHER', refreshToken: 'OTHER_REFRESH' })
        return okResponse()
      })
      expect(await refreshSession()).toEqual({ status: 'invalid' })
      expect(useAuthStore.getState()).toMatchObject({
        token: 'OTHER',
        refreshToken: 'OTHER_REFRESH',
      })
      expect(mockExpireSession).not.toHaveBeenCalled()
    })

    it('phiên đổi trong lúc chờ (đường lỗi 401) → invalid, không expireSession, token mới còn nguyên', async () => {
      postSpy.mockImplementation(async () => {
        seedAuth({ token: 'OTHER', refreshToken: 'OTHER_REFRESH' })
        throw httpError(401)
      })
      expect(await refreshSession()).toEqual({ status: 'invalid' })
      expect(mockExpireSession).not.toHaveBeenCalled()
      expect(useAuthStore.getState()).toMatchObject({
        token: 'OTHER',
        refreshToken: 'OTHER_REFRESH',
      })
    })

    it('ghi timestamp từ body thành công vào server-clock', async () => {
      // Máy nhanh 5 phút theo server → token hết hạn 3 phút trước (giờ máy) còn hạn
      postSpy.mockResolvedValueOnce(okResponse(newTokens(), iso(-5 * 60000)))
      await refreshSession()
      seedAuth({ expireTime: iso(-3 * 60000) })
      expect(isAccessTokenExpired()).toBe(false)
    })

    it('ghi timestamp từ body lỗi vào server-clock', async () => {
      postSpy.mockRejectedValueOnce(
        httpError(500, { timestamp: iso(-5 * 60000) }),
      )
      await refreshSession()
      seedAuth({ expireTime: iso(-3 * 60000) })
      expect(isAccessTokenExpired()).toBe(false)
    })

    it('resetRefreshState bỏ con trỏ in-flight', async () => {
      let resolveFirst: (v: unknown) => void = () => undefined
      postSpy.mockImplementationOnce(
        () => new Promise((res) => (resolveFirst = res)),
      )
      const first = refreshSession()
      resetRefreshState()
      postSpy.mockResolvedValueOnce(okResponse())
      await refreshSession()
      expect(postSpy).toHaveBeenCalledTimes(2)
      resolveFirst(okResponse())
      await first
    })
  })
})
