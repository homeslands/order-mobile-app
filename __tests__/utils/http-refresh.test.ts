import { AxiosError, InternalAxiosRequestConfig } from 'axios'

import { recordServerTime } from '@/lib/auth/server-clock'
import type { RefreshResult } from '@/types/auth.type'
import { configureHttpAuth, http, SessionRefreshError } from '@/utils/http'

jest.mock('@/lib/auth/server-clock', () => ({
  recordServerTime: jest.fn(),
}))

type Sent = { url?: string; authorization?: string }

let sent: Sent[]
let token: string | undefined
let expired: boolean
let refreshImpl: () => Promise<RefreshResult>
let refreshCalls: number
let inflight: Promise<RefreshResult> | null
let waitUntilReady: jest.Mock<Promise<void>, []>
let resetRefresh: jest.Mock
let respond: (config: InternalAxiosRequestConfig, count: number) => unknown

const fail401 = (config: InternalAxiosRequestConfig, data?: unknown) =>
  new AxiosError('401', 'ERR_BAD_REQUEST', config, null, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
    data,
  })

const tick = () => new Promise((r) => setTimeout(r, 20))

beforeEach(() => {
  sent = []
  token = 'OLD'
  expired = false
  refreshCalls = 0
  inflight = null
  refreshImpl = async () => {
    token = 'NEW'
    expired = false
    return { status: 'refreshed', accessToken: 'NEW' }
  }
  waitUntilReady = jest.fn(() => Promise.resolve())
  resetRefresh = jest.fn()
  respond = () => ({ data: { ok: true } })
  ;(recordServerTime as jest.Mock).mockClear()

  configureHttpAuth({
    getToken: () => token,
    isAccessTokenExpired: () => expired,
    // Giống refreshSession thật: single-flight
    refreshSession: () => {
      if (!inflight) {
        refreshCalls += 1
        inflight = refreshImpl().finally(() => {
          inflight = null
        })
      }
      return inflight
    },
    waitUntilReady,
    resetRefresh,
  })

  http.defaults.adapter = async (config) => {
    const header = config.headers?.Authorization as string | undefined
    sent.push({ url: config.url, authorization: header })
    const out = respond(config, sent.length)
    if (out instanceof Error) throw out
    return {
      data: (out as { data: unknown }).data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
})

describe('http interceptor', () => {
  it('token hết hạn + 3 request song song -> refresh 1 lần, cả 3 gửi Bearer NEW', async () => {
    expired = true
    await Promise.all([http.get('/a'), http.get('/b'), http.get('/c')])
    expect(refreshCalls).toBe(1)
    expect(sent.map((s) => s.authorization)).toEqual([
      'Bearer NEW',
      'Bearer NEW',
      'Bearer NEW',
    ])
  })

  it('refresh transient -> reject SessionRefreshError, không request nào tới adapter', async () => {
    expired = true
    refreshImpl = async () => ({ status: 'transient', error: new Error('x') })
    const err = await http.get('/a').catch((e) => e)
    expect(err).toBeInstanceOf(SessionRefreshError)
    expect(err.reason).toBe('transient')
    expect(sent).toHaveLength(0)
  })

  it('refresh invalid -> reject SessionRefreshError(invalid), không gửi lại', async () => {
    expired = true
    refreshImpl = async () => ({ status: 'invalid' })
    const err = await http.get('/a').catch((e) => e)
    expect(err).toBeInstanceOf(SessionRefreshError)
    expect(err.reason).toBe('invalid')
    expect(sent).toHaveLength(0)
    expect(refreshCalls).toBe(1)
  })

  it('refresh still-valid -> request đi bằng token hiện tại', async () => {
    expired = true
    refreshImpl = async () => ({ status: 'still-valid' })
    await http.get('/a')
    expect(sent[0].authorization).toBe('Bearer OLD')
  })

  it('401 với token cũ, store đã có token mới -> gửi lại ngay bằng token mới, không refresh', async () => {
    respond = (config, n) => {
      if (n === 1) {
        token = 'NEW'
        return fail401(config)
      }
      return { data: { ok: true } }
    }
    await http.get('/a')
    expect(refreshCalls).toBe(0)
    expect(sent.map((s) => s.authorization)).toEqual([
      'Bearer OLD',
      'Bearer NEW',
    ])
  })

  it('3 request song song cùng 401 bằng token cũ -> refresh 1 lần, mỗi request gửi lại đúng 1 lần', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    respond = (config) =>
      config.headers.Authorization === 'Bearer OLD'
        ? fail401(config)
        : { data: { ok: true } }
    refreshImpl = async () => {
      await gate
      token = 'NEW'
      return { status: 'refreshed', accessToken: 'NEW' }
    }
    const all = Promise.all([http.get('/a'), http.get('/b'), http.get('/c')])
    await tick()
    release()
    await all
    expect(refreshCalls).toBe(1)
    expect(sent.filter((s) => s.authorization === 'Bearer OLD')).toHaveLength(3)
    expect(sent.filter((s) => s.authorization === 'Bearer NEW')).toHaveLength(3)
  })

  it('401 hai lần liên tiếp -> adapter nhận đúng 2 lần, reject lỗi 401 gốc, không đăng xuất', async () => {
    respond = (config) => fail401(config)
    const err = await http.get('/a').catch((e) => e)
    expect(err.response.status).toBe(401)
    expect(sent).toHaveLength(2)
    expect(refreshCalls).toBe(1)
    expect(resetRefresh).not.toHaveBeenCalled()
  })

  it('401 mà refresh không thành -> reject lỗi 401 gốc, không gửi lại', async () => {
    respond = (config) => fail401(config)
    refreshImpl = async () => ({ status: 'invalid' })
    const err = await http.get('/a').catch((e) => e)
    expect(err.response.status).toBe(401)
    expect(sent).toHaveLength(1)
  })

  it.each([
    ['post', '/auth/login'],
    ['post', '/auth/register/initiate'],
  ])('401 từ %s %s -> không refresh, không gửi lại', async (method, url) => {
    respond = (config) => fail401(config)
    const err = await http.request({ method, url }).catch((e) => e)
    expect(err.response.status).toBe(401)
    expect(sent).toHaveLength(1)
    expect(refreshCalls).toBe(0)
  })

  it('request không gửi kèm token nhận 401 -> không refresh', async () => {
    token = undefined
    respond = (config) => fail401(config)
    const err = await http.get('/a').catch((e) => e)
    expect(err.response.status).toBe(401)
    expect(sent).toHaveLength(1)
    expect(sent[0].authorization).toBeUndefined()
    expect(refreshCalls).toBe(0)
  })

  it('POST /auth/login trong lúc refreshSession treo -> tới adapter ngay, không chờ waitUntilReady', async () => {
    waitUntilReady.mockImplementation(() => new Promise<void>(() => {}))
    refreshImpl = () => new Promise<RefreshResult>(() => {})
    expired = true
    await http.post('/auth/login', {})
    expect(sent).toHaveLength(1)
    expect(sent[0].authorization).toBeUndefined()
    expect(waitUntilReady).not.toHaveBeenCalled()
  })

  it('request thường chờ waitUntilReady rồi mới đọc token', async () => {
    token = undefined
    let release!: () => void
    waitUntilReady.mockImplementation(
      () =>
        new Promise<void>((r) => {
          release = () => {
            token = 'HYDRATED'
            r()
          }
        }),
    )
    const req = http.get('/a')
    await tick()
    expect(sent).toHaveLength(0)
    release()
    await req
    expect(sent[0].authorization).toBe('Bearer HYDRATED')
  })

  it('response có data.timestamp (thành công và lỗi) -> recordServerTime', async () => {
    respond = () => ({ data: { timestamp: 'T1' } })
    await http.get('/a')
    expect(recordServerTime).toHaveBeenLastCalledWith('T1')

    token = undefined
    respond = (config) => fail401(config, { timestamp: 'T2' })
    await http.get('/b').catch(() => undefined)
    expect(recordServerTime).toHaveBeenLastCalledWith('T2')
  })
})
