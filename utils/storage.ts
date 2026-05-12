import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import type { StateStorage } from 'zustand/middleware'

const noopStorage: StateStorage = {
  getItem: (): Promise<string | null> => Promise.resolve(null),
  setItem: (): Promise<void> => Promise.resolve(),
  removeItem: (): Promise<void> => Promise.resolve(),
}

type MMKVStorage = {
  getString: (k: string) => string | undefined
  set: (k: string, v: string) => void
  remove: (k: string) => boolean
}

/** MMKV instance — lazy init, không load trên web/SSR */
let mmkvInstance: MMKVStorage | null = null

export function getMMKV(): MMKVStorage | null {
  if (typeof window === 'undefined') return null
  if (Platform.OS === 'web') return null
  try {
    if (!mmkvInstance) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Dynamic require: MMKV không tồn tại trên web
      const { createMMKV } = require('react-native-mmkv') as {
        createMMKV: (config: { id: string }) => MMKVStorage
      }
      mmkvInstance = createMMKV({ id: 'app-storage' })
    }
    return mmkvInstance
  } catch {
    return null
  }
}

/**
 * Creates a safe storage adapter for Zustand persist middleware.
 * Native: MMKV (JSI, ~30x faster). Web/SSR: AsyncStorage hoặc no-op.
 */
export const createSafeStorage = (): StateStorage => {
  if (typeof window === 'undefined') {
    return noopStorage
  }

  const mmkv = getMMKV()
  if (mmkv) {
    return {
      getItem: (name: string) => mmkv.getString(name) ?? null,
      setItem: (name: string, value: string) => {
        mmkv.set(name, value)
      },
      removeItem: (name: string) => {
        mmkv.remove(name)
      },
    }
  }

  return AsyncStorage
}

/**
 * Secure storage adapter for Zustand persist — uses iOS Keychain / Android Keystore
 * via expo-secure-store. Falls back to noopStorage on web.
 *
 * Use this only for sensitive data (auth tokens). Non-sensitive state should
 * continue using createSafeStorage() (MMKV).
 *
 * Size limit: expo-secure-store caps each value at 2048 bytes. Auth store JSON
 * (tokens + timestamps) is ~1200–1800 bytes for typical JWTs — within limit.
 */
export const createSecureStorage = (): StateStorage => {
  if (Platform.OS === 'web') return noopStorage
  return {
    getItem: async (name: string): Promise<string | null> => {
      try {
        return await SecureStore.getItemAsync(name, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK })
      } catch {
        return null
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        await SecureStore.setItemAsync(name, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK })
      } catch {
        // If SecureStore fails (e.g. device not enrolled), silently skip.
        // User will be unauthenticated on next launch — acceptable over a crash.
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        await SecureStore.deleteItemAsync(name, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK })
      } catch {
        // no-op
      }
    },
  }
}

/**
 * Async storage helper — dùng MMKV trên native (sync, wrap thành Promise), AsyncStorage trên web.
 * API async để tương thích với call site (utils/cart.ts setupAutoClearCart).
 */
export const asyncStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const mmkv = getMMKV()
      if (mmkv) {
        return mmkv.getString(key) ?? null
      }
      return await AsyncStorage.getItem(key)
    } catch {
      return null
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      const mmkv = getMMKV()
      if (mmkv) {
        mmkv.set(key, value)
        return
      }
      await AsyncStorage.setItem(key, value)
    } catch {
      throw new Error(`Error setting item ${key} to storage`)
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      const mmkv = getMMKV()
      if (mmkv) {
        mmkv.remove(key)
        return
      }
      await AsyncStorage.removeItem(key)
    } catch {
      throw new Error(`Error removing item ${key} from storage`)
    }
  },
}

/** Sync read — dùng cho cache cần đọc ngay khi mount (T0: cart displayItems). */
export function getSyncItem(key: string): string | null {
  try {
    const mmkv = getMMKV()
    return mmkv ? (mmkv.getString(key) ?? null) : null
  } catch {
    return null
  }
}

/** Sync write — MMKV native. */
export function setSyncItem(key: string, value: string): void {
  try {
    const mmkv = getMMKV()
    if (mmkv) mmkv.set(key, value)
  } catch {
    // no-op — cache fail không block app
  }
}
