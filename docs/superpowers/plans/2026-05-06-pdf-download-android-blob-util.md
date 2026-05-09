# PDF Download Android — react-native-blob-util

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Android SAF folder picker (requires user interaction) with `react-native-blob-util` MediaStore write — saves PDF directly to the device's Downloads folder with zero dialogs, matching the standard Vietnamese market app behavior (Shopee, banking apps).

**Architecture:** Install `react-native-blob-util`, which exposes `MediaCollection.copyToMediaStore` — this writes to the Android shared Downloads folder via the MediaStore API (no permission dialog on Android 10+ / API 29+). On iOS the existing `expo-sharing` share sheet is kept unchanged. The implementation writes the base64 PDF to a temp cache file first, then copies it to MediaStore, then cleans up the temp file.

**Tech Stack:** `react-native-blob-util`, `expo-file-system/legacy` (iOS only), `expo-sharing` (iOS only), `expo` managed workflow.

---

### Task 1: Install react-native-blob-util

**Files:**

- Modify: `package.json` (via install command)
- Modify: `app.json` (add plugin if required)

**Context:**
`react-native-blob-util` is a maintained fork of `rn-fetch-blob` with Expo support and full TypeScript types. It must be installed via `npx expo install` (not `npm install`) so Expo's version resolution picks the correct peer-compatible version. After install, rebuild the native binary is required — this plan documents the install steps; the actual device test requires `expo run:android`.

- [ ] **Step 1: Install the package**

```bash
cd /Users/phanquyetthang/mobile-movie-app
npx expo install react-native-blob-util
```

Expected output: package added to `package.json` under `dependencies`, no peer warnings about SDK version.

- [ ] **Step 2: Verify the package is listed**

```bash
grep "react-native-blob-util" package.json
```

Expected: a line like `"react-native-blob-util": "^0.21.x"` (exact version depends on resolution).

- [ ] **Step 3: Check if a config plugin is needed**

```bash
node -e "const pkg = require('./node_modules/react-native-blob-util/package.json'); console.log(pkg['expo-plugin'] || pkg['main'])"
```

If the output shows a plugin path, add it to `app.json` plugins array:

```json
{
  "expo": {
    "plugins": ["react-native-blob-util"]
  }
}
```

If there is no `expo-plugin` key the package auto-links without a config plugin — skip the `app.json` change.

- [ ] **Step 4: Verify typecheck still passes**

```bash
npm run typecheck
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore(deps): install react-native-blob-util for Android PDF save"
```

---

### Task 2: Update utils/download-pdf.ts

**Files:**

- Modify: `utils/download-pdf.ts`

**Context:**
The current Android path uses `LegacyFS.StorageAccessFramework.requestDirectoryPermissionsAsync` which shows a folder picker to the user. Replace it entirely with:

1. Write the base64 PDF to a temp file in `RNBlobUtil.fs.dirs.CacheDir`
2. Call `RNBlobUtil.MediaCollection.copyToMediaStore` to move it into the shared Downloads folder
3. Delete the temp file

The iOS path (write to `documentDirectory` + `Sharing.shareAsync`) is kept exactly as-is. The `SAF`-related import (`ANDROID_DOWNLOADS_URI` constant, `requestDirectoryPermissionsAsync`, `createFileAsync`) is removed since it is only used by the Android branch.

- [ ] **Step 1: Replace the entire file**

```typescript
import RNBlobUtil from 'react-native-blob-util'
import * as LegacyFS from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'

/**
 * Write an ArrayBuffer as a PDF and deliver it to the user.
 * Throws on failure — caller is responsible for error handling and toasts.
 *
 * iOS     — share sheet → "Save to Files"
 * Android — saved directly to Downloads via MediaStore (no dialog)
 */
export async function downloadAndSavePDF(
  data: ArrayBuffer,
  fileName: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('PDF download not supported on web')
  }

  if (data.byteLength === 0) {
    throw new Error('PDF data is empty')
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_')

  const uint8Array = new Uint8Array(data)
  const CHUNK_SIZE = 8192
  let binary = ''
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(
      null,
      uint8Array.subarray(i, i + CHUNK_SIZE) as unknown as number[],
    )
  }
  const base64 = btoa(binary)

  if (Platform.OS === 'android') {
    const tempPath = `${RNBlobUtil.fs.dirs.CacheDir}/${safeName}.pdf`
    await RNBlobUtil.fs.writeFile(tempPath, base64, 'base64')
    try {
      await RNBlobUtil.MediaCollection.copyToMediaStore(
        {
          name: `${safeName}.pdf`,
          parentFolder: '',
          mimeType: 'application/pdf',
        },
        'Download',
        tempPath,
      )
    } finally {
      await RNBlobUtil.fs.unlink(tempPath).catch(() => {})
    }
  } else {
    // iOS: write to document dir then share sheet → "Save to Files"
    if (!LegacyFS.documentDirectory) {
      throw new Error('documentDirectory is not available on this platform')
    }
    const fileUri = `${LegacyFS.documentDirectory}${safeName}.pdf`
    await LegacyFS.writeAsStringAsync(fileUri, base64, {
      encoding: LegacyFS.EncodingType.Base64,
    })
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      dialogTitle: safeName,
      UTI: 'com.adobe.pdf',
    })
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors in `utils/download-pdf.ts`. If `RNBlobUtil.MediaCollection` types are missing, check that the import resolves:

```bash
node -e "require('react-native-blob-util')"
```

- [ ] **Step 3: Verify lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add utils/download-pdf.ts
git commit -m "fix(payment): replace SAF picker with MediaStore for Android PDF save"
```

---

### Task 3: Rebuild and verify on device

**Files:**

- No code changes — native rebuild only

**Context:**
`react-native-blob-util` is a native module. It will not work with Expo Go. The dev binary must be rebuilt. After rebuild, trigger a PDF download and verify the file appears in the device's native Downloads folder (Files app on Samsung → "내 파일" → Downloads, or "Files" on stock Android).

- [ ] **Step 1: Rebuild the Android dev binary**

```bash
expo run:android
```

Expected: build succeeds, app launches on device/emulator.

- [ ] **Step 2: Trigger a PDF download**

Navigate to a paid order in the app, tap the download button, wait for the success toast.

Expected:

- Button shows `ActivityIndicator` while loading
- Success toast appears (`common.downloadSuccess`)
- **No folder picker dialog appears**

- [ ] **Step 3: Verify the file exists in Downloads**

On the device, open the native file manager:

- Samsung: "내 파일" → Downloads
- Stock Android: Files → Downloads

Expected: `TRENDCoffee-invoice-<slug>-<timestamp>.pdf` appears. Tapping it opens a PDF viewer.

- [ ] **Step 4: Verify error case**

With airplane mode on, tap the download button.

Expected: error toast appears (`toast.invoiceExportError`), no crash, button re-enables.
