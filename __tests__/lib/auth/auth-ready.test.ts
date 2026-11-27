const mockExpireSession = jest.fn()
const mockSetLogout = jest.fn()
const mockServerNow = jest.fn()
const mockUnsubscribe = jest.fn()
let mockHydrated = false
let mockFinishCb: (() => void) | null = null
let mockState: Record<string, unknown> = {}

jest.mock('@/lib/auth/session-expiry', () => ({
  expireSession: (...a: unknown[]) => mockExpireSession(...a),
}))
jest.mock('@/lib/auth/server-clock', () => ({
  serverNow: () => mockServerNow(),
}))
jest.mock('@/stores/auth.store', () => ({
  useAuthStore: {
    getState: () => mockState,
    persist: {
      hasHydrated: () => mockHydrated,
      onFinishHydration: (cb: () => void) => {
        mockFinishCb = cb
        return mockUnsubscribe
      },
    },
  },
}))

const NOW = Date.parse('2026-01-10T00:00:00Z')
const AFTER_EXPIRY = Date.parse('2026-03-01T00:00:00Z')

type AuthReady = typeof import('@/lib/auth/auth-ready')

function load(): AuthReady {
  let mod!: AuthReady
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/lib/auth/auth-ready') as AuthReady
  })
  return mod
}

async function settle(p: Promise<void>): Promise<boolean> {
  let done = false
  void p.then(() => {
    done = true
  })
  for (let i = 0; i < 5; i++) await Promise.resolve()
  return done
}

describe('waitUntilAuthReady', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockHydrated = false
    mockFinishCb = null
    mockServerNow.mockReturnValue(NOW)
    mockExpireSession.mockImplementation(() => {
      mockSetLogout()
      return Promise.resolve()
    })
    mockState = {
      token: 'a',
      refreshToken: 'r',
      expireTimeRefreshToken: '2026-02-01T00:00:00Z',
    }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('chưa hydrate thì chưa resolve; hydrate xong thì resolve', async () => {
    const { waitUntilAuthReady } = load()
    const p = waitUntilAuthReady()
    expect(await settle(p)).toBe(false)
    mockFinishCb?.()
    expect(await settle(p)).toBe(true)
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('đã hydrate sẵn thì resolve ngay', async () => {
    mockHydrated = true
    const { waitUntilAuthReady } = load()
    expect(await settle(waitUntilAuthReady())).toBe(true)
  })

  it('không bao giờ hydrate thì resolve sau 3000ms', async () => {
    const { waitUntilAuthReady, AUTH_HYDRATION_TIMEOUT_MS } = load()
    expect(AUTH_HYDRATION_TIMEOUT_MS).toBe(3000)
    const p = waitUntilAuthReady()
    jest.advanceTimersByTime(AUTH_HYDRATION_TIMEOUT_MS - 1)
    expect(await settle(p)).toBe(false)
    jest.advanceTimersByTime(1)
    expect(await settle(p)).toBe(true)
  })

  it('refresh token đã hết hạn: dọn lặng lẽ một lần, setLogout chạy trước khi resolve', async () => {
    mockServerNow.mockReturnValue(AFTER_EXPIRY)
    const { waitUntilAuthReady } = load()
    const p = waitUntilAuthReady()
    mockFinishCb?.()
    let logoutBeforeResolve = false
    void p.then(() => {
      logoutBeforeResolve = mockSetLogout.mock.calls.length === 1
    })
    await settle(p)
    expect(mockExpireSession).toHaveBeenCalledTimes(1)
    expect(mockExpireSession).toHaveBeenCalledWith({ silent: true })
    expect(logoutBeforeResolve).toBe(true)
  })

  it('expireTimeRefreshToken rác thì không dọn', async () => {
    mockHydrated = true
    mockServerNow.mockReturnValue(AFTER_EXPIRY)
    mockState = { ...mockState, expireTimeRefreshToken: 'rác' }
    const { waitUntilAuthReady } = load()
    await settle(waitUntilAuthReady())
    expect(mockExpireSession).not.toHaveBeenCalled()
  })

  it('refresh token còn hạn thì không dọn', async () => {
    mockHydrated = true
    const { waitUntilAuthReady } = load()
    await settle(waitUntilAuthReady())
    expect(mockExpireSession).not.toHaveBeenCalled()
  })

  it('không có refresh token thì không dọn', async () => {
    mockHydrated = true
    mockServerNow.mockReturnValue(AFTER_EXPIRY)
    mockState = { ...mockState, refreshToken: null }
    const { waitUntilAuthReady } = load()
    await settle(waitUntilAuthReady())
    expect(mockExpireSession).not.toHaveBeenCalled()
  })

  it('gọi nhiều lần chỉ dọn tối đa một lần', async () => {
    mockHydrated = true
    mockServerNow.mockReturnValue(AFTER_EXPIRY)
    const { waitUntilAuthReady } = load()
    await Promise.all([
      waitUntilAuthReady(),
      waitUntilAuthReady(),
      waitUntilAuthReady(),
    ])
    expect(mockExpireSession).toHaveBeenCalledTimes(1)
  })
})
