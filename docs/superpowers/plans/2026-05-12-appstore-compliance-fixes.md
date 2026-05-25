# App Store Compliance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues identified in Apple App Store review audit to prevent rejection on next submission.

**Architecture:** Four independent fix tasks (Tasks 1–4 are code changes), plus two manual App Store Connect steps documented at the end. Tasks 1–3 are non-breaking; Task 4 migrates auth token storage from MMKV to iOS Keychain via `expo-secure-store` — users are silently logged out once on upgrade (acceptable security trade-off).

**Tech Stack:** Expo 54, `expo-secure-store` (new dependency), `react-native-mmkv` (kept for non-auth storage), Zustand persist middleware, XML (PrivacyInfo.xcprivacy).

---

## Files to create / modify

| File                                    | Change                                                  |
| --------------------------------------- | ------------------------------------------------------- |
| `app.json`                              | Add `buildNumber` to `ios` section                      |
| `ios/TRENDCoffee/PrivacyInfo.xcprivacy` | Fill `NSPrivacyCollectedDataTypes`                      |
| `utils/storage.ts`                      | Add `createSecureStorage()` export                      |
| `stores/auth.store.ts`                  | Switch persist storage to SecureStore, add `partialize` |

---

## Task 1: Add buildNumber to app.json

**Files:**

- Modify: `app.json` (ios section)

- [ ] **Step 1: Open app.json and locate the ios section**

Current state of `app.json` ios block (line ~11):

```json
"ios": {
  "googleServicesFile": "./GoogleService-Info.plist",
  "supportsTablet": false,
  "infoPlist": { ... },
  "bundleIdentifier": "com.trendcoffee.order",
  "config": { ... }
}
```

- [ ] **Step 2: Add buildNumber field**

Add `"buildNumber": "50"` to the `ios` section. The value `"50"` matches the current `versionCode` (Android) so both platforms stay in sync.

```json
"ios": {
  "googleServicesFile": "./GoogleService-Info.plist",
  "supportsTablet": false,
  "buildNumber": "50",
  "infoPlist": {
    "NSCameraUsageDescription": "Cho phép ứng dụng sử dụng camera để chụp ảnh đại diện.",
    "NSPhotoLibraryUsageDescription": "Cho phép ứng dụng truy cập thư viện ảnh để chọn ảnh đại diện.",
    "NSPhotoLibraryAddUsageDescription": "Cho phép ứng dụng lưu ảnh hoá đơn và mã QR thanh toán vào thư viện ảnh.",
    "NSUserTrackingUsageDescription": "Ứng dụng không thu thập dữ liệu theo dõi quảng cáo.",
    "ITSAppUsesNonExemptEncryption": false,
    "UIBackgroundModes": ["remote-notification", "fetch"]
  },
  "bundleIdentifier": "com.trendcoffee.order",
  "config": {
    "googleMapsApiKey": "GOOGLE_MAPS_IOS_API_KEY_PLACEHOLDER"
  }
}
```

> **Note:** `buildNumber` must be incremented on every App Store upload. When the next release bumps `versionCode` on Android, bump this too. The value is a string in `app.json` but treated as an integer by Apple.

- [ ] **Step 3: Verify typecheck passes**

```bash
npm run check
```

Expected: `0 errors`

- [ ] **Step 4: Commit**

```bash
git add app.json
git commit -m "chore(ios): add buildNumber to app.json for App Store upload"
```

---

## Task 2: Fill NSPrivacyCollectedDataTypes in PrivacyInfo.xcprivacy

**Files:**

- Modify: `ios/TRENDCoffee/PrivacyInfo.xcprivacy`

This file declares what personal data the **app** (not just SDKs) collects. Currently `NSPrivacyCollectedDataTypes` is an empty array — that contradicts the fact that the app collects name, phone number, location, and purchase history.

- [ ] **Step 1: Understand the data the app actually collects**

From code audit:

- **Name** (firstName, lastName) — collected at registration, stored on server
- **Phone number** — used as login identifier
- **User ID** (server-side slug) — stored in auth store
- **Precise location** — collected optionally for delivery address autofill
- **Purchase history** — order history visible in profile

- [ ] **Step 2: Replace the PrivacyInfo.xcprivacy content**

Replace the entire file at `ios/TRENDCoffee/PrivacyInfo.xcprivacy`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>C617.1</string>
        <string>0A2A.1</string>
        <string>3B52.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
        <string>1C8F.1</string>
        <string>C56D.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategorySystemBootTime</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>35F9.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryDiskSpace</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>E174.1</string>
        <string>85F4.1</string>
      </array>
    </dict>
  </array>

  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <!-- User name: collected at registration for account display -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeName</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <!-- Phone number: used as login identifier -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypePhoneNumber</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <!-- User ID: server-assigned slug stored locally for API calls -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeUserId</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <!-- Precise location: collected optionally for delivery address autofill -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypePreciseLocation</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <!-- Purchase history: order history stored on server, displayed in profile -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypePurchaseHistory</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
  </array>

  <key>NSPrivacyTracking</key>
  <false/>
</dict>
</plist>
```

- [ ] **Step 3: Verify XML is valid**

```bash
plutil -lint ios/TRENDCoffee/PrivacyInfo.xcprivacy
```

Expected: `ios/TRENDCoffee/PrivacyInfo.xcprivacy: OK`

- [ ] **Step 4: Commit**

```bash
git add ios/TRENDCoffee/PrivacyInfo.xcprivacy
git commit -m "chore(ios): declare collected data types in PrivacyInfo.xcprivacy"
```

---

## Task 3: Add createSecureStorage() to utils/storage.ts

**Files:**

- Modify: `utils/storage.ts`

This task adds the `createSecureStorage()` function that wraps `expo-secure-store`. Task 4 wires it into the auth store. Separating them makes each testable independently.

- [ ] **Step 1: Install expo-secure-store**

```bash
npx expo install expo-secure-store
```

Expected: package added to `package.json`, `package-lock.json` updated.

- [ ] **Step 2: Write the failing test**

Create `__tests__/utils/secure-storage.test.ts`:

```ts
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
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
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('auth-storage')
    expect(result).toBe('{"token":"abc"}')
  })

  it('setItem delegates to SecureStore.setItemAsync', async () => {
    const storage = createSecureStorage()
    await storage.setItem('auth-storage', '{"token":"abc"}')
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth-storage',
      '{"token":"abc"}',
    )
  })

  it('removeItem delegates to SecureStore.deleteItemAsync', async () => {
    const storage = createSecureStorage()
    await storage.removeItem('auth-storage')
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth-storage')
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
```

- [ ] **Step 3: Run to verify it fails**

```bash
npx jest __tests__/utils/secure-storage.test.ts --no-coverage
```

Expected: FAIL — `createSecureStorage is not a function` or similar import error.

- [ ] **Step 4: Add createSecureStorage() to utils/storage.ts**

Add the following import at the top of `utils/storage.ts` (after existing imports):

```ts
import * as SecureStore from 'expo-secure-store'
```

Add the following function to `utils/storage.ts` (after `createSafeStorage`):

```ts
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
        return await SecureStore.getItemAsync(name)
      } catch {
        return null
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        await SecureStore.setItemAsync(name, value)
      } catch {
        // If SecureStore fails (e.g. device not enrolled), silently skip.
        // User will be unauthenticated on next launch — acceptable over a crash.
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        await SecureStore.deleteItemAsync(name)
      } catch {
        // no-op
      }
    },
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest __tests__/utils/secure-storage.test.ts --no-coverage
```

Expected: PASS, 4 tests passing.

- [ ] **Step 6: Run full typecheck**

```bash
npm run check
```

Expected: `0 errors`

- [ ] **Step 7: Commit**

```bash
git add utils/storage.ts __tests__/utils/secure-storage.test.ts
git commit -m "feat(security): add createSecureStorage() backed by iOS Keychain"
```

---

## Task 4: Migrate auth store to SecureStore

**Files:**

- Modify: `stores/auth.store.ts`

The auth store currently persists all state (including `token`, `refreshToken`) to MMKV via `createSafeStorage()`. This task switches it to `createSecureStorage()` and adds `partialize` to exclude the transient `isRefreshing` field from persistence.

**Side effect:** On first launch after upgrade, SecureStore will have no `auth-storage` entry — user will be logged out once. This is acceptable: better than tokens accessible in plaintext on a jailbroken device.

Old MMKV data under key `auth-storage` is NOT automatically deleted. It becomes orphaned (no code reads it). If you want to actively clear it, add a one-time migration (optional, not included here — not worth the complexity).

- [ ] **Step 1: Write the failing test**

Create `__tests__/stores/auth-store-secure.test.ts`:

```ts
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
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

import { useAuthStore } from '@/stores/auth.store'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx jest __tests__/stores/auth-store-secure.test.ts --no-coverage
```

Expected: FAIL (module resolution or import errors — that's fine).

- [ ] **Step 3: Update auth.store.ts to use SecureStore**

Full updated `stores/auth.store.ts`:

```ts
import { AuthState, IAuthStore } from '@/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { createSecureStorage } from '@/utils/storage'

export const useAuthStore = create<IAuthStore>()(
  persist(
    (set, get) => ({
      slug: undefined,
      token: undefined,
      refreshToken: undefined,
      expireTime: undefined,
      expireTimeRefreshToken: undefined,
      isRefreshing: false,
      isAuthenticated: () => {
        const { token, expireTime, refreshToken, expireTimeRefreshToken } =
          get()

        if (!token || !expireTime || !refreshToken || !expireTimeRefreshToken)
          return false

        const now = new Date()
        const tokenExpiresAt = new Date(expireTime)
        const refreshExpiresAt = new Date(expireTimeRefreshToken)

        if (now.valueOf() > refreshExpiresAt.valueOf()) {
          return false
        }

        if (now.valueOf() < tokenExpiresAt.valueOf()) {
          return true
        }

        return !get().isRefreshing
      },

      isTokenValid: () => {
        const { token, expireTime, refreshToken, expireTimeRefreshToken } =
          get()

        if (!token || !expireTime || !refreshToken || !expireTimeRefreshToken) {
          return false
        }

        const now = new Date()
        const tokenExpiresAt = new Date(expireTime)
        const refreshExpiresAt = new Date(expireTimeRefreshToken)

        if (now.valueOf() > refreshExpiresAt.valueOf()) {
          return false
        }

        if (now.valueOf() < tokenExpiresAt.valueOf()) {
          return true
        }

        return true
      },

      needsUserInfo: () => {
        return false
      },

      getAuthState: () => {
        const { isRefreshing } = get()

        if (isRefreshing) {
          return AuthState.REFRESHING
        }

        if (!get().isTokenValid()) {
          return AuthState.UNAUTHENTICATED
        }

        return AuthState.AUTHENTICATED
      },
      setSlug: (slug: string) => set({ slug }),
      setToken: (token: string) => set({ token }),
      setRefreshToken: (refreshToken: string) => set({ refreshToken }),
      setExpireTime: (expireTime: string) => set({ expireTime }),
      setExpireTimeRefreshToken: (expireTimeRefreshToken) =>
        set({ expireTimeRefreshToken }),
      setIsRefreshing: (isRefreshing: boolean) => set({ isRefreshing }),
      setLogout: () =>
        set({
          token: undefined,
          expireTime: undefined,
          refreshToken: undefined,
          expireTimeRefreshToken: undefined,
          slug: undefined,
          isRefreshing: false,
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => createSecureStorage()),
      // isRefreshing is transient runtime state — never persist it
      partialize: (state) => ({
        slug: state.slug,
        token: state.token,
        refreshToken: state.refreshToken,
        expireTime: state.expireTime,
        expireTimeRefreshToken: state.expireTimeRefreshToken,
      }),
    },
  ),
)
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest __tests__/stores/auth-store-secure.test.ts --no-coverage
```

Expected: PASS, 5 tests passing.

- [ ] **Step 5: Run full check**

```bash
npm run check
```

Expected: `0 errors`

- [ ] **Step 6: Run all tests to verify no regressions**

```bash
npx jest --no-coverage
```

Expected: all previously passing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add stores/auth.store.ts __tests__/stores/auth-store-secure.test.ts
git commit -m "feat(security): store auth tokens in iOS Keychain via expo-secure-store"
```

---

## Manual Step A: Add test account in App Store Connect

**This is not a code change.** Do this before submitting for review.

1. Open App Store Connect → your app → version being submitted
2. Go to **App Review Information**
3. Under **Sign-In Required**, toggle ON
4. Fill in:
   - **Username:** `[phone number của tài khoản test]`
   - **Password:** `[password của tài khoản test]`
5. Under **Notes**, add:

```
This is a food & beverage ordering app for TREND Coffee & Tea.
Login uses Vietnamese phone number format (e.g. 0901234567) + password.

Test account:
Phone: 0901234567
Password: Test@12345

The app requires an active server connection. Backend is hosted at [your API URL].

Gift cards (Thẻ quà tặng): Physical goods/services redeemable at TREND Coffee & Tea
physical stores. Not used for in-app digital content — exempt from IAP per
App Store Review Guideline 3.1.1 (physical goods and services).
```

> This note also covers the gift card IAP exemption (Manual Step B).

---

## Manual Step B: Fill App Privacy in App Store Connect

**This is not a code change.** Must match `PrivacyInfo.xcprivacy` from Task 2.

1. App Store Connect → your app → **App Privacy**
2. Click **Edit** → declare the following data types:

| Data Type        | Linked to Identity | Used for Tracking | Purpose           |
| ---------------- | ------------------ | ----------------- | ----------------- |
| Name             | Yes                | No                | App Functionality |
| Phone Number     | Yes                | No                | App Functionality |
| User ID          | Yes                | No                | App Functionality |
| Precise Location | No                 | No                | App Functionality |
| Purchase History | Yes                | No                | App Functionality |

3. Save and confirm.

> If App Privacy was already filled with different data, reconcile it to match this list exactly. Mismatch between App Store Connect and `PrivacyInfo.xcprivacy` is a rejection reason.

---

## Verification Checklist

After all tasks are done, verify before submitting:

- [ ] `npm run check` passes with 0 errors
- [ ] `npx jest --no-coverage` passes all tests
- [ ] `plutil -lint ios/TRENDCoffee/PrivacyInfo.xcprivacy` returns OK
- [ ] `app.json` has `"buildNumber"` in the `ios` section
- [ ] `expo-secure-store` appears in `package.json` dependencies
- [ ] App Store Connect test account filled in
- [ ] App Store Connect App Privacy matches Task 2 data types
- [ ] Gift card exemption note in App Review Notes
