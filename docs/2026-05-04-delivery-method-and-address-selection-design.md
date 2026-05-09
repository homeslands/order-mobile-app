# Delivery Method & Address Selection — Logic & Use Cases

**Date:** 2026-05-04
**Scope:** Client-facing cart flow (`src/app/client/cart/`) + Update-order flow (`src/app/client/update-order/`)
**Audience:** Product, QA, and Frontend developers

---

## 1. Overview

Hệ thống hỗ trợ 3 phương thức đặt hàng, được kiểm soát bởi feature flags và trạng thái đăng nhập của khách hàng.

### 1.1 Ba phương thức đặt hàng

| Phương thức          | Enum value | Label (VI)     | Điều kiện hiển thị                                               |
| -------------------- | ---------- | -------------- | ---------------------------------------------------------------- |
| Dine-in (tại bàn)    | `at-table` | "Dùng tại chỗ" | Luôn có, trừ khi bị lock                                         |
| Take-away (mang về)  | `take-out` | "Mang về"      | Luôn có, trừ khi bị lock                                         |
| Delivery (giao hàng) | `delivery` | "Giao hàng"    | **Chỉ hiện với khách đã đăng nhập** + feature flag không bị lock |

### 1.2 Điều kiện hiển thị tùy chọn Delivery

Tùy chọn Delivery chỉ xuất hiện khi **đồng thời** thỏa 2 điều kiện:

1. Khách hàng đã đăng nhập với `role = CUSTOMER` (không phải guest/default-customer)
2. Feature flag `SystemLockFeatureGroup.ORDER` → `SystemLockFeatureType.CREATE_PRIVATE` → child `SystemLockFeatureChild.DELIVERY` tồn tại và `isLocked = false`

Khách **chưa đăng nhập** sử dụng nhóm flag `CREATE_PUBLIC` — nhóm này không có child DELIVERY, nên không bao giờ thấy tùy chọn giao hàng.

---

## 2. User Journey Map

### 2.1 Flow tổng quan

```
[Vào trang Cart]
      │
      ▼
[Chọn phương thức đặt hàng]
      │
      ├─── AT_TABLE ──► [Chọn bàn (TableInCartSelect)]
      │                        │
      │                        ▼
      │                 [Đặt hàng → Thanh toán]
      │
      ├─── TAKE_OUT ──► [Chọn giờ lấy (PickupTimeSelect)]
      │                        │
      │                        ▼
      │                 [Đặt hàng → Thanh toán]
      │
      └─── DELIVERY ──► [Hiển thị MapAddressSelector]
                               │
                    ┌──────────┴──────────┐
                    │                     │
             [Nhập địa chỉ]        [Chọn trên bản đồ]
             (Autocomplete)         (Click / GPS)
                    │                     │
                    └──────────┬──────────┘
                               │
                    [Stage pendingSelection]
                               │
                    [Fetch khoảng cách từ API]
                               │
                    ┌──────────┴──────────┐
                    │                     │
              [> maxDistance]      [≤ maxDistance]
                    │                     │
            [Reset UI + Toast]    [Persist vào Store]
                                          │
                                  [Nhập số điện thoại]
                                          │
                                  [Validate phone regex]
                                          │
                                  [Đặt hàng → Thanh toán]
```

### 2.2 Trạng thái Store qua từng bước

```
initializeOrdering()
  → type: AT_TABLE, deliveryAddress: '', deliveryPhone: <user phone>

setOrderingType(DELIVERY)
  → type: DELIVERY (MapAddressSelector hiện ra)

[User chọn địa chỉ]
  → pendingSelection = { coords, placeId, address }

[Distance API trả về ≤ maxDistance]
  → deliveryLat, deliveryLng, deliveryPlaceId, deliveryAddress,
     deliveryDistance, deliveryDuration được persist

[User nhập phone]
  → deliveryPhone được persist real-time

[CreateOrderDialog.handleSubmit()]
  → Validate: deliveryAddress && PHONE_NUMBER_REGEX.test(deliveryPhone)
  → Gọi API: { type: 'delivery', deliveryTo: placeId, deliveryPhone }
```

---

## 3. Use Cases Chi Tiết

### UC-01: Khách guest — không thấy tùy chọn Delivery

**Actor:** Khách chưa đăng nhập  
**Tiền điều kiện:** Không có token xác thực  
**Flow:**

1. Khách vào menu, thêm món vào giỏ hàng
2. Vào trang Cart
3. `OrderTypeSelect` load feature flags nhóm `CREATE_PUBLIC`
4. `CREATE_PUBLIC` không có child `DELIVERY` → tùy chọn Delivery bị loại khỏi danh sách
5. Khách chỉ thấy "Dùng tại chỗ" và "Mang về"

**Kết quả:** Không có MapAddressSelector, không có trường địa chỉ.

---

### UC-02: Khách đăng nhập — chọn Delivery và nhập địa chỉ tay (autocomplete)

**Actor:** Khách đã đăng nhập với `role = CUSTOMER`  
**Tiền điều kiện:** Feature flag DELIVERY không bị lock  
**Flow:**

1. Khách chọn "Giao hàng" từ dropdown `OrderTypeSelect`
2. `setOrderingType(OrderTypeEnum.DELIVERY)` được gọi
3. `MapAddressSelector` hiện ra bên dưới với:
   - Thông báo giới hạn khoảng cách (`maxDistance` km)
   - Input nhập địa chỉ
   - Bản đồ Google Maps với marker của chi nhánh
4. Khách gõ địa chỉ vào input
5. Sau 300ms debounce, `useGetAddressSuggestions(query)` được gọi
6. Danh sách gợi ý hiện ra (có thể điều hướng bằng phím ↑↓, chọn bằng Enter)
7. Khách chọn một gợi ý → `selectedPlaceId` được set
8. `useGetAddressByPlaceId(placeId)` trả về tọa độ
9. Bản đồ pan đến tọa độ, marker đỏ xuất hiện
10. `pendingSelection` được stage
11. `useGetDistanceAndDuration()` trả về khoảng cách
12. Nếu `km ≤ maxDistance` → persist toàn bộ delivery info vào store
13. Route polyline (đường xanh) được vẽ từ chi nhánh đến địa chỉ

**Kết quả:** Store có đủ `deliveryAddress`, `deliveryLat/Lng`, `deliveryPlaceId`, `deliveryDistance/Duration`.

---

### UC-03: Khách chọn vị trí bằng cách click lên bản đồ

**Actor:** Khách đã đăng nhập  
**Flow:**

1. Khách click vào điểm bất kỳ trên bản đồ (`onMapClick`)
2. `marker` được đặt tại tọa độ click
3. Google Maps Geocoder chạy reverse geocode → lấy `formattedAddress` + `placeId`
4. `addressInput` được cập nhật với địa chỉ đọc được
5. `pendingSelection` được stage
6. Distance API kiểm tra khoảng cách:
   - Hợp lệ → persist, vẽ route
   - Quá xa → reset marker, xóa input, hiện toast lỗi

**Lưu ý:** Nếu Geocoder không tìm được địa chỉ, dùng lại `addressInput` hiện tại.

---

### UC-04: Khách dùng "Vị trí hiện tại" (Geolocation API)

**Actor:** Khách đã đăng nhập, đang dùng thiết bị có GPS  
**Flow:**

1. Khách nhấn nút "Dùng vị trí hiện tại"
2. `navigator.geolocation.getCurrentPosition()` được gọi với `enableHighAccuracy: true, timeout: 10000`
3. **Nếu được cấp quyền:**
   - Marker được đặt tại tọa độ GPS
   - Bản đồ pan đến vị trí
   - Reverse geocode lấy địa chỉ
   - `pendingSelection` được stage
   - Distance API kiểm tra khoảng cách
4. **Nếu bị từ chối quyền (error.code === 1):** Toast "Không có quyền truy cập vị trí"
5. **Nếu không lấy được vị trí (error.code === 2):** Toast "Không thể xác định vị trí"
6. **Nếu timeout (error.code === 3):** Toast "Hết thời gian xác định vị trí"

---

### UC-05: Địa chỉ nằm ngoài vùng giao hàng

**Actor:** Khách đã đăng nhập  
**Tiền điều kiện:** Địa chỉ được chọn cách chi nhánh > `maxDistanceDelivery` km  
**Flow:**

1. Khách chọn địa chỉ (bằng autocomplete, click, hoặc GPS)
2. `pendingSelection` được stage
3. `useGetDistanceAndDuration()` trả về khoảng cách
4. `km > maxDistance` → logic rejection kích hoạt (deduplicated bởi `lastRejectedKeyRef`)
5. Toast lỗi: "Địa chỉ cách chi nhánh quá {maxDistance} km"
6. Marker bị xóa, input địa chỉ bị xóa
7. Bản đồ pan về `defaultCenter`
8. `clearDeliveryInfo()` được gọi → xóa toàn bộ delivery info trong store
9. `onChange?.({ coords: null, ... })` được emit

**Kết quả:** Store sạch, khách phải chọn lại địa chỉ gần hơn.

---

### UC-06: Chỉnh sửa đơn hàng đã tạo (Update Order flow)

**Actor:** Khách đã tạo đơn với type DELIVERY, muốn thay đổi địa chỉ  
**Tiền điều kiện:** Đơn hàng đang ở trạng thái cho phép sửa  
**Flow:**

1. `initializeUpdating(originalOrder)` khởi tạo `updatingData` từ đơn gốc
   - `deliveryAddress` lấy từ `originalOrder.deliveryTo?.formattedAddress`
   - `deliveryDistance/Duration/Phone` được copy từ đơn gốc
2. `MapAddressSelectorInUpdateOrder` hiện ra thay vì `MapAddressSelector`
3. Component dùng `setDraftDelivery*` actions thay vì `setDelivery*`
4. Toàn bộ logic chọn địa chỉ giống UC-02/03/04
5. Khi confirm update, gọi `useUpdateOrderType` mutation với draft data

**Khác biệt so với UC-02:** Sử dụng `updatingData.updateDraft` thay vì `orderingData`, actions có prefix `setDraft*`.

---

## 4. Technical Implementation

### 4.1 Component: `OrderTypeSelect`

**File:** `src/components/app/select/order-type-select.tsx`

```
Inputs:
  - useGetSystemFeatureFlagsByGroup(SystemLockFeatureGroup.ORDER)
  - useOrderFlowStore().getCartItems()
  - useOrderFlowStore().setOrderingType()

Logic:
  1. isUserLoggedIn = ownerRole === 'CUSTOMER' && phone !== 'default-customer'
  2. relevantParent = isUserLoggedIn ? CREATE_PRIVATE : CREATE_PUBLIC
  3. orderTypes = [AT_TABLE, TAKE_OUT]
     + DELIVERY nếu isUserLoggedIn && hasDeliveryInFeature
  4. Lọc bỏ type có isLocked === true
  5. Auto-switch nếu cartItems.type không còn trong danh sách available

Side effects:
  - useEffect tự động gọi setOrderingType(orderTypes[0]) nếu type hiện tại bị lock
```

### 4.2 Component: `MapAddressSelector`

**File:** `src/app/client/cart/components/map-address-selector.tsx`

**State nội bộ:**
| State | Mô tả |
|---|---|
| `center` | Tọa độ trung tâm bản đồ |
| `marker` | Tọa độ pin đỏ (địa chỉ khách) |
| `addressInput` | Text hiển thị trong input |
| `queryAddress` | Text sau debounce 300ms để query API |
| `showSuggestions` | Toggle dropdown gợi ý |
| `_selectedPlaceId` | Google Places ID đang chọn |
| `pendingSelection` | `{ coords, placeId, address }` chờ distance check |
| `isLocating` | Loading state cho GPS |
| `lastProcessedKeyRef` | Ref deduplicate persist (tránh re-persist cùng địa chỉ) |
| `lastRejectedKeyRef` | Ref deduplicate rejection toast |

**Hooks sử dụng:**
| Hook | Mục đích |
|---|---|
| `useGetAddressSuggestions(query)` | Autocomplete Google Places |
| `useGetAddressByPlaceId(placeId)` | Lấy tọa độ từ placeId |
| `useGetAddressDirection(branchSlug, lat, lng)` | Vẽ route polyline |
| `useGetDistanceAndDuration(branchSlug, lat, lng)` | Khoảng cách thực tế |
| `useGetBranchDeliveryConfig(branchSlug)` | `maxDistance`, `feePerKm` |

**Pending Selection Pattern:**

> Địa chỉ **không bao giờ** được persist ngay khi chọn. Luôn phải qua bước distance check trước.

```
chọn địa chỉ → setPendingSelection() → distance API → if valid → persist to store
```

Deduplicated bởi `key = "${lat},${lng}|${placeId}"` so sánh với `lastProcessedKeyRef`.

### 4.3 Delivery Fields trong Zustand Store (`IOrderingData`)

**File:** `src/stores/order-flow.store.ts`

| Field              | Type            | Mô tả                                           |
| ------------------ | --------------- | ----------------------------------------------- |
| `type`             | `OrderTypeEnum` | Phương thức đặt hàng                            |
| `deliveryAddress`  | `string`        | Địa chỉ dạng text đọc được                      |
| `deliveryLat`      | `number?`       | Vĩ độ                                           |
| `deliveryLng`      | `number?`       | Kinh độ                                         |
| `deliveryPlaceId`  | `string`        | Google Places ID (gửi lên API)                  |
| `deliveryDistance` | `number`        | Khoảng cách (km)                                |
| `deliveryDuration` | `number`        | Thời gian di chuyển                             |
| `deliveryPhone`    | `string`        | SĐT giao hàng (default: SĐT của user đăng nhập) |

**Actions chính:**

```typescript
setDeliveryAddress(address: string)
setDeliveryCoords(lat, lng, placeId?)
setDeliveryPlaceId(placeId)
setDeliveryDistanceDuration(distance, duration)
setDeliveryPhone(phone)
clearDeliveryInfo()          // Reset khi địa chỉ quá xa hoặc xóa customer
```

**Update Order tương đương (prefix `Draft`):**

```typescript
setDraftDeliveryAddress / setDraftDeliveryCoords / setDraftDeliveryPlaceId
setDraftDeliveryDistanceDuration /
  setDraftDeliveryPhone /
  clearDraftDeliveryInfo
```

Store được persist vào `localStorage` key `order-flow-store` (version 1).

### 4.4 Tính phí giao hàng (`useCalculateDeliveryFee`)

**File:** `src/utils/google-map.ts`

```
Input:  distance (km), branchSlug
Output: { deliveryFee, isLoading, error }

Logic:
  1. Fetch branch info: maxDistanceDelivery, deliveryFeePerKm
  2. if distance > maxDistanceDelivery → error
  3. deliveryFee = distance * deliveryFeePerKm
```

Phí hiển thị trong tổng đơn hàng: `finalTotal = subtotal - promotionDiscount - voucherDiscount + deliveryFee - accumulatedPointsToUse`

### 4.5 Validation trước khi tạo đơn (`CreateOrderDialog`)

**File:** `src/components/app/dialog/create-order-dialog.tsx`

```typescript
// Validate trước khi gọi API
if (order.type === OrderTypeEnum.DELIVERY) {
  const phoneOk = !!order.deliveryPhone && PHONE_NUMBER_REGEX.test(order.deliveryPhone)
  if (!order.deliveryAddress || !phoneOk) {
    showErrorToast(119000)  // "Vui lòng nhập địa chỉ và số điện thoại hợp lệ"
    return
  }
}

// API payload
{
  type: 'delivery',
  deliveryTo: order.deliveryPlaceId,   // Google Places ID
  deliveryPhone: order.deliveryPhone,
  branch: branchSlug,
  // ... các fields khác
}
```

**Phone validation:** `PHONE_NUMBER_REGEX` — định dạng số điện thoại Việt Nam 10 số.

---

## 5. Edge Cases & Constraints

### 5.1 Session Hydration từ localStorage

Khi component mount, store chưa được hydrate (`isHydrated = false`). `MapAddressSelector` chờ `isHydrated === true` mới đọc delivery info từ store để restore lại state UI (địa chỉ, tọa độ, SĐT đã lưu phiên trước).

```typescript
useEffect(() => {
  if (!isHydrated) return
  // Restore marker, addressInput, phoneInput từ store
}, [isHydrated, orderingData?.deliveryLat, ...])
```

### 5.2 `clearDeliveryInfo` được gọi khi nào

Delivery info bị xóa trong các trường hợp:

- Địa chỉ vượt quá `maxDistance` (auto-reset)
- `removeOrderingCustomer()` — xóa customer xóa luôn delivery info
- `removeOrderingTable()` — đồng thời xóa delivery info (phòng trường hợp switch type)

### 5.3 Deduplicate Toast và Persist

Để tránh toast lỗi liên tục khi user di chuyển bản đồ:

- `lastRejectedKeyRef` lưu key lần cuối bị từ chối → không hiện toast 2 lần cho cùng địa chỉ
- `lastProcessedKeyRef` lưu key lần cuối đã persist → không persist 2 lần

Key format: `"${lat.toFixed(6)},${lng.toFixed(6)}|${placeId}"`

### 5.4 Map layout thay đổi theo order type

```typescript
// Cart page layout
if (type === DELIVERY) {
  // 5-column grid: [OrderTypeSelect (4 col)] [DeleteButton (1 col)]
  // + MapAddressSelector chiếm toàn bộ width bên dưới
} else {
  // 2-column grid: [OrderTypeSelect] [TableSelect / PickupTimeSelect + DeleteButton]
}
```

### 5.5 Delivery Status Tracking (hệ thống quản lý giao hàng)

Sau khi đơn được tạo, `DeliveryOrderType` track trạng thái vận chuyển:

```
PENDING → SHIPPING → COMPLETED
                   → FAILED
```

Quản lý tại `src/app/system/delivery-management/` (staff-facing).

### 5.6 Giới hạn kỹ thuật

- Google Maps API key bắt buộc (`VITE_GOOGLE_MAPS_API_KEY`)
- Geolocation chỉ hoạt động trên HTTPS hoặc localhost
- `maxDistance` và `deliveryFeePerKm` được cấu hình per-branch trên server
- Delivery chỉ available cho `CREATE_PRIVATE` group → không hỗ trợ guest checkout với delivery
