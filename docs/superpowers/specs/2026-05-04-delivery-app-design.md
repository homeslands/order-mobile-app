# Delivery Method & Address Selection — Mobile App Design

**Date:** 2026-05-04
**Branch:** feature/delivery
**Source doc:** `docs/2026-05-04-delivery-method-and-address-selection-design.md` (web version)
**Scope:** Cart flow + Update-order flow (mobile)

---

## 1. Overview

Port tính năng Delivery từ web sang React Native / Expo. Logic nghiệp vụ (feature flags, store, API) đã tồn tại; phần cần xây mới là UI components và tích hợp map native.

### 1.1 Ba phương thức đặt hàng (không đổi so với web)

| Phương thức | Enum       | Điều kiện hiển thị                                                   |
| ----------- | ---------- | -------------------------------------------------------------------- |
| Dine-in     | `at-table` | Luôn có (trừ khi locked)                                             |
| Take-away   | `take-out` | Luôn có (trừ khi locked)                                             |
| Delivery    | `delivery` | Chỉ với user đăng nhập (`role=CUSTOMER`) + feature flag không locked |

---

## 2. Compatibility Analysis — Web vs App

### 2.1 Đã có sẵn (giữ nguyên)

| Thành phần                           | File                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Delivery store slice                 | `stores/slices/ordering-delivery.slice.ts`                                                                       |
| Update-order delivery slice          | `stores/slices/updating-delivery.slice.ts`                                                                       |
| Backend API proxy functions          | `api/order.ts` — `getAddressSuggestions`, `getAddressByPlaceId`, `getAddressDirection`, `getDistanceAndDuration` |
| React Query hooks                    | `hooks/use-order.ts`                                                                                             |
| Fee hooks                            | `hooks/use-branch-delivery.ts`                                                                                   |
| Type definitions                     | `types/google-map.type.ts`                                                                                       |
| Validation tạo đơn                   | `components/dialog/create-order-dialog.tsx`                                                                      |
| Feature flag DELIVERY (update-order) | `hooks/use-order-type-options-for-update-order.ts`                                                               |

### 2.2 Cần xây mới / sửa

| Thành phần web                           | Vấn đề                                   | Giải pháp mobile                                                                              |
| ---------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Google Maps JS (HTML embed)              | Không dùng được trên native              | `react-native-maps` MapView                                                                   |
| `navigator.geolocation`                  | Web API                                  | `expo-location`                                                                               |
| `google.maps.Geocoder` (reverse geocode) | Client-side JS, không có trên native     | GPS flow dùng `expo-location.reverseGeocodeAsync()` → auto-fill search → suggestion (xem 3.3) |
| Map tap-to-select                        | Không có reverse geocoding               | Map chỉ hiển thị (pan/zoom) — selection qua autocomplete + GPS                                |
| Map embedded inline page                 | Layout web                               | BottomSheetModal 85% (xem 3.1)                                                                |
| DELIVERY trong `useOrderTypeOptions`     | **Bug: hook chỉ có AT_TABLE + TAKE_OUT** | Thêm DELIVERY cho logged-in user                                                              |
| Keyboard navigation ↑↓                   | Không cần trên mobile                    | Bỏ                                                                                            |
| localStorage persist                     | Web only                                 | Đã dùng AsyncStorage — không đổi                                                              |

---

## 3. Architecture

### 3.1 UI Pattern: Bottom Sheet 85%

`DeliveryAddressSheet` là `BottomSheetModal` chiếm 85% chiều cao màn hình — nhất quán với `SimpleTableSheet`, `VoucherSheet` đang dùng trong app. Swipe-to-dismiss tự nhiên. Không cần route mới.

Sheet nhận prop `mode: 'cart' | 'update-order'` để bind đúng store actions: `mode='cart'` dùng `setDelivery*` / `clearDeliveryInfo`, `mode='update-order'` dùng `setDraftDelivery*` / `clearDraftDeliveryInfo`.

### 3.2 New Packages

```
react-native-maps    — MapView, Marker, Polyline
expo-location        — getCurrentPositionAsync, reverseGeocodeAsync, requestForegroundPermissionsAsync
```

### 3.3 GPS Flow (không cần backend mới)

Backend không có reverse geocoding endpoint. Giải pháp:

```
GPS button tap
  → expo-location.requestForegroundPermissionsAsync()
  → expo-location.getCurrentPositionAsync() → { lat, lng }
  → expo-location.reverseGeocodeAsync({ lat, lng }) → địa chỉ text
  → auto-fill addressInput với text đó
  → trigger useGetAddressSuggestions(text) → suggestions hiện ra
  → user tap chọn 1 suggestion (không auto-select — tránh chọn sai địa chỉ)
  → useGetAddressByPlaceId(placeId) → confirm coords
  → pendingSelection → distance check → persist
```

GPS errors được map sang toast cụ thể (permission denied / unavailable / timeout).

---

## 4. Component Design

### 4.1 `components/delivery/delivery-address-sheet.tsx`

**Props:**

```typescript
interface DeliveryAddressSheetProps {
  visible: boolean
  onClose: () => void
  mode: 'cart' | 'update-order'
  branchSlug: string
  isDark: boolean
  primaryColor: string
}
```

**Internal state:**
| State | Mô tả |
|---|---|
| `addressInput` | Text hiển thị trong input |
| `queryAddress` | Text sau debounce 300ms để query API |
| `showSuggestions` | Toggle dropdown gợi ý |
| `selectedPlaceId` | Google Places ID đang chọn |
| `pendingSelection` | `{ lat, lng, placeId, address }` chờ distance check |
| `isLocating` | Loading state GPS |
| `lastProcessedKeyRef` | Ref deduplicate persist |
| `lastRejectedKeyRef` | Ref deduplicate rejection toast |

**Hooks dùng:**
| Hook | Mục đích |
|---|---|
| `useGetAddressSuggestions(queryAddress)` | Autocomplete |
| `useGetAddressByPlaceId(selectedPlaceId)` | Tọa độ từ placeId |
| `useGetAddressDirection(branchSlug, lat, lng)` | Route polyline |
| `useGetDistanceAndDuration(branchSlug, lat, lng)` | Khoảng cách kiểm tra |
| `useGetBranchDeliveryConfig(branchSlug)` | `maxDistance`, `feePerKm` |

**Layout (3 states):**

1. **State mới mở:** Branch marker trên map, phone/confirm disabled
2. **State đang tìm:** Suggestion dropdown phủ lên map (absolute), map mờ phía sau
3. **State đã chọn:** Delivery marker đỏ + route polyline xanh, distance/fee bar hiện, confirm active

**pendingSelection pattern** (giữ nguyên từ web):

```
chọn địa chỉ → setPendingSelection() → distance API → if valid → persist to store
                                                      → if invalid → clearDeliveryInfo() + toast
```

Deduplicated bởi key `"${lat.toFixed(6)},${lng.toFixed(6)}|${placeId}"`.

### 4.2 `components/delivery/delivery-info-row.tsx`

Row tóm tắt trong CartFooter khi đã chọn địa chỉ. Tap để mở lại sheet.

```typescript
interface DeliveryInfoRowProps {
  address: string // deliveryAddress từ store
  onPress: () => void // mở DeliveryAddressSheet
  isDark: boolean
}
```

Hiển thị dạng dashed border khi chưa có địa chỉ (CTA chọn), solid khi đã có (hiển thị địa chỉ + nút "Sửa").

### 4.3 `utils/decode-polyline.ts`

Decode Google encoded polyline → `{ latitude, longitude }[]` cho `react-native-maps` Polyline. ~20 lines, không cần thêm package.

---

## 5. Changes to Existing Files

### 5.1 `hooks/use-order-type-options.ts`

Thêm DELIVERY vào `allTypes` (tương tự `use-order-type-options-for-update-order.ts` đã làm):

```typescript
// Thêm vào allTypes nếu isUserLoggedIn && hasDeliveryInFeature
if (isUserLoggedIn) {
  const hasDelivery = relevantParentFeature?.children?.some(
    (c) => c.name === SystemLockFeatureChild.DELIVERY,
  )
  if (hasDelivery)
    allTypes.push({ value: OrderTypeEnum.DELIVERY, label: t('menu.delivery') })
}
```

### 5.2 `components/cart/cart-order-type-sheet.tsx`

- Thêm `Truck` icon từ `lucide-react-native` cho option Delivery
- Icon map: `'at-table' → UtensilsCrossed`, `'take-out' → PackageCheck`, `'delivery' → Truck`

### 5.3 `components/cart/cart-footer.tsx`

- Thêm `DeliveryInfoRow` bên dưới order type row khi `orderType === 'delivery'`
- Tích hợp `useCalculateDeliveryFee` → hiện fee trong total row
- `isOrderDisabled` bổ sung check: `orderType === 'delivery' && (!deliveryAddress || !validPhone)`
- Mount `DeliveryAddressSheet` với `mode='cart'`

### 5.4 `app/update-order/components/update-order-footer.tsx`

Tương tự CartFooter: thêm `DeliveryInfoRow` + `DeliveryAddressSheet mode='update-order'` khi `orderType === 'delivery'`.

### 5.5 `components/dialog/order-info-section.tsx`

Hiển thị `deliveryAddress` và `deliveryPhone` trong confirm dialog khi type = DELIVERY.

---

## 6. Data Flow Per Use Case

### UC-01: Guest — không thấy Delivery

`useOrderTypeOptions` check `isUserLoggedIn` → không thêm DELIVERY → không hiện DeliveryInfoRow.

### UC-02: Logged-in — chọn địa chỉ qua autocomplete

1. Chọn "Giao hàng" → `DeliveryInfoRow` hiện (dashed, chưa có địa chỉ)
2. Tap row → `DeliveryAddressSheet` mở
3. Gõ địa chỉ → debounce 300ms → suggestions
4. Chọn suggestion → `pendingSelection` → distance check → persist
5. Nhập phone → tap "Xác nhận" → sheet đóng
6. CartFooter hiện địa chỉ + fee

### UC-03 (web: click map) → không hỗ trợ trên mobile

Map chỉ hiển thị để xác nhận vị trí. Selection qua autocomplete hoặc GPS.

### UC-04: GPS

GPS button → `expo-location` → reverseGeocode → auto-fill → suggestions → chọn → distance check.

### UC-05: Địa chỉ ngoài vùng giao

`distance > maxDistance` → `clearDeliveryInfo()` → marker xóa → input xóa → toast lỗi → bản đồ pan về branch.

### UC-06: Update order — đổi địa chỉ

`DeliveryAddressSheet mode='update-order'` → dùng `setDraft*` actions thay vì `setDelivery*`. Logic giống UC-02.

---

## 7. Edge Cases

### 7.1 Store Hydration

Khi sheet mount, chờ store `isHydrated === true` mới restore state (address, coords, phone) — giữ nguyên pattern từ web.

### 7.2 `clearDeliveryInfo` triggers

- Địa chỉ vượt `maxDistance`
- `removeOrderingCustomer()` — xóa customer
- User switch từ DELIVERY sang type khác

### 7.3 GPS Permission Errors

| `error.code`                          | Toast                            |
| ------------------------------------- | -------------------------------- |
| `Permissions.PermissionStatus.DENIED` | "Không có quyền truy cập vị trí" |
| Không lấy được vị trí                 | "Không thể xác định vị trí"      |
| Timeout                               | "Hết thời gian xác định vị trí"  |

### 7.4 Map không render được

Nếu `react-native-maps` lỗi (Google Maps API key thiếu), fallback hiển thị placeholder + vẫn cho phép dùng autocomplete.

---

## 8. Out of Scope

- UC-03 tap-on-map để chọn địa chỉ (không có reverse geocoding)
- Delivery status tracking (staff-facing — `system/delivery-management/`)
- Map route animation

---

## 9. Dependencies & Rollout

**Packages cần cài:**

```bash
npx expo install react-native-maps expo-location
```

**Env var cần thêm:**

```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<key>  # cho react-native-maps (Android/iOS)
```

**app.json** cần bổ sung `expo-location` permissions và Google Maps API key config cho Android/iOS.
