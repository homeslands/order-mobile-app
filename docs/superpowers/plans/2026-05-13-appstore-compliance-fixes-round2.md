# App Store Compliance Fixes — Round 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 remaining Apple App Store compliance issues — orphaned placeholder screens, missing Privacy Manifest Photos entry, and CFBundleVersion mismatch.

**Architecture:** Pure file deletion + targeted edits across native config and one route file. No logic changes.

**Tech Stack:** Expo Router file-based routing, iOS plist (XML), React Native.

---

## File Map

| File                                       | Action           | Why                                                          |
| ------------------------------------------ | ---------------- | ------------------------------------------------------------ |
| `app/(tabs)/profile/history.tsx`           | Delete           | Orphan placeholder, no nav link, accessible route            |
| `app/(tabs)/profile/info.tsx`              | Delete           | Orphan placeholder, no nav link, accessible route            |
| `app/profile/general-info-placeholder.tsx` | Delete           | Placeholder, only "navigated to" via broken path in edit.tsx |
| `app/(tabs)/profile/edit.tsx`              | Modify line ~492 | Fix broken navigation that pointed to deleted placeholder    |
| `ios/TRENDCoffee/PrivacyInfo.xcprivacy`    | Modify           | Add missing Photos/Photo Library data type                   |
| `ios/TRENDCoffee/Info.plist`               | Modify           | CFBundleVersion "1" → "50"                                   |

---

### Task 1: Delete orphaned placeholder screens + fix broken nav in edit.tsx

**Files:**

- Delete: `app/(tabs)/profile/history.tsx`
- Delete: `app/(tabs)/profile/info.tsx`
- Delete: `app/profile/general-info-placeholder.tsx`
- Modify: `app/(tabs)/profile/edit.tsx` (line ~492)

**Context:**

`app/(tabs)/profile/history.tsx` and `app/(tabs)/profile/info.tsx` are Expo Router routes accessible at `/(tabs)/profile/history` and `/(tabs)/profile/info`. Both show "Trang rỗng — test transition". No navigation in the app links to them — they are orphaned test placeholders. Delete them.

`app/profile/general-info-placeholder.tsx` is a placeholder at `/profile/general-info-placeholder`. In `app/(tabs)/profile/edit.tsx` around line 492, there is:

```tsx
if (!userInfo) {
  router.replace('/(tabs)/profile/general-info-placeholder' as never)
  return
}
```

This navigation is broken — the path `/(tabs)/profile/general-info-placeholder` doesn't exist (the file is at `/profile/general-info-placeholder`, not `/(tabs)/profile/general-info-placeholder`). The correct behavior when `userInfo` is null on the edit screen is to navigate back to the profile index `/(tabs)/profile`.

Fix `edit.tsx` to replace:

```tsx
router.replace('/(tabs)/profile/general-info-placeholder' as never)
```

With:

```tsx
router.replace('/(tabs)/profile')
```

- [ ] **Step 1: Confirm orphan status (zero callers)**

  ```bash
  grep -rn "/(tabs)/profile/history\b\|/(tabs)/profile/info\b\|general-info-placeholder" app/ components/ 2>/dev/null | grep -v node_modules
  ```

  Expected: only `edit.tsx` mentions `general-info-placeholder`, nothing links to `(tabs)/profile/history` or `(tabs)/profile/info`.

- [ ] **Step 2: Fix navigation in edit.tsx**

  Find the line in `app/(tabs)/profile/edit.tsx`:

  ```tsx
  router.replace('/(tabs)/profile/general-info-placeholder' as never)
  ```

  Replace with:

  ```tsx
  router.replace('/(tabs)/profile')
  ```

- [ ] **Step 3: Delete the three placeholder files**

  ```bash
  rm "app/(tabs)/profile/history.tsx"
  rm "app/(tabs)/profile/info.tsx"
  rm "app/profile/general-info-placeholder.tsx"
  ```

- [ ] **Step 4: Verify deletions**

  ```bash
  ls app/\(tabs\)/profile/
  ls app/profile/ | grep "general-info-placeholder"
  ```

  Neither deleted file should appear.

- [ ] **Step 5: Run typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: exits 0.

- [ ] **Step 6: Confirm no remaining placeholder text**

  ```bash
  grep -rn "Trang rỗng" app/ components/ 2>/dev/null | grep -v node_modules
  ```

  Expected: no output.

- [ ] **Step 7: Commit**

  ```bash
  git add app/\(tabs\)/profile/history.tsx app/\(tabs\)/profile/info.tsx app/profile/general-info-placeholder.tsx app/\(tabs\)/profile/edit.tsx
  git commit -m "chore(profile): remove remaining placeholder screens and fix broken nav in edit"
  ```

---

### Task 2: Add Photos data type to Privacy Manifest

**Files:**

- Modify: `ios/TRENDCoffee/PrivacyInfo.xcprivacy`

**Context:**

The app declares `NSPhotoLibraryUsageDescription` (select profile photo) and `NSPhotoLibraryAddUsageDescription` (save QR/invoice images) in `Info.plist`. Apple requires these data types to be declared in `PrivacyInfo.xcprivacy`'s `NSPrivacyCollectedDataTypes` array. Currently the manifest lists Name, PhoneNumber, EmailAddress, UserId, DeviceID, PreciseLocation, PurchaseHistory — but no Photos entry.

The Photos data type key in Apple's Privacy Manifest is `NSPrivacyCollectedDataTypePhotoLibrary`. The app reads and writes to the photo library, but does NOT track users with it, and it is linked to the user account (profile photo = linked, QR save = not linked to account but still declared conservatively as linked for safety).

Add this entry to the `NSPrivacyCollectedDataTypes` array in `PrivacyInfo.xcprivacy`:

```xml
<dict>
  <key>NSPrivacyCollectedDataType</key>
  <string>NSPrivacyCollectedDataTypePhotoLibrary</string>
  <key>NSPrivacyCollectedDataTypeLinked</key>
  <true/>
  <key>NSPrivacyCollectedDataTypePurposes</key>
  <array>
    <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
  </array>
  <key>NSPrivacyCollectedDataTypeTracking</key>
  <false/>
</dict>
```

Insert it as the last item before the closing `</array>` of `NSPrivacyCollectedDataTypes` (currently after the `NSPrivacyCollectedDataTypePurchaseHistory` block, before `</array>`).

The existing `NSPrivacyCollectedDataTypes` array currently ends at approximately line 130 with:

```xml
    </dict>
  </array>
  <key>NSPrivacyTracking</key>
```

Insert the new `<dict>...</dict>` block before that closing `</array>`.

- [ ] **Step 1: Read the current file**

  Read `ios/TRENDCoffee/PrivacyInfo.xcprivacy` to identify the exact insertion point (after the last `</dict>` before the `</array>` that closes `NSPrivacyCollectedDataTypes`).

- [ ] **Step 2: Insert the Photos entry**

  After the closing `</dict>` of the `NSPrivacyCollectedDataTypePurchaseHistory` block and before the closing `</array>` of `NSPrivacyCollectedDataTypes`, insert:

  ```xml
  		<dict>
  			<key>NSPrivacyCollectedDataType</key>
  			<string>NSPrivacyCollectedDataTypePhotoLibrary</string>
  			<key>NSPrivacyCollectedDataTypeLinked</key>
  			<true/>
  			<key>NSPrivacyCollectedDataTypePurposes</key>
  			<array>
  				<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
  			</array>
  			<key>NSPrivacyCollectedDataTypeTracking</key>
  			<false/>
  		</dict>
  ```

- [ ] **Step 3: Validate the plist**

  ```bash
  plutil -lint ios/TRENDCoffee/PrivacyInfo.xcprivacy
  ```

  Expected: `OK`

- [ ] **Step 4: Confirm the entry is present**

  ```bash
  grep "NSPrivacyCollectedDataTypePhotoLibrary" ios/TRENDCoffee/PrivacyInfo.xcprivacy
  ```

  Expected: one line with the key.

- [ ] **Step 5: Commit**

  ```bash
  git add ios/TRENDCoffee/PrivacyInfo.xcprivacy
  git commit -m "fix(ios): add photo library data type to privacy manifest"
  ```

---

### Task 3: Fix CFBundleVersion in Info.plist

**Files:**

- Modify: `ios/TRENDCoffee/Info.plist`

**Context:**

`app.json` has `buildNumber: "50"` (the iOS build number). The manually tracked `ios/TRENDCoffee/Info.plist` still has `CFBundleVersion = "1"` (the prebuild template default). Apple App Store Connect requires CFBundleVersion to be a positive integer that increases monotonically. While EAS build would override this during CI, the file in git should stay in sync to avoid confusion and potential issues with local builds.

Change line 36 of `Info.plist` from:

```xml
<key>CFBundleVersion</key>
<string>1</string>
```

To:

```xml
<key>CFBundleVersion</key>
<string>50</string>
```

- [ ] **Step 1: Edit CFBundleVersion**

  In `ios/TRENDCoffee/Info.plist`, replace:

  ```xml
  <key>CFBundleVersion</key>
  <string>1</string>
  ```

  With:

  ```xml
  <key>CFBundleVersion</key>
  <string>50</string>
  ```

- [ ] **Step 2: Verify**

  ```bash
  grep -A1 "CFBundleVersion" ios/TRENDCoffee/Info.plist
  ```

  Expected:

  ```
  <key>CFBundleVersion</key>
  <string>50</string>
  ```

- [ ] **Step 3: Validate plist**

  ```bash
  plutil -lint ios/TRENDCoffee/Info.plist
  ```

  Expected: `OK`

- [ ] **Step 4: Commit**

  ```bash
  git add ios/TRENDCoffee/Info.plist
  git commit -m "fix(ios): sync CFBundleVersion to build number 50"
  ```

---

## Post-Implementation Checklist

- [ ] `npm run typecheck` passes clean
- [ ] `npm run lint` passes clean
- [ ] No "Trang rỗng" text reachable in the app
- [ ] `plutil -lint ios/TRENDCoffee/PrivacyInfo.xcprivacy` → OK
- [ ] `plutil -lint ios/TRENDCoffee/Info.plist` → OK
- [ ] `grep "NSPrivacyCollectedDataTypePhotoLibrary" ios/TRENDCoffee/PrivacyInfo.xcprivacy` → found
- [ ] `grep -A1 "CFBundleVersion" ios/TRENDCoffee/Info.plist` → `<string>50</string>`
