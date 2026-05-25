jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  AFTER_FIRST_UNLOCK: 'AfterFirstUnlock',
}))

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}))

import * as SecureStore from 'expo-secure-store'
import { createSecureStorage } from '@/utils/storage'

describe('createSecureStorage', () => {
  it('getItem delegates to SecureStore.getItemAsync', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
      '{"token":"abc"}',
    )
    const storage = createSecureStorage()
    const result = await storage.getItem('auth-storage')
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('auth-storage', {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    })
    expect(result).toBe('{"token":"abc"}')
  })

  it('setItem delegates to SecureStore.setItemAsync', async () => {
    const storage = createSecureStorage()
    await storage.setItem('auth-storage', '{"token":"abc"}')
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth-storage',
      '{"token":"abc"}',
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK },
    )
  })

  it('removeItem delegates to SecureStore.deleteItemAsync', async () => {
    const storage = createSecureStorage()
    await storage.removeItem('auth-storage')
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth-storage', {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    })
  })

  it('returns null when SecureStore throws', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error('keychain error'),
    )
    const storage = createSecureStorage()
    const result = await storage.getItem('auth-storage')
    expect(result).toBeNull()
  })
})
