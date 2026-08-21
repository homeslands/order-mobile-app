# Quét QR để tìm và áp voucher

**Ngày:** 2026-08-17
**Branch:** `feature/TCA-13-FE-Implement-Voucher-QR-Code-Generation-Scan-to-Redeem-Flow`
**Trạng thái:** chờ duyệt trước khi lập kế hoạch triển khai
**Demo UI:** https://claude.ai/code/artifact/5292c289-748b-4522-9e3a-ea5048788301

## Bối cảnh

Khách nhận voucher in trên giấy — tem dán, phiếu, poster tại quầy. Hiện muốn dùng phải đọc mã rồi gõ tay vào ô nhập trong voucher sheet. Mã dài, dễ gõ sai, và mỗi lần sai là một vòng gọi API trả về "không tìm thấy".

Tính năng này thêm camera quét QR ngay cạnh ô nhập mã, để khách chĩa máy vào tờ giấy là xong.

### Cái đã có

Luồng tìm và áp voucher bằng mã đã chạy đầy đủ:

- `components/cart/cart-voucher-sheet.tsx` — ô nhập mã → `searchCode` → `useSpecificVoucher({ code })` / `useSpecificPublicVoucher` tuỳ khách đã đăng nhập hay chưa
- `components/sheet/voucher-validation.ts` — `processVoucherList()` chấm 7 điều kiện và trả `isValid` + `errorMessage` đã dịch
- `hooks/use-voucher.ts` — `useValidateVoucher` xác nhận lại phía máy chủ trước khi áp
- `stores/cart.store.ts` — `cartActions.setVoucher`

Cùng một sheet được sao ra ba nơi: giỏ hàng, thanh toán (`app/payment/voucher-sheet-in-payment.tsx`), sửa đơn (`app/update-order/components/voucher-sheet-in-update-order/`).

`components/profile/scan-sheet-portal.tsx` đã dựng khung QR bốn góc ngoặc nhưng chỉ để **hiển thị** mã định danh của khách, chưa có camera.

### Cái chưa có

`expo-camera` không nằm trong `package.json`. `app.json` chưa khai báo quyền camera.

## Phạm vi

**Trong phạm vi**

- `components/scan/voucher-qr-scanner.tsx` — lớp phủ camera, xin quyền, khung quét, các trạng thái lỗi
- `utils/voucher-qr.ts` — lọc và chuẩn hoá chuỗi quét được
- `hooks/use-voucher-scanner.ts` — gộp trạng thái quyền và cờ đang quét cho ba sheet dùng chung
- `components/cart/cart-voucher-sheet.tsx` — nút quét + nối kết quả vào `searchCode`
- `app/payment/voucher-sheet-in-payment.tsx` — như trên
- `app/update-order/components/voucher-sheet-in-update-order/` — như trên
- `i18n/vi/voucher.json`, `i18n/en/voucher.json` — chuỗi cho màn quét và các lỗi mới
- `app.json`, `package.json` — thêm `expo-camera` và quyền camera

**Ngoài phạm vi**

- Sinh mã QR trong app (phần "Generation" của tên branch) — tách thành công việc riêng
- Đèn pin khi quét trong quán tối — xem phần "Quyết định không làm"
- Quét từ ảnh trong thư viện
- Điểm vào ngoài voucher sheet (Profile, Home, deep link)
- Ví voucher cá nhân, màn "Voucher của tôi"
- Payload có chữ ký chống phát tán — thuộc backend, xem "Rủi ro đã chấp nhận"

## Quyết định đã chốt

| Câu hỏi | Chốt | Hệ quả |
|---|---|---|
| Nội dung mã QR | Mã voucher trần, ví dụ `SUMMER30` | Không cần API mới. Nhưng mã không tự mô tả nó là gì → bắt buộc có lớp lọc phía app |
| Điểm vào | Chỉ trong voucher sheet | Giỏ hàng luôn có món khi quét → không cần lưu voucher chờ |
| Nguồn phát QR | Voucher giấy in sẵn | Mã tĩnh, không hết hạn theo phiên. Chất lượng in và ánh sáng là yếu tố thật cần tính |
| Định dạng mã | `/^[A-Za-z0-9_-]{4,32}$/` | Chấp nhận dạng hiện tại, chưa cần backend xác nhận |
| Chống phát tán | Không làm | Chấp nhận rủi ro chụp màn hình, chặn bằng `remainingUsage` và `numberOfUsagePerUser` sẵn có |

## Kiến trúc

Quét QR chỉ thay thế bước gõ mã. Từ lúc có chuỗi `code` trở đi, toàn bộ luồng hiện tại được tái dùng nguyên vẹn.

```
[nút quét] → [xin quyền] → [CameraView] → [lọc chuỗi] → searchCode
                                                            ↓
                          ── code đang chạy, không sửa ────────────────
                          useSpecificVoucher → processVoucherList
                            → validateVoucher → cartActions.setVoucher
```

### Chặng 1 — Mở camera

Nút icon quét đặt cạnh ô nhập mã trong `searchrow`. Bấm vào bật cờ `scanning` trong state cục bộ của sheet. Camera hiển thị dưới dạng lớp phủ **bên trong** `BottomSheetModal`, không điều hướng.

Không dùng route riêng. Mở màn mới bằng `router.push` sẽ khiến sheet mất state đang giữ (mã đã gõ dở, voucher đang chọn, danh sách đã tải) và phải nghĩ thêm đường trả kết quả ngược về.

Ngoài ra, hàng đợi modal của `@gorhom/bottom-sheet` trong dự án này đã có tiền sử trục trặc: `components/profile/scan-sheet-portal.tsx:128-137` và `components/profile/qr-selection-sheet.tsx:94-96` ghi lại một lỗi `minimize()` / `willUnmount` phải vá bằng tay khi có modal khác mount chen vào. Càng ít can thiệp vào vòng đời sheet càng ít rủi ro dẫm lại vết đó.

### Chặng 2 — Quyền camera

`useCameraPermissions()` từ `expo-camera` trả `[permission, requestPermission]`.

| Trạng thái | Xử lý |
|---|---|
| `granted` | Vào thẳng chặng 3 |
| chưa hỏi (`!permission`) | Hiện màn giải thích lý do, bấm "Cho phép" mới gọi `requestPermission()` |
| `!granted && canAskAgain` | Như trên |
| `!granted && !canAskAgain` | Màn hướng dẫn mở `Linking.openSettings()`, luôn kèm nút "Nhập mã thủ công" |

Hỏi thẳng dialog hệ thống mà không giải thích trước làm tỉ lệ từ chối cao hơn, và một khi khách đã từ chối vĩnh viễn thì không hỏi lại được nữa.

### Chặng 3 — Đọc mã

```tsx
<CameraView
  style={StyleSheet.absoluteFill}
  facing="back"
  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
  onBarcodeScanned={handleBarcodeScanned}
/>
```

`onBarcodeScanned` bắn liên tục nhiều lần mỗi giây khi mã còn nằm trong khung. Cần một `useRef` làm chốt một chiều:

```ts
const lockRef = useRef(false)

const handleBarcodeScanned = useCallback(({ data }: BarcodeScanningResult) => {
  if (lockRef.current) return
  lockRef.current = true
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  onScanned(data)
}, [onScanned])
```

Dùng `useState` cho chốt này sẽ kéo theo re-render và vẫn để lọt lần bắn thứ hai trong cùng một frame.

Chốt chỉ mở lại khi khách bấm "Quét lại" sau một lỗi.

### Chặng 4 — Lọc chuỗi

Mã trần không tự mô tả. Camera sẽ đọc trúng cả QR wifi, QR danh thiếp, và QR định danh khách do chính app phát ra ở `scan-sheet-portal.tsx:66` — cũng là một chuỗi trần (`userInfo.slug`).

```ts
// utils/voucher-qr.ts
const VOUCHER_CODE_RE = /^[A-Za-z0-9_-]{4,32}$/

/** Trả về mã voucher đã chuẩn hoá, hoặc null nếu chuỗi không thể là mã voucher. */
export function parseScannedVoucherCode(raw: string): string | null {
  const code = raw.trim().toUpperCase()
  return VOUCHER_CODE_RE.test(code) ? code : null
}
```

Không khớp → báo "Mã QR này không phải voucher", mở lại chốt, không gọi API.

### Chặng 5–7 — Code đang chạy

Chuỗi hợp lệ được đổ vào đúng state `searchCode` mà ô nhập tay đang dùng. React Query nhận key mới và tự gọi. Không thêm hook, không thêm endpoint.

`scheduleTransitionTask` bọc bước đóng camera + set `searchCode`, theo đúng quy ước hiệu năng của dự án.

## Thành phần

### `components/scan/voucher-qr-scanner.tsx` (mới)

Nhận `{ visible, onScanned, onClose, onManualEntry }`. Tự lo toàn bộ vòng đời quyền và camera. Không biết gì về voucher — chỉ trả chuỗi thô cho bên gọi.

`CameraView` chỉ được dựng khi `visible && permission?.granted`. Gỡ ngay khi bắt được mã hoặc khi sheet đóng. Thêm `useIsFocused` (hoặc `AppState`) để gỡ khi app xuống nền.

Khung quét dùng lại đúng bốn góc ngoặc của `scan-sheet-portal.tsx`: viền 2.5px, bo góc 7px, cách vùng quét một khoảng đệm.

### `hooks/use-voucher-scanner.ts` (mới)

```ts
export function useVoucherScanner(onCode: (code: string) => void) {
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<ScanError | null>(null)
  // open / close / handleScanned / retry
}
```

Ba sheet gọi cùng hook này, tránh chép logic ba lần.

### Ba voucher sheet (sửa)

Mỗi file thêm đúng hai thứ: nút quét trong `searchrow`, và `<VoucherQrScanner />` phủ lên nội dung sheet khi `scanning`. Phần còn lại không đụng.

## Trạng thái giao diện

Bảy màn, xem demo để đối chiếu:

| Mã | Trạng thái | Ghi chú |
|---|---|---|
| S1 | Voucher sheet + nút quét | Thay đổi duy nhất trên màn hình hiện có |
| S2 | Giải thích trước khi xin quyền | Chạy trước dialog hệ thống |
| S3 | Đang quét | Khung góc + vạch quét, kèm lối "Nhập mã thủ công" |
| S4 | Quét trúng, áp được | Mã điền sẵn vào ô nhập, thẻ voucher chọn sẵn, nút nói rõ tiết kiệm bao nhiêu |
| S5 | Chưa đủ điều kiện | Hiện còn thiếu bao nhiêu + nút "Thêm món", không chặn ở ngõ cụt |
| S6 | Mã lạ hoặc không tồn tại | Khung góc chuyển đỏ, giữ nguyên màn quét |
| S7 | Quyền bị từ chối vĩnh viễn | Nút mở Cài đặt, luôn kèm lối nhập tay |

## Use case

| Mã | Tình huống | Hành vi | Xử lý |
|---|---|---|---|
| UC-01 | Quét trúng voucher hợp lệ, giỏ đủ điều kiện | Đóng camera, thẻ chọn sẵn, nút áp dụng bật | có sẵn |
| UC-02 | Chưa đạt `minOrderValue` | Thẻ mờ + còn thiếu bao nhiêu, nút áp dụng tắt | có sẵn |
| UC-03 | Hết hạn hoặc hết lượt | `expired` / `outOfStock`, cho quét lại | có sẵn |
| UC-04 | Giỏ không có sản phẩm voucher áp dụng | Lý do theo `applicabilityRule` | có sẵn |
| UC-05 | Cần định danh, khách chưa đăng nhập | `needVerifyIdentity` + lối đăng nhập | có sẵn |
| UC-06 | Mã không tồn tại (404) | Báo trong màn quét, khung đỏ, mở lại chốt | mới |
| UC-07 | QR không phải voucher | Chặn tại lớp lọc, không gọi API | mới |
| UC-08 | Lần đầu bấm quét | Màn giải thích rồi mới đến dialog hệ thống | mới |
| UC-09 | Đã từ chối quyền vĩnh viễn | Hướng dẫn Cài đặt + lối nhập tay | mới |
| UC-10 | Đang có voucher khác | Hỏi xác nhận thay thế, so mức giảm cũ/mới | mới |
| UC-11 | Mất mạng lúc tra cứu | Lỗi kết nối + nút thử lại, không đóng màn quét | mới |
| UC-12 | Xung đột phương thức thanh toán | Mở `voucher-conflict-bottom-sheet` như nhập tay | có sẵn |
| UC-13 | Rời app khi camera đang mở | Gỡ `CameraView`, dựng lại khi quay vào | mới |

## Cấu hình native

```bash
npx expo install expo-camera
```

Thêm vào `app.json`, **đặt trước** `./plugins/remove-permissions`:

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

Ba điểm cần chú ý:

- `microphonePermission: false` và `recordAudioAndroid: false` để plugin không thêm `RECORD_AUDIO`. `plugins/remove-permissions.js` đang gỡ quyền này bằng `tools:node="remove"` — nếu để plugin camera thêm vào thì hai bên đá nhau vô ích.
- `plugins/remove-permissions.js` **không** gỡ `android.permission.CAMERA`, nên không có xung đột.
- iOS đã bật `useFrameworks: "static"` trong `expo-build-properties`, `expo-camera` hoạt động bình thường.

Đây là thay đổi tầng native — **không đẩy OTA được**. Cần prebuild, build lại và nộp store.

## Hiệu năng

Theo `CLAUDE.md`:

- `CameraView` chỉ dựng khi đang quét, gỡ ngay khi có kết quả. Giữ camera mở tốn pin rõ rệt và chiếm luồng JS.
- `memo` cho `VoucherQrScanner`, `useCallback` cho mọi handler truyền xuống.
- `scheduleTransitionTask` bọc bước đóng camera + set `searchCode`.
- Chốt chống lặp bằng `useRef`, không phải `useState`.
- Vạch quét dùng `react-native-reanimated` với config từ `constants/motion.ts`, chạy trên UI thread.

## i18n

Nhóm khoá mới trong `voucher.json`, cả `vi` và `en`:

```
scan.title            "Quét mã giảm giá"
scan.hint             "Đưa mã QR vào giữa khung"
scan.manualEntry      "Nhập mã thủ công"
scan.retry            "Quét lại"
scan.notAVoucher      "Mã QR này không phải voucher"
scan.notAVoucherHint  "Hãy quét mã in trên tem, biển hoặc trong tin nhắn của Trend."
scan.notFound         "Không tìm thấy mã này"
scan.networkError     "Không kết nối được. Thử lại nhé."
scan.permTitle        "Bật camera để quét mã"
scan.permBody         "Camera chỉ chạy trong lúc bạn quét mã giảm giá. Trend không lưu và không gửi hình ảnh đi đâu."
scan.permAllow        "Cho phép"
scan.permDeniedTitle  "Camera đang bị chặn"
scan.permDeniedBody   "Vào Cài đặt → Trend → Camera và bật quyền truy cập, rồi quay lại đây để quét mã."
scan.openSettings     "Mở Cài đặt"
```

## Kiểm thử

Theo `tdd-workflow`. Camera không test được trong Jest, nên ranh giới đặt ở chỗ: `voucher-qr.ts` là hàm thuần và phải có test đầy đủ; `VoucherQrScanner` test bằng cách mock `expo-camera`.

`__tests__/utils/voucher-qr.test.ts`

- mã hợp lệ → trả về chuỗi in hoa
- có khoảng trắng thừa → cắt sạch
- ngắn hơn 4 hoặc dài hơn 32 ký tự → `null`
- chứa ký tự lạ (`://`, khoảng trắng giữa, dấu tiếng Việt) → `null`
- chuỗi rỗng → `null`
- một `userInfo.slug` thật dạng UUID → xác nhận hành vi lọc đúng như kỳ vọng

`__tests__/components/scan/voucher-qr-scanner.test.tsx`

- `onBarcodeScanned` bắn ba lần liên tiếp → `onScanned` chỉ được gọi một lần
- quyền chưa hỏi → hiện màn giải thích, không dựng `CameraView`
- `!canAskAgain` → hiện màn hướng dẫn Cài đặt
- `visible === false` → không dựng `CameraView`

## Quyết định không làm

**Đèn pin.** Voucher in trên giấy, quán có thể tối, nên đèn pin là hợp lý. Nhưng nó thêm một nút, một quyền ngầm và một nhánh trạng thái. Để lại cho vòng sau, sau khi có số liệu thật về tỉ lệ quét hỏng.

**Lưu voucher chờ khi giỏ rỗng.** `VoucherSheet` chỉ được mount trong `components/cart/cart-footer.tsx`, mà footer chỉ tồn tại khi giỏ có món. Tình huống giỏ rỗng không xảy ra với điểm vào hiện tại. Nếu sau này mở thêm điểm vào từ Profile hay Home thì mới cần.

**Gộp ba voucher sheet thành một.** Ba file này gần như trùng nhau và đáng gộp, nhưng đó là việc refactor riêng. Gộp chung vào đây sẽ làm PR phình ra và khó review.

## Rủi ro đã chấp nhận

**Mã trần chụp màn hình là dùng lại được.** Voucher giấy vốn đã có thể chụp lại và chuyền tay, nên quét QR không làm rủi ro tệ hơn. Chặn bằng `remainingUsage` và `numberOfUsagePerUser` như hiện tại. Nếu cần chặt hơn thì phải đổi sang payload có chữ ký — việc của backend.

**Regex là phỏng đoán.** `/^[A-Za-z0-9_-]{4,32}$/` chưa được backend xác nhận. Nếu có mã hợp lệ nằm ngoài dải này thì khách sẽ thấy "không phải voucher" dù mã đúng. Rẻ để sửa (một hằng số), nhưng nên đối chiếu với dữ liệu thật trước khi phát hành.
