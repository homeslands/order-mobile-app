# Quét QR áp voucher — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm nút quét mã QR vào voucher sheet để khách áp voucher giấy mà không phải gõ tay mã.

**Architecture:** Camera hiển thị dưới dạng lớp phủ bên trong `BottomSheetModal` hiện có, không điều hướng sang màn mới. Chuỗi quét được đi qua một hàm lọc thuần, rồi đổ vào đúng state `searchCode` mà ô nhập tay đang dùng — từ đó toàn bộ luồng tra cứu, chấm điều kiện và áp voucher hiện tại chạy y nguyên, không sửa một dòng.

**Tech Stack:** React Native 0.81 + Expo SDK 54, `expo-camera` (`CameraView` + `useCameraPermissions`), `@gorhom/bottom-sheet` 5, TanStack Query 5, Jest + `@testing-library/react-native` 13.

**Spec:** `docs/superpowers/specs/2026-08-17-voucher-qr-scan-design.md`

## Global Constraints

- TypeScript strict. Không semicolon, nháy đơn, dấu phẩy cuối, print width 80. React 19 — không `import React`.
- Không `console.log` trong file `.ts`/`.tsx` — hook `pre-bash-commit-quality` sẽ chặn commit.
- Không `--no-verify` — hook `pre-bash-block-no-verify` sẽ chặn.
- Zustand: luôn chọn lát cắt cụ thể `useStore(s => s.field)`, không bao giờ `useStore()` trần.
- Animation: chỉ dùng `react-native-reanimated`, config lấy từ `SPRING_CONFIGS` / `MOTION` trong `constants/motion.ts`, không hardcode `damping`/`stiffness`.
- Mọi hàm truyền xuống component con bọc `useCallback`; component con bọc `memo`.
- Màu lấy từ `colors` trong `@/constants`, không hardcode hex.
- Định dạng mã voucher: `/^[A-Za-z0-9_-]{4,32}$/` — chốt trong spec, đặt đúng một chỗ trong `utils/voucher-qr.ts`.
- Branch: `feature/TCA-13-FE-Implement-Voucher-QR-Code-Generation-Scan-to-Redeem-Flow`, PR về `develop`.
- Commit theo Conventional Commits, scope `voucher`.

## Khác biệt so với spec

Spec liệt kê `hooks/use-voucher-scanner.ts` và một trạng thái "không tìm thấy" hiển thị bên trong màn quét (UC-06 ở lại trong camera). Kế hoạch này **bỏ cả hai**:

- Sau khi chuỗi qua được lớp lọc, camera đóng ngay và kết quả hiện trong sheet — giống hệt như khi khách gõ mã. Màn hình "không tìm thấy" đã có sẵn trong sheet, không cần dựng lại bản thứ hai trong camera.
- Chỉ trường hợp chuỗi **không đúng định dạng** (UC-07) mới ở lại trong camera, vì lúc đó chưa từng rời camera.
- Không còn trạng thái chung nào giữa ba sheet ngoài một biến `scanning` boolean, nên không cần hook riêng.

Kết quả: bớt một file, bớt một máy trạng thái, và trường hợp quét nhầm QR lạ — trường hợp hay xảy ra nhất với voucher giấy — vẫn được xử lý ngay trong camera.

Spec còn nêu UC-13 (rời app khi camera đang mở) và đề xuất tự gỡ `CameraView` qua `AppState`. `expo-camera` đã tự dừng và dựng lại preview khi app xuống nền trên cả hai nền tảng, nên kế hoạch này **không viết thêm code cho nó** — thay vào đó là một bước kiểm tra tay ở Task 5. Nếu bước đó cho thấy camera treo hoặc đen hình khi quay lại, mới thêm xử lý `AppState`.

## Cấu trúc file

| File | Trách nhiệm |
|---|---|
| `utils/voucher-qr.ts` (mới) | Hàm thuần: chuỗi thô từ camera → mã voucher chuẩn hoá hoặc `null`. Không import React, không side effect |
| `components/scan/voucher-qr-scanner.tsx` (mới) | Lớp phủ camera: vòng đời quyền, `CameraView`, chốt chống lặp, khung quét, trạng thái mã lạ. Không biết gì về voucher |
| `app/update-order/components/voucher-sheet-in-update-order/search-header.tsx` (sửa) | Thêm nút quét. File này được **cả** payment và update-order dùng chung |
| `components/cart/cart-voucher-sheet.tsx` (sửa) | Header nội tuyến riêng — thêm nút quét, gắn lớp phủ |
| `app/payment/voucher-sheet-in-payment.tsx` (sửa) | Truyền `onScanPress`, gắn lớp phủ |
| `app/update-order/components/voucher-sheet-in-update-order/index.tsx` (sửa) | Truyền `onScanPress`, gắn lớp phủ |
| `i18n/vi/voucher.json`, `i18n/en/voucher.json` (sửa) | Chuỗi cho màn quét và quyền camera |
| `app.json`, `package.json` (sửa) | `expo-camera` + khai báo quyền |

---

## Task 1: Hàm lọc chuỗi quét được

**Files:**
- Create: `utils/voucher-qr.ts`
- Test: `__tests__/utils/voucher-qr.test.ts`

**Interfaces:**
- Consumes: không có
- Produces: `parseScannedVoucherCode(raw: string): string | null`

- [ ] **Step 1: Viết test thất bại**

Tạo `__tests__/utils/voucher-qr.test.ts`:

```ts
// Mã QR voucher là chuỗi trần, không tự mô tả nó là gì. Camera sẽ đọc trúng
// cả QR wifi, QR danh thiếp và QR định danh khách do chính app phát ra
// (components/profile/scan-sheet-portal.tsx:66 — value={userInfo.slug}).
// Hàm này là lớp chặn duy nhất trước khi tốn một vòng gọi API.
import { parseScannedVoucherCode } from '@/utils/voucher-qr'

describe('parseScannedVoucherCode', () => {
  it('trả về mã in hoa khi chuỗi hợp lệ', () => {
    expect(parseScannedVoucherCode('summer30')).toBe('SUMMER30')
  })

  it('cắt khoảng trắng thừa hai đầu', () => {
    expect(parseScannedVoucherCode('  TREND15\n')).toBe('TREND15')
  })

  it('chấp nhận gạch ngang và gạch dưới', () => {
    expect(parseScannedVoucherCode('he-2026_vip')).toBe('HE-2026_VIP')
  })

  it('từ chối chuỗi ngắn hơn 4 ký tự', () => {
    expect(parseScannedVoucherCode('ABC')).toBeNull()
  })

  it('từ chối chuỗi dài hơn 32 ký tự', () => {
    expect(parseScannedVoucherCode('A'.repeat(33))).toBeNull()
  })

  it('từ chối chuỗi rỗng', () => {
    expect(parseScannedVoucherCode('')).toBeNull()
  })

  it('từ chối URL', () => {
    expect(parseScannedVoucherCode('https://trendcoffee.vn/v/ABC')).toBeNull()
  })

  it('từ chối chuỗi có khoảng trắng ở giữa', () => {
    expect(parseScannedVoucherCode('SUMMER 30')).toBeNull()
  })

  it('từ chối chuỗi có dấu tiếng Việt', () => {
    expect(parseScannedVoucherCode('GIẢMGIÁ')).toBeNull()
  })

  it('từ chối cấu hình wifi', () => {
    expect(parseScannedVoucherCode('WIFI:S:Trend;T:WPA;P:12345678;;')).toBeNull()
  })

  it('từ chối mã định danh khách dạng UUID vì có 36 ký tự', () => {
    expect(
      parseScannedVoucherCode('3f2504e0-4f89-11d3-9a0c-0305e82c3301'),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx jest __tests__/utils/voucher-qr.test.ts`
Expected: FAIL — `Cannot find module '@/utils/voucher-qr'`

- [ ] **Step 3: Viết bản cài đặt tối thiểu**

Tạo `utils/voucher-qr.ts`:

```ts
/**
 * Lọc chuỗi đọc được từ camera thành mã voucher.
 *
 * Mã QR voucher là chuỗi trần nên không tự mô tả nó là gì. Không có lớp lọc
 * này thì mỗi lần quét nhầm một QR bất kỳ là một vòng gọi API trả 404 khó
 * hiểu cho khách.
 */
const VOUCHER_CODE_RE = /^[A-Za-z0-9_-]{4,32}$/

/** Trả mã đã chuẩn hoá, hoặc null nếu chuỗi không thể là mã voucher. */
export function parseScannedVoucherCode(raw: string): string | null {
  const code = raw.trim().toUpperCase()
  return VOUCHER_CODE_RE.test(code) ? code : null
}
```

- [ ] **Step 4: Chạy test, xác nhận đạt**

Run: `npx jest __tests__/utils/voucher-qr.test.ts`
Expected: PASS — 11 test

- [ ] **Step 5: Kiểm tra chất lượng**

Run: `npm run check`
Expected: exit 0, không lỗi TypeScript và ESLint

- [ ] **Step 6: Commit**

```bash
git add utils/voucher-qr.ts __tests__/utils/voucher-qr.test.ts
git commit -m "feat(voucher): add scanned QR code parser"
```

---

## Task 2: Cài expo-camera và khai báo quyền

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `app.json` (mảng `expo.plugins`)
- Modify: `i18n/vi/voucher.json`, `i18n/en/voucher.json`

**Interfaces:**
- Consumes: không có
- Produces: module `expo-camera` dùng được; các khoá i18n `scan.*` trong namespace `voucher`

Task này không có test tự động — camera là tầng native. Bước xác minh là đọc config đã giải quyết xong.

- [ ] **Step 1: Cài gói**

```bash
npx expo install expo-camera
```

Để lệnh này tự chọn phiên bản khớp SDK 54. Không tự gõ số phiên bản vào `package.json`.

- [ ] **Step 2: Thêm plugin vào `app.json`**

Trong `expo.plugins`, chèn phần tử dưới đây **ngay trước** chuỗi `"./plugins/remove-permissions"`:

```json
[
  "expo-camera",
  {
    "cameraPermission": "Ứng dụng cần quyền camera để quét mã QR voucher.",
    "microphonePermission": false,
    "recordAudioAndroid": false
  }
]
```

Ba điểm bắt buộc:

- `microphonePermission: false` và `recordAudioAndroid: false` để plugin không thêm `RECORD_AUDIO`. `plugins/remove-permissions.js` đang gỡ quyền đó bằng `tools:node="remove"` — để hai bên đá nhau là thừa và gây khó hiểu khi đọc manifest.
- Vị trí phải nằm trước `./plugins/remove-permissions` vì plugin đó chạy sau và lọc danh sách quyền.
- `plugins/remove-permissions.js` **không** gỡ `android.permission.CAMERA` — đã kiểm tra, không xung đột.

- [ ] **Step 3: Xác minh config đã giải quyết đúng**

Run: `npx expo config --type prebuild --json | python3 -c "import json,sys; c=json.load(sys.stdin); print('iOS:', c['ios']['infoPlist'].get('NSCameraUsageDescription')); print('Android:', [p for p in c['android'].get('permissions', []) if 'CAMERA' in p or 'AUDIO' in p])"`

Expected:
- `iOS: Ứng dụng cần quyền camera để quét mã QR voucher.`
- `Android:` có `android.permission.CAMERA`, **không** có `android.permission.RECORD_AUDIO`

- [ ] **Step 4: Thêm khoá i18n tiếng Việt**

Trong `i18n/vi/voucher.json`, thêm vào bên trong object `"voucher"`:

```json
"scan": {
  "title": "Quét mã giảm giá",
  "hint": "Đưa mã QR vào giữa khung",
  "manualEntry": "Nhập mã thủ công",
  "retry": "Quét lại",
  "notAVoucher": "Mã QR này không phải voucher",
  "notAVoucherHint": "Hãy quét mã in trên tem, biển hoặc trong tin nhắn của Trend.",
  "permTitle": "Bật camera để quét mã",
  "permBody": "Camera chỉ chạy trong lúc bạn quét mã giảm giá. Trend không lưu và không gửi hình ảnh đi đâu.",
  "permAllow": "Cho phép",
  "permDeniedTitle": "Camera đang bị chặn",
  "permDeniedBody": "Vào Cài đặt → Trend → Camera và bật quyền truy cập, rồi quay lại đây để quét mã.",
  "openSettings": "Mở Cài đặt",
  "close": "Đóng"
}
```

- [ ] **Step 5: Thêm khoá i18n tiếng Anh**

Trong `i18n/en/voucher.json`, thêm vào bên trong object `"voucher"`:

```json
"scan": {
  "title": "Scan discount code",
  "hint": "Point the QR code at the frame",
  "manualEntry": "Enter code manually",
  "retry": "Scan again",
  "notAVoucher": "This QR code is not a voucher",
  "notAVoucherHint": "Scan the code printed on a Trend sticker, sign or message.",
  "permTitle": "Turn on the camera to scan",
  "permBody": "The camera runs only while you scan a discount code. Trend never stores or sends the images.",
  "permAllow": "Allow",
  "permDeniedTitle": "Camera is blocked",
  "permDeniedBody": "Open Settings → Trend → Camera, turn on access, then come back to scan.",
  "openSettings": "Open Settings",
  "close": "Close"
}
```

- [ ] **Step 6: Kiểm tra chất lượng**

Run: `npm run check && npx jest`
Expected: exit 0. Bộ test hiện có vẫn xanh — thêm gói không được làm gãy gì.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app.json i18n/vi/voucher.json i18n/en/voucher.json
git commit -m "chore(voucher): add expo-camera and scan copy"
```

---

## Task 3: Component lớp phủ camera

**Files:**
- Create: `components/scan/voucher-qr-scanner.tsx`
- Test: `__tests__/components/scan/voucher-qr-scanner.test.tsx`

**Interfaces:**
- Consumes: `parseScannedVoucherCode(raw: string): string | null` từ `@/utils/voucher-qr`
- Produces: `VoucherQrScanner` — props `{ visible: boolean; onScanned: (code: string) => void; onClose: () => void }`. `onScanned` chỉ được gọi với mã **đã qua lọc và in hoa**; bên gọi không cần kiểm tra lại.

- [ ] **Step 1: Viết test thất bại**

Tạo `__tests__/components/scan/voucher-qr-scanner.test.tsx`:

```tsx
// Ba hành vi dễ hỏng nhất của lớp phủ camera:
//   1. onBarcodeScanned bắn nhiều lần mỗi giây — chỉ được xử lý lần đầu
//   2. CameraView không bao giờ được dựng khi chưa có quyền hoặc khi ẩn
//   3. Mã sai định dạng phải chặn tại chỗ, không gọi ngược lên bên trên
import { render, fireEvent, screen } from '@testing-library/react-native'

import { VoucherQrScanner } from '@/components/scan/voucher-qr-scanner'

// Mọi biến được nhắc tới bên trong factory của jest.mock BẮT BUỘC phải bắt
// đầu bằng "mock" — jest hoist các lệnh mock lên đầu file và sẽ ném lỗi
// "not allowed to reference any out-of-scope variables" nếu đặt tên khác.
// Vì cùng lý do đó, bên trong factory chỉ dùng require, không dùng import.

// Trạng thái quyền thay đổi theo từng test
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = null
const mockRequestPermission = jest.fn()

// Giữ lại callback mà component truyền cho CameraView để bắn thủ công
let mockOnBarcodeScanned: ((r: { data: string }) => void) | null = null

jest.mock('expo-camera', () => ({
  CameraView: (props: { onBarcodeScanned?: (r: { data: string }) => void }) => {
    mockOnBarcodeScanned = props.onBarcodeScanned ?? null
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { createElement } = require('react')
    const { View } = require('react-native')
    /* eslint-enable @typescript-eslint/no-require-imports */
    return createElement(View, { testID: 'camera-view' })
  },
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
}))

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

beforeEach(() => {
  mockPermission = { granted: true, canAskAgain: true }
  mockOnBarcodeScanned = null
  mockRequestPermission.mockClear()
})

describe('VoucherQrScanner', () => {
  it('không dựng CameraView khi visible = false', () => {
    render(
      <VoucherQrScanner
        visible={false}
        onScanned={jest.fn()}
        onClose={jest.fn()}
      />,
    )
    expect(screen.queryByTestId('camera-view')).toBeNull()
  })

  it('không dựng CameraView khi chưa có quyền, hiện nút xin quyền', () => {
    mockPermission = { granted: false, canAskAgain: true }
    render(
      <VoucherQrScanner visible onScanned={jest.fn()} onClose={jest.fn()} />,
    )
    expect(screen.queryByTestId('camera-view')).toBeNull()
    expect(screen.getByText('scan.permAllow')).toBeTruthy()
  })

  it('gọi requestPermission khi bấm cho phép', () => {
    mockPermission = { granted: false, canAskAgain: true }
    render(
      <VoucherQrScanner visible onScanned={jest.fn()} onClose={jest.fn()} />,
    )
    fireEvent.press(screen.getByText('scan.permAllow'))
    expect(mockRequestPermission).toHaveBeenCalledTimes(1)
  })

  it('hiện hướng dẫn Cài đặt khi quyền bị từ chối vĩnh viễn', () => {
    mockPermission = { granted: false, canAskAgain: false }
    render(
      <VoucherQrScanner visible onScanned={jest.fn()} onClose={jest.fn()} />,
    )
    expect(screen.getByText('scan.openSettings')).toBeTruthy()
    expect(screen.queryByTestId('camera-view')).toBeNull()
  })

  it('chỉ gọi onScanned một lần dù camera bắn ba lần', () => {
    const onScanned = jest.fn()
    render(<VoucherQrScanner visible onScanned={onScanned} onClose={jest.fn()} />)

    mockOnBarcodeScanned?.({ data: 'SUMMER30' })
    mockOnBarcodeScanned?.({ data: 'SUMMER30' })
    mockOnBarcodeScanned?.({ data: 'SUMMER30' })

    expect(onScanned).toHaveBeenCalledTimes(1)
    expect(onScanned).toHaveBeenCalledWith('SUMMER30')
  })

  it('chuẩn hoá mã trước khi trả lên trên', () => {
    const onScanned = jest.fn()
    render(<VoucherQrScanner visible onScanned={onScanned} onClose={jest.fn()} />)

    mockOnBarcodeScanned?.({ data: '  summer30 ' })

    expect(onScanned).toHaveBeenCalledWith('SUMMER30')
  })

  it('chặn mã sai định dạng tại chỗ và hiện thông báo', () => {
    const onScanned = jest.fn()
    render(<VoucherQrScanner visible onScanned={onScanned} onClose={jest.fn()} />)

    mockOnBarcodeScanned?.({ data: 'https://trendcoffee.vn' })

    expect(onScanned).not.toHaveBeenCalled()
    expect(screen.getByText('scan.notAVoucher')).toBeTruthy()
  })

  it('mở lại chốt sau khi bấm quét lại', () => {
    const onScanned = jest.fn()
    render(<VoucherQrScanner visible onScanned={onScanned} onClose={jest.fn()} />)

    mockOnBarcodeScanned?.({ data: 'https://trendcoffee.vn' })
    fireEvent.press(screen.getByText('scan.retry'))
    mockOnBarcodeScanned?.({ data: 'SUMMER30' })

    expect(onScanned).toHaveBeenCalledWith('SUMMER30')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx jest __tests__/components/scan/voucher-qr-scanner.test.tsx`
Expected: FAIL — `Cannot find module '@/components/scan/voucher-qr-scanner'`

- [ ] **Step 3: Viết component**

Tạo `components/scan/voucher-qr-scanner.tsx`:

```tsx
/**
 * Lớp phủ camera quét QR voucher.
 *
 * Component này không biết gì về voucher — nó chỉ trả về một chuỗi mã đã qua
 * lọc. Mọi việc tra cứu và chấm điều kiện do sheet gọi nó lo.
 *
 * Hiển thị dưới dạng lớp phủ tuyệt đối bên trong BottomSheetModal chứ không
 * mở màn mới: điều hướng sẽ làm sheet mất state đang giữ (mã gõ dở, voucher
 * đang chọn, danh sách đã tải).
 */
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { Camera, CameraOff, X } from 'lucide-react-native'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Pressable, StyleSheet, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { parseScannedVoucherCode } from '@/utils/voucher-qr'

type VoucherQrScannerProps = {
  visible: boolean
  /** Chỉ nhận mã đã qua lọc và in hoa. */
  onScanned: (code: string) => void
  onClose: () => void
}

const BARCODE_SETTINGS = { barcodeTypes: ['qr' as const] }

export const VoucherQrScanner = memo(function VoucherQrScanner({
  visible,
  onScanned,
  onClose,
}: VoucherQrScannerProps) {
  const { t } = useTranslation('voucher')
  const [permission, requestPermission] = useCameraPermissions()
  const [rejected, setRejected] = useState(false)

  // Chốt một chiều. onBarcodeScanned bắn nhiều lần mỗi giây khi mã còn nằm
  // trong khung; dùng state cho chốt này sẽ kéo theo re-render và vẫn để lọt
  // lần bắn thứ hai trong cùng một frame.
  const lockRef = useRef(false)

  useEffect(() => {
    if (!visible) {
      lockRef.current = false
      setRejected(false)
    }
  }, [visible])

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (lockRef.current) return
      lockRef.current = true

      const code = parseScannedVoucherCode(data)
      if (!code) {
        setRejected(true)
        return
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onScanned(code)
    },
    [onScanned],
  )

  const handleRetry = useCallback(() => {
    lockRef.current = false
    setRejected(false)
  }, [])

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings()
  }, [])

  if (!visible) return null

  // Hook chưa giải quyết xong ở frame đầu — giữ nền tối, đừng nháy nội dung.
  if (!permission) {
    return <View style={[s.root, s.dark]} />
  }

  if (!permission.granted) {
    const blocked = !permission.canAskAgain
    return (
      <View style={[s.root, s.panel]}>
        <View style={s.iconWrap}>
          {blocked ? (
            <CameraOff size={28} color={colors.destructive.light} />
          ) : (
            <Camera size={28} color={colors.primary.light} />
          )}
        </View>
        <Text style={s.panelTitle}>
          {blocked ? t('scan.permDeniedTitle') : t('scan.permTitle')}
        </Text>
        <Text style={s.panelBody}>
          {blocked ? t('scan.permDeniedBody') : t('scan.permBody')}
        </Text>
        <Pressable
          style={s.primaryBtn}
          onPress={blocked ? handleOpenSettings : requestPermission}
        >
          <Text style={s.primaryBtnText}>
            {blocked ? t('scan.openSettings') : t('scan.permAllow')}
          </Text>
        </Pressable>
        <Pressable style={s.ghostBtn} onPress={onClose}>
          <Text style={s.ghostBtnText}>{t('scan.manualEntry')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={[s.root, s.dark]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={BARCODE_SETTINGS}
        onBarcodeScanned={handleBarcodeScanned}
      />

      <View style={s.topBar}>
        <Text style={s.topTitle}>{t('scan.title')}</Text>
        <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10}>
          <X size={16} color={colors.white.light} />
        </Pressable>
      </View>

      <View style={s.center}>
        <View style={s.frame}>
          <View style={s.frameInner} />
          <View
            style={[
              s.corner,
              s.cornerTL,
              rejected ? s.cornerBad : s.cornerNormal,
            ]}
          />
          <View
            style={[
              s.corner,
              s.cornerTR,
              rejected ? s.cornerBad : s.cornerNormal,
            ]}
          />
          <View
            style={[
              s.corner,
              s.cornerBL,
              rejected ? s.cornerBad : s.cornerNormal,
            ]}
          />
          <View
            style={[
              s.corner,
              s.cornerBR,
              rejected ? s.cornerBad : s.cornerNormal,
            ]}
          />
        </View>

        {rejected ? (
          <View style={s.hintWrap}>
            <Text style={s.hintBad}>{t('scan.notAVoucher')}</Text>
            <Text style={s.hint}>{t('scan.notAVoucherHint')}</Text>
            <Pressable style={s.retryBtn} onPress={handleRetry}>
              <Text style={s.retryText}>{t('scan.retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={s.hint}>{t('scan.hint')}</Text>
        )}
      </View>

      <Pressable style={s.manualBtn} onPress={onClose}>
        <Text style={s.manualText}>{t('scan.manualEntry')}</Text>
      </Pressable>
    </View>
  )
})

const FRAME_INSET = 16

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  dark: { backgroundColor: '#0C0D0F' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  topTitle: { color: colors.white.light, fontSize: 15, fontWeight: '600' },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  frame: { width: 240, height: 240 },
  // Vùng quét lùi vào trong, chừa khoảng thở giữa nó và bốn góc ngoặc.
  frameInner: {
    position: 'absolute',
    top: FRAME_INSET,
    left: FRAME_INSET,
    right: FRAME_INSET,
    bottom: FRAME_INSET,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  corner: { position: 'absolute', width: 26, height: 26 },
  cornerNormal: { borderColor: colors.primary.light },
  cornerBad: { borderColor: colors.destructive.light },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 7,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 7,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 7,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 7,
  },

  hintWrap: { alignItems: 'center', gap: 8, paddingHorizontal: 32 },
  hint: {
    color: colors.gray[300],
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  hintBad: {
    color: colors.destructive.dark,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  retryText: { color: colors.white.light, fontSize: 13, fontWeight: '600' },

  manualBtn: { paddingVertical: 20, alignItems: 'center' },
  manualText: {
    color: colors.gray[300],
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  panel: {
    backgroundColor: colors.card.light,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
  },
  panelTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  panelBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedForeground.light,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 8,
    alignSelf: 'stretch',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.light,
  },
  primaryBtnText: {
    color: colors.white.light,
    fontSize: 14,
    fontWeight: '600',
  },
  ghostBtn: {
    alignSelf: 'stretch',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.light,
  },
  ghostBtnText: { fontSize: 14, fontWeight: '600' },
})
```

- [ ] **Step 4: Chạy test, xác nhận đạt**

Run: `npx jest __tests__/components/scan/voucher-qr-scanner.test.tsx`
Expected: PASS — 8 test

- [ ] **Step 5: Kiểm tra chất lượng**

Run: `npm run check`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add components/scan/voucher-qr-scanner.tsx __tests__/components/scan/voucher-qr-scanner.test.tsx
git commit -m "feat(voucher): add QR scanner overlay component"
```

---

## Task 4: Nút quét trong SearchHeader dùng chung

**Files:**
- Modify: `app/update-order/components/voucher-sheet-in-update-order/search-header.tsx:8-14` (props), `:63-87` (hàng nút), `:129-135` (style)

**Interfaces:**
- Consumes: không có
- Produces: `SearchHeader` nhận thêm prop tuỳ chọn `onScanPress?: () => void`. Khi không truyền, header giữ nguyên hình dạng cũ — nút quét không hiện.

File này được **cả hai** sheet dùng: `app/payment/voucher-sheet-in-payment.tsx:33` và `app/update-order/components/voucher-sheet-in-update-order/index.tsx`. Sửa một lần, hai màn cùng có nút.

- [ ] **Step 1: Mở rộng kiểu props**

Trong `search-header.tsx`, thay khối `type SearchHeaderProps` (dòng 8-14):

```tsx
type SearchHeaderProps = {
  code: string
  onChangeCode: (v: string) => void
  onSearch: () => void
  isDark: boolean
  primaryColor: string
  /** Bỏ trống thì không hiện nút quét — header giữ nguyên hình dạng cũ. */
  onScanPress?: () => void
}
```

Và thêm `onScanPress` vào danh sách tham số destructure ngay dưới đó:

```tsx
export function SearchHeader({
  code,
  onChangeCode,
  onSearch,
  isDark,
  primaryColor,
  onScanPress,
}: SearchHeaderProps) {
```

- [ ] **Step 2: Thêm nút quét vào hàng nhập liệu**

Trong `search-header.tsx`, ngay **sau** thẻ `</Pressable>` đóng nút tìm kiếm (dòng 87) và **trước** `</View>` đóng `inputRow` (dòng 88), chèn:

```tsx
        {onScanPress ? (
          <Pressable
            onPress={onScanPress}
            style={[
              styles.scanBtn,
              {
                backgroundColor: isDark
                  ? colors.background.dark
                  : colors.gray[100],
                borderColor: isDark ? colors.border.dark : colors.gray[300],
              },
            ]}
          >
            <ScanLine size={18} color={primaryColor} />
          </Pressable>
        ) : null}
```

- [ ] **Step 3: Thêm import icon**

Đổi dòng 3 của `search-header.tsx`:

```tsx
import { ScanLine, Search, Ticket } from 'lucide-react-native'
```

- [ ] **Step 4: Thêm style**

Trong `StyleSheet.create` cuối file, thêm sau `searchBtn`:

```tsx
  scanBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
```

- [ ] **Step 5: Kiểm tra chất lượng**

Run: `npm run check && npx jest`
Expected: exit 0. Không màn nào truyền `onScanPress` ở bước này, nên giao diện chưa đổi — đúng như mong đợi.

- [ ] **Step 6: Commit**

```bash
git add app/update-order/components/voucher-sheet-in-update-order/search-header.tsx
git commit -m "feat(voucher): add optional scan button to voucher search header"
```

---

## Task 5: Nối vào sheet giỏ hàng

**Files:**
- Modify: `components/cart/cart-voucher-sheet.tsx` — import, state, handler, JSX nút, JSX lớp phủ, style

Sheet này có header nội tuyến riêng, không dùng `SearchHeader`, nên phải sửa tay.

**Interfaces:**
- Consumes: `VoucherQrScanner` từ `@/components/scan/voucher-qr-scanner`
- Produces: không có

- [ ] **Step 1: Thêm import**

Thêm vào cụm import đầu file `components/cart/cart-voucher-sheet.tsx`:

```tsx
import { VoucherQrScanner } from '@/components/scan/voucher-qr-scanner'
```

Và đổi dòng 32 để có thêm icon:

```tsx
import { ScanLine, Search, Ticket } from 'lucide-react-native'
```

- [ ] **Step 2: Thêm state**

Ngay sau `const [searchCode, setSearchCode] = useState('')` (dòng 63):

```tsx
  const [scanning, setScanning] = useState(false)
```

- [ ] **Step 3: Thêm handler**

Ngay sau `handleSearch` (kết thúc dòng 314):

```tsx
  const handleOpenScanner = useCallback(() => setScanning(true), [])
  const handleCloseScanner = useCallback(() => setScanning(false), [])

  // Mã quét được đi vào đúng state mà ô nhập tay dùng — từ đây trở đi luồng
  // tra cứu và chấm điều kiện chạy y hệt trường hợp khách gõ mã.
  const handleScannedCode = useCallback((scanned: string) => {
    setScanning(false)
    setCode(scanned)
    setSearchCode(scanned)
  }, [])
```

- [ ] **Step 4: Đóng camera khi sheet đóng**

Trong `handleDismiss` (dòng 302-308), thêm một dòng vào thân hàm:

```tsx
  const handleDismiss = useCallback(() => {
    setCode('')
    setSearchCode('')
    setSelectedVoucher(null)
    setConditionVoucher(null)
    setScanning(false)
    onClose()
  }, [onClose])
```

- [ ] **Step 5: Thêm nút quét**

Ngay **sau** thẻ `</Pressable>` đóng nút tìm kiếm (dòng 554) và **trước** `</View>` đóng `inputRow` (dòng 555), chèn:

```tsx
            <Pressable
              onPress={handleOpenScanner}
              style={[
                voucherSheetStyles.scanBtn,
                {
                  backgroundColor: isDark
                    ? colors.background.dark
                    : colors.gray[100],
                  borderColor: isDark ? colors.border.dark : colors.gray[300],
                },
              ]}
            >
              <ScanLine size={18} color={primaryColor} />
            </Pressable>
```

- [ ] **Step 6: Gắn lớp phủ**

Ngay **trước** thẻ đóng `</BottomSheetModal>` (dòng 726), chèn:

```tsx
        <VoucherQrScanner
          visible={scanning}
          onScanned={handleScannedCode}
          onClose={handleCloseScanner}
        />
```

- [ ] **Step 7: Thêm style**

Trong `voucherSheetStyles`, thêm ngay sau `searchBtn`:

```tsx
  scanBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
```

- [ ] **Step 8: Kiểm tra chất lượng**

Run: `npm run check && npx jest`
Expected: exit 0

- [ ] **Step 9: Kiểm tra bằng tay trên máy thật**

Camera không chạy trên simulator iOS. Cần máy Android hoặc iPhone thật.

```bash
npx expo run:android
```

Kịch bản, đối chiếu với demo trong spec:

1. Thêm món vào giỏ, mở sheet mã giảm giá → thấy nút quét cạnh nút tìm kiếm (S1)
2. Bấm quét lần đầu → hiện màn giải thích, bấm "Cho phép" → dialog hệ thống (S2)
3. Cho phép → camera bật, khung bốn góc cam (S3)
4. Quét một QR chứa mã voucher thật → camera đóng, mã điền vào ô nhập, kết quả hiện trong sheet (S4/S5)
5. Quét một QR bất kỳ khác, ví dụ QR wifi → khung chuyển đỏ, hiện "Mã QR này không phải voucher", bấm "Quét lại" quét tiếp được (S6)
6. Từ chối quyền rồi bấm quét lại → hiện màn hướng dẫn Cài đặt (S7)
7. Kiểm tra chế độ tối cho cả bảy màn
8. **UC-13** — đang mở camera, nhấn nút Home hoặc khoá màn hình, rồi quay lại app: preview phải chạy lại bình thường, không đen hình, không treo. Nếu hỏng thì thêm `AppState` để gỡ `CameraView` khi app xuống nền, kèm một test mới cho hành vi đó.

- [ ] **Step 10: Commit**

```bash
git add components/cart/cart-voucher-sheet.tsx
git commit -m "feat(voucher): scan QR to fill voucher code in cart sheet"
```

---

## Task 6: Nối vào sheet thanh toán

**Files:**
- Modify: `app/payment/voucher-sheet-in-payment.tsx` — import, state, handler, prop cho `SearchHeader`, JSX lớp phủ

**Interfaces:**
- Consumes: `VoucherQrScanner`; `SearchHeader` với prop `onScanPress?: () => void` từ Task 4
- Produces: không có

- [ ] **Step 1: Thêm import**

Thêm vào cụm import đầu file `app/payment/voucher-sheet-in-payment.tsx`:

```tsx
import { VoucherQrScanner } from '@/components/scan/voucher-qr-scanner'
```

- [ ] **Step 2: Thêm state**

Ngay sau `const [searchCode, setSearchCode] = useState('')` (dòng 101):

```tsx
  const [scanning, setScanning] = useState(false)
```

- [ ] **Step 3: Thêm handler**

Ngay sau `handleSearch` (kết thúc dòng 343):

```tsx
  const handleOpenScanner = useCallback(() => setScanning(true), [])
  const handleCloseScanner = useCallback(() => setScanning(false), [])

  // Mã quét được đi vào đúng state mà ô nhập tay dùng — từ đây trở đi luồng
  // tra cứu và chấm điều kiện chạy y hệt trường hợp khách gõ mã.
  const handleScannedCode = useCallback((scanned: string) => {
    setScanning(false)
    setCode(scanned)
    setSearchCode(scanned)
  }, [])
```

- [ ] **Step 4: Đóng camera khi sheet đóng**

Thay `handleDismiss` (dòng 331-337) thành:

```tsx
  const handleDismiss = useCallback(() => {
    setCode('')
    setSearchCode('')
    setSelectedVoucher(null)
    setConditionVoucher(null)
    setScanning(false)
    onClose()
  }, [onClose])
```

- [ ] **Step 5: Truyền prop cho SearchHeader**

Sửa khối `<SearchHeader ... />` (dòng 460-466) thành:

```tsx
        <SearchHeader
          code={code}
          onChangeCode={setCode}
          onSearch={handleSearch}
          onScanPress={handleOpenScanner}
          isDark={isDark}
          primaryColor={primaryColor}
        />
```

- [ ] **Step 6: Gắn lớp phủ**

Ngay **trước** thẻ đóng `</BottomSheetModal>` của sheet này, chèn:

```tsx
        <VoucherQrScanner
          visible={scanning}
          onScanned={handleScannedCode}
          onClose={handleCloseScanner}
        />
```

- [ ] **Step 7: Kiểm tra chất lượng**

Run: `npm run check && npx jest`
Expected: exit 0

- [ ] **Step 8: Kiểm tra bằng tay**

Trên máy thật, vào một đơn đang chờ thanh toán, mở sheet mã giảm giá:

1. Thấy nút quét
2. Quét mã hợp lệ → áp được
3. Quét mã có xung đột phương thức thanh toán → `voucher-conflict-bottom-sheet` mở đúng như khi gõ tay (UC-12)

- [ ] **Step 9: Commit**

```bash
git add app/payment/voucher-sheet-in-payment.tsx
git commit -m "feat(voucher): scan QR to fill voucher code in payment sheet"
```

---

## Task 7: Nối vào sheet sửa đơn

**Files:**
- Modify: `app/update-order/components/voucher-sheet-in-update-order/index.tsx` — import, state, handler, prop cho `SearchHeader`, JSX lớp phủ

**Interfaces:**
- Consumes: `VoucherQrScanner`; `SearchHeader` với prop `onScanPress?: () => void` từ Task 4
- Produces: không có

- [ ] **Step 1: Thêm import**

Thêm vào cụm import đầu file `app/update-order/components/voucher-sheet-in-update-order/index.tsx`:

```tsx
import { VoucherQrScanner } from '@/components/scan/voucher-qr-scanner'
```

- [ ] **Step 2: Thêm state**

Ngay sau `const [searchCode, setSearchCode] = useState('')` (dòng 80):

```tsx
    const [scanning, setScanning] = useState(false)
```

Chú ý thụt lề: file này bọc component trong `memo(...)` nên thân hàm thụt sâu hơn một cấp so với hai file kia.

- [ ] **Step 3: Thêm handler**

Ngay sau `handleSearch` (kết thúc dòng 325):

```tsx
    const handleOpenScanner = useCallback(() => setScanning(true), [])
    const handleCloseScanner = useCallback(() => setScanning(false), [])

    // Mã quét được đi vào đúng state mà ô nhập tay dùng — từ đây trở đi luồng
    // tra cứu và chấm điều kiện chạy y hệt trường hợp khách gõ mã.
    const handleScannedCode = useCallback((scanned: string) => {
      setScanning(false)
      setCode(scanned)
      setSearchCode(scanned)
    }, [])
```

- [ ] **Step 4: Đóng camera khi sheet đóng**

Thay `handleDismiss` (dòng 313-319) thành:

```tsx
    const handleDismiss = useCallback(() => {
      setCode('')
      setSearchCode('')
      setSelectedVoucher(null)
      setConditionVoucher(null)
      setScanning(false)
      onClose()
    }, [onClose])
```

- [ ] **Step 5: Truyền prop cho SearchHeader**

Thay khối `<SearchHeader ... />` (dòng 396-402) thành:

```tsx
          <SearchHeader
            code={code}
            onChangeCode={setCode}
            onSearch={handleSearch}
            onScanPress={handleOpenScanner}
            isDark={isDark}
            primaryColor={primaryColor}
          />
```

- [ ] **Step 6: Gắn lớp phủ**

Ngay **trước** thẻ đóng `</BottomSheetModal>` của sheet này, chèn:

```tsx
          <VoucherQrScanner
            visible={scanning}
            onScanned={handleScannedCode}
            onClose={handleCloseScanner}
          />
```

- [ ] **Step 7: Kiểm tra chất lượng**

Run: `npm run check && npm run check-circular && npx jest`
Expected: exit 0 cả ba. `check-circular` chạy ở đây vì đây là task cuối chạm vào nhiều thư mục.

- [ ] **Step 8: Kiểm tra bằng tay**

Trên máy thật, mở một đơn đang sửa, vào sheet mã giảm giá, quét một mã hợp lệ → áp được.

- [ ] **Step 9: Commit và mở PR**

```bash
git add app/update-order/components/voucher-sheet-in-update-order/index.tsx
git commit -m "feat(voucher): scan QR to fill voucher code in update-order sheet"
git push origin feature/TCA-13-FE-Implement-Voucher-QR-Code-Generation-Scan-to-Redeem-Flow
```

PR về `develop`, tiêu đề `feat(voucher): scan QR code to find and apply voucher`.

Thân PR phải ghi rõ: **đây là thay đổi tầng native, không đẩy OTA được** — cần prebuild và build lại trước khi phát hành.

---

## Kiểm tra cuối

- [ ] `npm run check` — exit 0
- [ ] `npx jest` — toàn bộ xanh, gồm 11 test của `voucher-qr` và 8 test của `voucher-qr-scanner`
- [ ] `npm run check-circular` — không có phụ thuộc vòng
- [ ] Bảy màn S1–S7 đã đối chiếu trên máy Android thật, cả sáng lẫn tối
- [ ] Ba sheet — giỏ hàng, thanh toán, sửa đơn — đều quét được
- [ ] `npx expo config --type introspect --json` — `NSCameraUsageDescription` là câu gộp "Ứng dụng cần quyền camera để chụp ảnh đại diện và quét mã QR voucher.", `android.permissions` có `CAMERA`. Nếu tầng này còn thấy `RECORD_AUDIO` thì đó là do plugin của `expo-av` tự thêm — không phải lỗi — quyền đó bị `plugins/remove-permissions.js` gỡ ở bước sau, không xuất hiện trong `AndroidManifest.xml` cuối cùng. `--type prebuild` **không** chạy config-plugin mods nên không dùng được để kiểm tra bước này.
