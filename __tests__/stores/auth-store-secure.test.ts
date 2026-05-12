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
})
