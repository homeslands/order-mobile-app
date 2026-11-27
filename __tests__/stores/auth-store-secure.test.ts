jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  AFTER_FIRST_UNLOCK: 'AfterFirstUnlock',
}))

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    remove: jest.fn(),
  })),
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}))

import * as SecureStore from 'expo-secure-store'

import { recordServerTime, resetServerClock } from '@/lib/auth/server-clock'
import { useAuthStore } from '@/stores/auth.store'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      _hasHydrated: false,
      slug: undefined,
      token: undefined,
      refreshToken: undefined,
      expireTime: undefined,
      expireTimeRefreshToken: undefined,
      isRefreshing: false,
    })
  })

  afterEach(() => {
    resetServerClock()
  })

  it('setToken updates token in state', () => {
    useAuthStore.getState().setToken('abc123')
    expect(useAuthStore.getState().token).toBe('abc123')
  })

  it('setLogout clears all auth fields', () => {
    useAuthStore.setState({ token: 'abc', refreshToken: 'xyz', slug: 'user-1' })
    useAuthStore.getState().setLogout()
    const s = useAuthStore.getState()
    expect(s.token).toBeUndefined()
    expect(s.refreshToken).toBeUndefined()
    expect(s.slug).toBeUndefined()
    expect(s.isRefreshing).toBe(false)
  })

  it('isAuthenticated returns false when no token', () => {
    expect(useAuthStore.getState().isAuthenticated()).toBe(false)
  })

  it('isAuthenticated returns true with valid token and refresh token', () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    useAuthStore.setState({
      token: 'tok',
      refreshToken: 'ref',
      expireTime: future,
      expireTimeRefreshToken: future,
    })
    expect(useAuthStore.getState().isAuthenticated()).toBe(true)
  })

  const validState = () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    useAuthStore.setState({
      token: 'tok',
      refreshToken: 'ref',
      expireTime: future,
      expireTimeRefreshToken: future,
    })
  }

  it('setTokens ghi đủ 4 trường bằng đúng một lần SecureStore.setItemAsync', async () => {
    const setItem = SecureStore.setItemAsync as jest.Mock
    await new Promise((r) => setTimeout(r, 0))
    const before = setItem.mock.calls.length
    const future = new Date(Date.now() + 3600_000).toISOString()
    useAuthStore.getState().setTokens({
      accessToken: 'a',
      refreshToken: 'r',
      expireTime: future,
      expireTimeRefreshToken: future,
    })
    await new Promise((r) => setTimeout(r, 0))
    const s = useAuthStore.getState()
    expect(s.token).toBe('a')
    expect(s.refreshToken).toBe('r')
    expect(s.expireTime).toBe(future)
    expect(s.expireTimeRefreshToken).toBe(future)
    expect(setItem.mock.calls.length - before).toBe(1)
  })

  it('isAuthenticated vẫn true khi isRefreshing = true', () => {
    validState()
    useAuthStore.setState({ isRefreshing: true })
    expect(useAuthStore.getState().isAuthenticated()).toBe(true)
    expect(useAuthStore.getState().isTokenValid()).toBe(true)
  })

  it('isAuthenticated dùng giờ server', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()
    useAuthStore.setState({
      token: 'tok',
      refreshToken: 'ref',
      expireTime: fiveMinAgo,
      expireTimeRefreshToken: fiveMinAgo,
    })
    // server chậm 10 phút so với máy
    recordServerTime(new Date(Date.now() - 10 * 60_000).toISOString())
    expect(useAuthStore.getState().isAuthenticated()).toBe(true)
    // server nhanh 10 phút
    recordServerTime(new Date(Date.now() + 10 * 60_000).toISOString())
    expect(useAuthStore.getState().isAuthenticated()).toBe(false)
  })

  it('expireTimeRefreshToken không đọc được → isAuthenticated true', () => {
    useAuthStore.setState({
      token: 'tok',
      refreshToken: 'ref',
      expireTime: 'rác',
      expireTimeRefreshToken: 'rác',
    })
    expect(useAuthStore.getState().isAuthenticated()).toBe(true)
  })
})
