const mockCleanup = jest.fn()
const mockRemoveQueries = jest.fn()
const mockClearAll = jest.fn()

jest.mock('@/lib/fcm-token-manager', () => ({
  cleanupTokenOnLogout: (...args: unknown[]) => mockCleanup(...args),
}))
jest.mock('@/lib/query-client', () => ({
  queryClient: { removeQueries: (...a: unknown[]) => mockRemoveQueries(...a) },
}))
jest.mock('@/stores/notification.store', () => ({
  useNotificationStore: { getState: () => ({ clearAll: mockClearAll }) },
}))

import { expireSession, useSessionExpiryStore } from '@/lib/auth/session-expiry'
import { useAuthStore, useUserStore } from '@/stores'

describe('expireSession', () => {
  let setLogoutSpy: jest.SpyInstance
  let removeUserInfoSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockCleanup.mockResolvedValue(undefined)
    useSessionExpiryStore.setState({ pending: false })
    useAuthStore.setState({ token: 'access', refreshToken: 'refresh' })
    useUserStore.setState({ deviceToken: 'device-1' } as never)
    setLogoutSpy = jest.spyOn(useAuthStore.getState(), 'setLogout')
    removeUserInfoSpy = jest.spyOn(useUserStore.getState(), 'removeUserInfo')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('3 lần gọi đồng thời chỉ dọn đúng một lần', async () => {
    const markSpy = jest.spyOn(useSessionExpiryStore.getState(), 'markExpired')
    await Promise.all([
      expireSession({ silent: false }),
      expireSession({ silent: false }),
      expireSession({ silent: false }),
    ])
    expect(setLogoutSpy).toHaveBeenCalledTimes(1)
    expect(mockCleanup).toHaveBeenCalledTimes(1)
    expect(mockClearAll).toHaveBeenCalledTimes(1)
    expect(markSpy).toHaveBeenCalledTimes(1)
  })

  it('xong rồi thì cho phép chạy lại', async () => {
    await expireSession({ silent: true })
    await expireSession({ silent: true })
    expect(mockCleanup).toHaveBeenCalledTimes(2)
  })

  it('silent: true không bật pending, có removeUserInfo', async () => {
    await expireSession({ silent: true })
    expect(useSessionExpiryStore.getState().pending).toBe(false)
    expect(removeUserInfoSpy).toHaveBeenCalledTimes(1)
  })

  it('silent: true removeUserInfo ngay sau setLogout, trước khi FCM cleanup xong', () => {
    let release: () => void = () => {}
    mockCleanup.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    const p = expireSession({ silent: true })
    try {
      expect(removeUserInfoSpy).toHaveBeenCalledTimes(1)
      expect(setLogoutSpy.mock.invocationCallOrder[0]).toBeLessThan(
        removeUserInfoSpy.mock.invocationCallOrder[0],
      )
      expect(mockClearAll).not.toHaveBeenCalled()
    } finally {
      // Luôn nhả cleanup để inflight không dính sang test sau
      release()
    }
    return p
  })

  it('silent: false bật pending, không removeUserInfo', async () => {
    await expireSession({ silent: false })
    expect(useSessionExpiryStore.getState().pending).toBe(true)
    expect(removeUserInfoSpy).not.toHaveBeenCalled()
  })

  it('pending bật trước khi FCM cleanup xong', async () => {
    let release: () => void = () => {}
    mockCleanup.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    const p = expireSession({ silent: false })
    await new Promise((r) => setImmediate(r))
    expect(mockCleanup).toHaveBeenCalled()
    expect(useSessionExpiryStore.getState().pending).toBe(true)
    release()
    await p
  })

  it('lấy deviceToken trước khi xoá bất kỳ thứ gì', async () => {
    await expireSession({ silent: true })
    expect(mockCleanup).toHaveBeenCalledWith('device-1')
  })

  it('setLogout chạy đồng bộ, trước await đầu tiên', () => {
    const p = expireSession({ silent: true })
    expect(useAuthStore.getState().token).toBeUndefined()
    return p
  })
})
