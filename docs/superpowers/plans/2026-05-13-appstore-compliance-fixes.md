# App Store Compliance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 Apple App Store compliance issues that block or risk rejection — no logic changes, only config and file cleanup.

**Architecture:** Four targeted changes across native config files (`Info.plist`, `.entitlements`, `app.json`) and route file deletion. Each task is fully independent and can be committed separately. No JS/TS logic is touched.

**Tech Stack:** Expo bare workflow, iOS native config (plist/XML), Expo Router file-based routing.

---

## File Map

| File | Action | Why |
|------|--------|-----|
| `ios/TRENDCoffee/TRENDCoffee.entitlements` | Modify | `aps-environment` must be `production` for App Store |
| `app/(tabs)/profile/account-settings-placeholder.tsx` | Delete | Placeholder with "Trang rỗng để kiểm tra transition hãm phanh" |
| `app/(tabs)/profile/settings.tsx` | Delete | Placeholder with "Trang rỗng — test transition" |
| `ios/TRENDCoffee/Info.plist` | Modify | Remove NSMicrophoneUsageDescription, NSLocationAlways* variants, UIBackgroundModes fetch |
| `app.json` | Modify | Remove NSUserTrackingUsageDescription and "fetch" from UIBackgroundModes |

---

### Task 1: Fix APS environment — development → production

**Files:**
- Modify: `ios/TRENDCoffee/TRENDCoffee.entitlements`

**Context:** The entitlements file currently has `aps-environment = development`. App Store builds require `production`. With `development`, push notifications work on TestFlight internal but fail after public release. Apple's review tool checks this automatically.

- [ ] **Step 1: Edit entitlements file**

  Open `ios/TRENDCoffee/TRENDCoffee.entitlements`. The full file is 8 lines. Replace:

  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
    <dict>
      <key>aps-environment</key>
      <string>development</string>
    </dict>
  </plist>
  ```

  With:

  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
    <dict>
      <key>aps-environment</key>
      <string>production</string>
    </dict>
  </plist>
  ```

- [ ] **Step 2: Verify**

  Run:
  ```bash
  grep -A1 "aps-environment" ios/TRENDCoffee/TRENDCoffee.entitlements
  ```
  Expected output:
  ```
    <key>aps-environment</key>
    <string>production</string>
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add ios/TRENDCoffee/TRENDCoffee.entitlements
  git commit -m "fix(ios): set aps-environment to production for App Store build"
  ```

---

### Task 2: Delete orphaned placeholder screens

**Files:**
- Delete: `app/(tabs)/profile/account-settings-placeholder.tsx`
- Delete: `app/(tabs)/profile/settings.tsx`

**Context:** Both files are placeholder screens with visible placeholder text ("Trang rỗng để kiểm tra transition hãm phanh" / "Trang rỗng — test transition"). Neither is linked from any navigation in the app (confirmed via grep — zero callers). They exist as orphaned Expo Router routes, meaning Apple can potentially reach them via direct URL. Guideline 4.0 requires all accessible screens to have real functionality.

`orders-history-placeholder.tsx` in the same folder is safe — it just re-exports `app/profile/history` and is a real screen.

- [ ] **Step 1: Confirm zero callers for both files**

  Run:
  ```bash
  grep -rn "account-settings-placeholder\|profile/settings" app/ components/ 2>/dev/null
  ```
  Expected: no output. If any results appear, check the callers before deleting.

- [ ] **Step 2: Delete both files**

  ```bash
  rm app/\(tabs\)/profile/account-settings-placeholder.tsx
  rm app/\(tabs\)/profile/settings.tsx
  ```

- [ ] **Step 3: Verify deletion**

  ```bash
  ls app/\(tabs\)/profile/
  ```
  Expected: neither `account-settings-placeholder.tsx` nor `settings.tsx` appears.

- [ ] **Step 4: Run typecheck to confirm no broken imports**

  ```bash
  npm run typecheck
  ```
  Expected: exits 0. If errors appear, a file imports one of the deleted screens — fix that import.

- [ ] **Step 5: Commit**

  ```bash
  git add -A
  git commit -m "chore(profile): remove placeholder screens not linked in navigation"
  ```

---

### Task 3: Clean up Info.plist — remove unused/incorrect permission entries

**Files:**
- Modify: `ios/TRENDCoffee/Info.plist`

**Context:** Three issues in Info.plist:

1. **NSMicrophoneUsageDescription** (line 60–61): App never requests microphone access. No audio recording, no voice input, no `expo-av`, no `AVAudioSession`. Apple flags permission strings for features that don't exist. The string is a generic placeholder: `"Allow $(PRODUCT_NAME) to access your microphone"`.

2. **NSLocationAlwaysAndWhenInUseUsageDescription** (line 54–55) and **NSLocationAlwaysUsageDescription** (line 56–57): App only uses `locationWhenInUse` (declared correctly in `app.json` via `expo-location` plugin and properly described in `NSLocationWhenInUseUsageDescription`). The "always" variants are deprecated, have generic placeholder strings, and don't match actual usage. Apple will ask why the app needs always-on location.

All three entries should be removed. `NSLocationWhenInUseUsageDescription` (line 58–59, Vietnamese string) stays.

- [ ] **Step 1: Remove NSMicrophoneUsageDescription from Info.plist**

  In `ios/TRENDCoffee/Info.plist`, remove these two lines entirely:
  ```xml
  <key>NSMicrophoneUsageDescription</key>
  <string>Allow $(PRODUCT_NAME) to access your microphone</string>
  ```

- [ ] **Step 2: Remove NSLocationAlwaysAndWhenInUseUsageDescription from Info.plist**

  Remove these two lines:
  ```xml
  <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
  <string>Allow $(PRODUCT_NAME) to access your location</string>
  ```

- [ ] **Step 3: Remove NSLocationAlwaysUsageDescription from Info.plist**

  Remove these two lines:
  ```xml
  <key>NSLocationAlwaysUsageDescription</key>
  <string>Allow $(PRODUCT_NAME) to access your location</string>
  ```

- [ ] **Step 4: Verify remaining location key**

  Run:
  ```bash
  grep -A1 "NSLocation" ios/TRENDCoffee/Info.plist
  ```
  Expected output (only one key remains):
  ```
  <key>NSLocationWhenInUseUsageDescription</key>
  <string>Ứng dụng cần quyền truy cập vị trí để giao hàng đến đúng địa chỉ.</string>
  ```

- [ ] **Step 5: Verify microphone is gone**

  Run:
  ```bash
  grep "NSMicrophone" ios/TRENDCoffee/Info.plist
  ```
  Expected: no output.

- [ ] **Step 6: Commit**

  ```bash
  git add ios/TRENDCoffee/Info.plist
  git commit -m "fix(ios): remove unused microphone and location-always permission strings from Info.plist"
  ```

---

### Task 4: Clean up app.json — remove NSUserTrackingUsageDescription and fetch background mode

**Files:**
- Modify: `app.json`

**Context:** Two issues in `app.json` that get injected into `Info.plist` during EAS build (expo prebuild):

1. **NSUserTrackingUsageDescription** (line 19): Declares tracking usage but the app has zero AppTrackingTransparency (ATT) code — no `requestTrackingPermission`, no `expo-tracking-transparency` package, no tracking-related logic. The string even says "App does not collect tracking data", confirming ATT was never implemented. Declaring this without actually requesting ATT triggers an Apple review question about why it's needed. Remove it.

2. **UIBackgroundModes `"fetch"`** (line 21–24): No background fetch implementation exists — no `TaskManager`, no `BackgroundFetch`, no `defineTask`. Background fetch mode must only be declared if the app actually registers a background task. `"remote-notification"` should stay (used by Firebase Messaging).

Note: `Info.plist` currently has `"fetch"` hardcoded (line 75) and does NOT have `NSUserTrackingUsageDescription` (it was never prebuild-applied to the current Info.plist). Both files must be updated to stay in sync.

- [ ] **Step 1: Remove NSUserTrackingUsageDescription from app.json**

  In `app.json`, in the `expo.ios.infoPlist` object, remove this line:
  ```json
  "NSUserTrackingUsageDescription": "Ứng dụng không thu thập dữ liệu theo dõi quảng cáo.",
  ```

- [ ] **Step 2: Remove "fetch" from UIBackgroundModes in app.json**

  In `app.json`, change:
  ```json
  "UIBackgroundModes": [
    "remote-notification",
    "fetch"
  ]
  ```
  To:
  ```json
  "UIBackgroundModes": [
    "remote-notification"
  ]
  ```

- [ ] **Step 3: Remove "fetch" from UIBackgroundModes in Info.plist**

  In `ios/TRENDCoffee/Info.plist`, change:
  ```xml
  <key>UIBackgroundModes</key>
  <array>
    <string>remote-notification</string>
    <string>fetch</string>
  </array>
  ```
  To:
  ```xml
  <key>UIBackgroundModes</key>
  <array>
    <string>remote-notification</string>
  </array>
  ```

- [ ] **Step 4: Verify app.json**

  Run:
  ```bash
  grep -A3 "UIBackgroundModes" app.json
  grep "NSUserTrackingUsageDescription" app.json
  ```
  Expected: UIBackgroundModes shows only `remote-notification`; no output for NSUserTrackingUsageDescription.

- [ ] **Step 5: Verify Info.plist**

  Run:
  ```bash
  grep -A4 "UIBackgroundModes" ios/TRENDCoffee/Info.plist
  grep "fetch" ios/TRENDCoffee/Info.plist
  ```
  Expected: only `remote-notification` in UIBackgroundModes array; no `fetch` string.

- [ ] **Step 6: Commit**

  ```bash
  git add app.json ios/TRENDCoffee/Info.plist
  git commit -m "fix(ios): remove unused ATT permission string and background fetch mode"
  ```

---

## Post-Implementation Checklist

- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run lint` passes with 0 errors
- [ ] Profile tab navigates correctly — no broken routes from deleted placeholders
- [ ] Grep confirms no remaining navigation references to deleted screens
- [ ] `aps-environment` = `production` in entitlements
- [ ] Info.plist has exactly one location key (`NSLocationWhenInUseUsageDescription`) with Vietnamese string
- [ ] Info.plist has no `NSMicrophoneUsageDescription`
- [ ] UIBackgroundModes contains only `remote-notification` in both Info.plist and app.json
- [ ] `NSUserTrackingUsageDescription` absent from app.json
