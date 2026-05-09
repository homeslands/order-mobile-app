# QR Code Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to save QR codes (payment QR on `qr-generate` screen and member ID QR on profile sheet) directly to their Photos with one tap.

**Architecture:** `react-native-qrcode-svg`'s `getRef` callback gives access to the SVG ref — calling `.toDataURL(cb)` on it returns a base64 PNG, which is written to the device cache via `expo-file-system` and saved to Photos via `expo-media-library`. The existing stub `downloadQRCodeImage` in `utils/download-image.ts` is updated to accept the pre-captured base64 data (permission check logic reused as-is). A "Lưu QR" button is added to both screens.

**Tech Stack:** `react-native-qrcode-svg` (getRef + toDataURL), `expo-file-system` (File/Paths new API), `expo-media-library` (createAssetAsync), `react-native-svg` (Svg type), i18next

---

## File Structure

| File                                       | Change                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `utils/download-image.ts`                  | Update `downloadQRCodeImage(base64: string, fileName?)` — write base64 PNG to cache, save to Photos |
| `app/payment/qr-generate.tsx`              | Add `getRef` to `<QRCode>` in `ActiveQR`, add download button                                       |
| `components/profile/scan-sheet-portal.tsx` | Add `getRef` to `<QRCode>` in `QrContent`, add download button                                      |
| `i18n/vi/payment.json`                     | Add `qrGenerate.downloadButton`                                                                     |
| `i18n/vi/profile.json`                     | Add `qr.downloadButton`                                                                             |
| `__tests__/utils/download-qr.test.ts`      | Unit tests for `downloadQRCodeImage`                                                                |

---

### Task 1: Implement `downloadQRCodeImage` utility

**Files:**

- Modify: `utils/download-image.ts:249-276`
- Create: `__tests__/utils/download-qr.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/utils/download-qr.test.ts`:

```typescript
import * as MediaLibrary from 'expo-media-library'
import { File } from 'expo-file-system'

jest.mock('expo-media-library', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  createAssetAsync: jest.fn(),
}))

jest.mock('expo-file-system', () => {
  const mockWriter = {
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    abort: jest.fn().mockResolvedValue(undefined),
  }
  return {
    File: jest.fn().mockImplementation(() => ({
      writableStream: () => ({ getWriter: () => mockWriter }),
      toString: () => 'file:///cache/qr_test.png',
    })),
    Paths: { cache: 'file:///cache' },
  }
})

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}))

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}))

import { downloadQRCodeImage } from '@/utils/download-image'

const VALID_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('downloadQRCodeImage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns false and shows toast when permission denied', async () => {
    const { showToast } = await import('@/utils/toast')
    ;(MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    })
    ;(MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    })

    const result = await downloadQRCodeImage(VALID_BASE64, 'test_qr')

    expect(result).toBe(false)
    expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith('common.noPhotoLibraryPermission')
  })

  it('writes base64 PNG to cache and saves to media library when permitted', async () => {
    ;(MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    })
    ;(MediaLibrary.createAssetAsync as jest.Mock).mockResolvedValue({
      id: 'asset-1',
    })

    const result = await downloadQRCodeImage(VALID_BASE64, 'payment_qr')

    expect(File).toHaveBeenCalled()
    expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith(
      'file:///cache/qr_test.png',
    )
    expect(result).toBe(true)
  })

  it('returns false and shows error toast when write throws', async () => {
    const { showToast } = await import('@/utils/toast')
    ;(MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    })
    ;(MediaLibrary.createAssetAsync as jest.Mock).mockRejectedValue(
      new Error('disk full'),
    )

    const result = await downloadQRCodeImage(VALID_BASE64)

    expect(result).toBe(false)
    expect(showToast).toHaveBeenCalledWith('common.errorSavingQRCode')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/utils/download-qr.test.ts --no-coverage
```

Expected: FAIL — `downloadQRCodeImage` returns `false` with wrong toast (stub behaviour)

- [ ] **Step 3: Replace the stub in `utils/download-image.ts`**

Replace lines 244–276 (the `downloadQRCodeImage` function):

```typescript
/**
 * Save a QR code SVG capture to Photos.
 * Caller must capture the SVG ref via react-native-qrcode-svg's getRef +
 * toDataURL() before calling this — the base64PngData is the raw PNG bytes
 * returned by toDataURL (no data-URI prefix).
 */
export async function downloadQRCodeImage(
  base64PngData: string,
  fileName?: string,
): Promise<boolean> {
  try {
    const hasPermission = await checkMediaLibraryPermission()
    if (!hasPermission) {
      const granted = await requestMediaLibraryPermission()
      if (!granted) {
        showToast(i18n.t('common.noPhotoLibraryPermission', { ns: 'common' }))
        return false
      }
    }

    const finalFileName = fileName ?? `qr_${Date.now()}`
    const tempFile = new File(Paths.cache, `${finalFileName}.png`)

    const binaryString = atob(base64PngData)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const writer = tempFile.writableStream().getWriter()
    try {
      await writer.write(bytes)
      await writer.close()
    } catch (writeError) {
      await writer.abort()
      throw writeError
    }

    await MediaLibrary.createAssetAsync(String(tempFile))

    showToast(i18n.t('common.imageSavedSuccess', { ns: 'common' }))
    return true
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error downloading QR code:', error)
    showToast(i18n.t('common.errorSavingQRCode', { ns: 'common' }))
    return false
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/utils/download-qr.test.ts --no-coverage
```

Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add utils/download-image.ts __tests__/utils/download-qr.test.ts
git commit -m "feat(qr): implement downloadQRCodeImage with base64 PNG capture"
```

---

### Task 2: Add download button to Payment QR screen

**Files:**

- Modify: `app/payment/qr-generate.tsx`
- Modify: `i18n/vi/payment.json`

- [ ] **Step 1: Add i18n key to `i18n/vi/payment.json`**

Inside the `"qrGenerate"` object, add one line:

```json
"downloadButton": "Lưu QR vào ảnh"
```

Result section becomes:

```json
"qrGenerate": {
  "title": "Thanh toán bằng Xu",
  "generating": "Đang tạo QR...",
  "expiresIn": "Hết hạn sau",
  "retry": "Thử lại",
  "downloadButton": "Lưu QR vào ảnh",
  "step1": "Đưa màn hình QR cho nhân viên tại quầy",
  "step2": "Nhân viên quét mã QR trên máy POS",
  "step3": "Nhận thông báo xác nhận thanh toán thành công"
}
```

- [ ] **Step 2: Add `getRef` + download button to `ActiveQR` component in `app/payment/qr-generate.tsx`**

`ActiveQR` renders `<QRCode>`. Add:

1. Import `type Svg` from `react-native-svg`
2. Import `Download` icon from `lucide-react-native`
3. Import `downloadQRCodeImage` from `@/utils`
4. Add `svgRef` and `handleDownload` inside `ActiveQR`
5. Pass `getRef` to `<QRCode>` and render the button below the progress bar

Replace the `ActiveQR` component (lines 80–133):

```typescript
import { Download } from 'lucide-react-native'
import type { Svg } from 'react-native-svg'
import { downloadQRCodeImage } from '@/utils'
```

Add these 3 imports at the top of the file alongside the existing imports.

Replace the body of `ActiveQR`:

```typescript
const ActiveQR = memo(function ActiveQR({
  token,
  isRefreshing,
  countdown,
  isDark,
  primary,
}: {
  token: string
  isRefreshing: boolean
  countdown: number
  isDark: boolean
  primary: string
}) {
  const { t } = useTranslation('payment')
  const { mutedColor, cardBg } = useMemo(
    () => ({
      mutedColor: isDark ? colors.gray[400] : colors.gray[500],
      cardBg: isDark ? colors.gray[800] : colors.white.light,
    }),
    [isDark],
  )
  const countdownColor = useMemo(
    () => (countdown <= 10 ? colors.destructive.light : primary),
    [countdown, primary],
  )

  const qrOpacity = useSharedValue(1)

  useEffect(() => {
    if (isRefreshing) {
      qrOpacity.value = withTiming(0.35, { duration: QR_FADE_OUT_MS })
    } else {
      qrOpacity.value = withTiming(1, { duration: QR_FADE_IN_MS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefreshing])

  const qrAnimStyle = useAnimatedStyle(() => ({ opacity: qrOpacity.value }))
  const qrWrapStyle = useMemo(() => [s.qrImageWrap, qrAnimStyle], [qrAnimStyle])

  const svgRef = useRef<Svg | null>(null)
  const handleDownload = useCallback(() => {
    svgRef.current?.toDataURL((data) => {
      void downloadQRCodeImage(data, `payment_qr_${Date.now()}`)
    })
  }, [])

  return (
    <View style={[s.qrCard, { backgroundColor: cardBg }]}>
      <Animated.View style={qrWrapStyle}>
        <QRCode
          value={token}
          size={QR_SIZE}
          getRef={(ref) => { svgRef.current = ref }}
        />
      </Animated.View>

      <ProgressBar
        qrCode={token}
        primary={primary}
        isDark={isDark}
        ttlMs={QR_TTL_S * 1000}
      />

      <Text style={[s.countdownText, { color: mutedColor }]}>
        {t('qrGenerate.expiresIn')}{' '}
        <Text style={[s.countdownHighlight, { color: countdownColor }]}>
          {countdown}s
        </Text>
      </Text>

      <Pressable
        style={[s.downloadBtn, { borderColor: primary }]}
        onPress={handleDownload}
      >
        <Download size={14} color={primary} />
        <Text style={[s.downloadBtnText, { color: primary }]}>
          {t('qrGenerate.downloadButton')}
        </Text>
      </Pressable>
    </View>
  )
})
```

Add these styles to the `StyleSheet.create` at the bottom of the file:

```typescript
downloadBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  borderWidth: 1.5,
  borderRadius: 10,
  paddingHorizontal: 20,
  paddingVertical: 8,
},
downloadBtnText: {
  fontSize: 14,
  fontWeight: '600',
},
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/payment/qr-generate.tsx i18n/vi/payment.json
git commit -m "feat(qr): add download button to payment QR screen"
```

---

### Task 3: Add download button to Profile member QR sheet

**Files:**

- Modify: `components/profile/scan-sheet-portal.tsx`
- Modify: `i18n/vi/profile.json`

- [ ] **Step 1: Add i18n key to `i18n/vi/profile.json`**

Inside the `"qr"` object, add one line:

```json
"downloadButton": "Lưu QR vào ảnh"
```

Result:

```json
"qr": {
  "title": "Mã QR của tôi",
  "subtitle": "Xuất trình mã này để nhân viên xác nhận tài khoản",
  "notLoggedIn": "...",
  "downloadButton": "Lưu QR vào ảnh"
}
```

- [ ] **Step 2: Update `QrContent` in `components/profile/scan-sheet-portal.tsx`**

Add imports at the top of the file:

```typescript
import { Download } from 'lucide-react-native'
import { useCallback, useRef } from 'react'
import type { Svg } from 'react-native-svg'
import { downloadQRCodeImage } from '@/utils'
```

Note: `memo`, `useCallback`, `useEffect`, `useMemo`, `useRef` are all already imported — add only the missing ones.

Replace the `QrContent` component:

```typescript
const QrContent = memo(function QrContent({
  isDark,
  onClose,
}: {
  isDark: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('profile')
  const userInfo = useUserStore((s) => s.userInfo)

  const primary = isDark ? colors.primary.dark : colors.primary.light
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const mutedColor = isDark ? colors.gray[400] : colors.gray[500]
  const qrBg = isDark ? colors.gray[800] : colors.white.light

  const fullName = [userInfo?.firstName, userInfo?.lastName]
    .filter(Boolean)
    .join(' ')

  const slug = userInfo?.slug ?? null

  const svgRef = useRef<Svg | null>(null)
  const handleDownload = useCallback(() => {
    svgRef.current?.toDataURL((data) => {
      void downloadQRCodeImage(data, `member_qr_${userInfo?.slug ?? Date.now()}`)
    })
  }, [userInfo?.slug])

  return (
    <View style={s.content}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: textColor }]}>
          {t('profile.qr.title')}
        </Text>
        <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
          <X size={20} color={mutedColor} />
        </Pressable>
      </View>

      {/* Subtitle */}
      <Text style={[s.subtitle, { color: mutedColor }]}>
        {t('profile.qr.subtitle')}
      </Text>

      {/* QR Container */}
      <View style={[s.qrWrap, { backgroundColor: qrBg }]}>
        <View style={[s.corner, s.cornerTL, { borderColor: primary }]} />
        <View style={[s.corner, s.cornerTR, { borderColor: primary }]} />
        <View style={[s.corner, s.cornerBL, { borderColor: primary }]} />
        <View style={[s.corner, s.cornerBR, { borderColor: primary }]} />
        {slug ? (
          <QRCode
            value={slug}
            size={QR_SIZE}
            color="#000000"
            backgroundColor="#FFFFFF"
            ecl="H"
            getRef={(ref) => { svgRef.current = ref }}
          />
        ) : (
          <View style={s.qrPlaceholder}>
            <Text style={[s.errorText, { color: mutedColor }]}>
              {t('profile.qr.notLoggedIn')}
            </Text>
          </View>
        )}
      </View>

      {/* User info */}
      {fullName ? (
        <Text style={[s.userName, { color: textColor }]} numberOfLines={1}>
          {fullName}
        </Text>
      ) : null}
      {userInfo?.phonenumber ? (
        <Text style={[s.userPhone, { color: mutedColor }]} numberOfLines={1}>
          {userInfo.phonenumber}
        </Text>
      ) : null}

      {/* Download button — only shown when QR is available */}
      {slug ? (
        <Pressable
          style={[s.downloadBtn, { borderColor: primary }]}
          onPress={handleDownload}
        >
          <Download size={14} color={primary} />
          <Text style={[s.downloadBtnText, { color: primary }]}>
            {t('profile.qr.downloadButton')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
})
```

Add styles to `StyleSheet.create` at the bottom:

```typescript
downloadBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  borderWidth: 1.5,
  borderRadius: 10,
  paddingHorizontal: 20,
  paddingVertical: 8,
  marginTop: 4,
},
downloadBtnText: {
  fontSize: 14,
  fontWeight: '600',
},
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Run full check**

```bash
npm run check:all
```

Expected: 0 errors, 0 warnings, no circular deps, all tests pass

- [ ] **Step 5: Commit**

```bash
git add components/profile/scan-sheet-portal.tsx i18n/vi/profile.json
git commit -m "feat(qr): add download button to member QR sheet"
```
