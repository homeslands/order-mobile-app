# Phân Tích Flow: Chọn Order Type "Mang Đi" (Take-Out) & Thời Gian Lấy Hàng

---

## 1. Tổng Quan

Khi khách hàng tạo đơn hàng, họ có thể chọn loại đơn hàng là **"Mang đi" (Take-Out)**. Sau khi chọn, giao diện hiển thị thêm phần **chọn thời gian lấy hàng** (pickup time). Giá trị này được lưu vào trường `timeLeftTakeOut` của đơn hàng.

---

## 2. Enum & Hằng Số

### Backend — `OrderType` (`order.constants.ts`)

| Giá trị | Ý nghĩa |
|---|---|
| `take-out` | Mang đi |
| `at-table` | Tại bàn |
| `delivery` | Giao hàng |

### Frontend — `OrderTypeEnum` (`types/dish.type.ts`)

```typescript
export enum OrderTypeEnum {
  AT_TABLE  = 'at-table',
  TAKE_OUT  = 'take-out',
  DELIVERY  = 'delivery',
}
```

### Pickup Time Options

Cả frontend và backend đều dùng cùng tập giá trị cố định (đơn vị: **phút**):

```
[0, 5, 10, 15, 30, 45, 60]
```

- `0` → "Ngay lập tức" / "Immediately"
- Các giá trị còn lại → "X phút" / "X minutes"

---

## 3. Cấu Trúc Dữ Liệu

### Order Entity — trường liên quan

| Trường | Kiểu | Mô tả |
|---|---|---|
| `type` | string | Loại đơn hàng (`take-out`, `at-table`, `delivery`) |
| `timeLeftTakeOut` | number | Thời gian lấy hàng (phút), default = 0. Chỉ có ý nghĩa khi `type = take-out` |

### `CreateOrderRequestDto`

| Field | Validate | Ghi chú |
|---|---|---|
| `type` | `@IsEnum(OrderType)`, bắt buộc | Phải là giá trị hợp lệ trong enum |
| `timeLeftTakeOut` | `@IsIn([0,5,10,15,30,45,60])`, **tùy chọn** | Nếu không truyền thì backend không ép |

### `UpdateOrderRequestDto`

| Field | Validate | Ghi chú |
|---|---|---|
| `type` | `@IsEnum(OrderType)`, bắt buộc | |
| `timeLeftTakeOut` | `@IsIn([0,5,10,15,30,45,60])`, **bắt buộc** | Khi update bắt buộc phải có |

---

## 4. Flow Tạo Đơn Mới (Create Order)

### Bước 1 — Người dùng chọn loại đơn hàng

Component: [order-type-select.tsx](../app/order-ui/src/components/app/select/order-type-select.tsx)

**Logic hiển thị options:**
- Luôn hiển thị: `Tại bàn (AT_TABLE)`, `Mang đi (TAKE_OUT)`
- Chỉ hiển thị `Giao hàng (DELIVERY)` nếu:
  - Người dùng đã đăng nhập (`role = Customer` và không phải `default-customer`)
  - Feature `DELIVERY` tồn tại trong `CREATE_PRIVATE` flag

**Feature flag:**
- Người dùng đã đăng nhập → dùng `CREATE_PRIVATE`
- Khách vãng lai → dùng `CREATE_PUBLIC` (không có DELIVERY)
- Nếu một loại bị khóa (`isLocked = true`) → bị lọc khỏi danh sách
- Nếu loại hiện tại bị khóa → tự động chuyển sang loại đầu tiên còn khả dụng

**Khi người dùng chọn `TAKE_OUT`:**

```
handleChange(TAKE_OUT)
    │
    ▼
setOrderingType(TAKE_OUT) [store]
    │
    ▼
orderingData.type = 'take-out'
orderingData.table = ''       ← Xóa bàn
orderingData.tableName = ''   ← Xóa tên bàn
```

---

### Bước 2 — Hệ thống hiển thị chọn thời gian lấy hàng

Component: [pickup-time-select.tsx](../app/order-ui/src/components/app/select/pickup-time-select.tsx)

**Điều kiện render:** Chỉ render khi `cartItems.type === 'take-out'`. Nếu loại khác → `return null`.

**Khởi tạo giá trị mặc định:**
1. Nếu có `defaultValue` prop → dùng giá trị đó
2. Nếu cart đã có `timeLeftTakeOut` → dùng giá trị đó
3. Nếu không có gì → set mặc định = `0` ("Ngay lập tức") và gọi `addPickupTime(0)`

**Khi người dùng chọn thời gian:**

```
handlePickupTimeSelect("15")
    │
    ▼
parseInt("15") → 15
setSelectedTime("15")          ← local state
addPickupTime(15)              ← store
onPickupTimeSelect?.(15)       ← optional callback
    │
    ▼
orderingData.timeLeftTakeOut = 15
```

---

### Bước 3 — Gửi request tạo đơn hàng

**API:** `POST /orders` hoặc `POST /orders/public`

**Payload ví dụ:**
```json
{
  "type": "take-out",
  "timeLeftTakeOut": 15,
  "branch": "branch-slug-123",
  "orderItems": [...],
  "owner": "user-slug-123"
}
```

---

### Bước 4 — Backend xử lý

File: [order.service.ts](../app/order-api/src/order/order.service.ts)

```
type = 'take-out'
    │
    ▼
validateFeatureFlag(ORDER, CREATE_PRIVATE, TAKE_OUT)  ← kiểm tra feature flag
    │
    ▼
Nếu owner là default-customer và type = DELIVERY → throw lỗi
(TAKE_OUT không bị hạn chế với default-customer)
    │
    ▼
order.table = null
order.timeLeftTakeOut = requestData.timeLeftTakeOut
order.deliveryTo = null
order.deliveryPhone = null
order.deliveryFee = 0
order.deliveryDistance = 0
    │
    ▼
Lưu database
```

---

## 5. Flow Cập Nhật Đơn Hàng (Update Order Type)

**Có**, update order hoàn toàn có phần đổi order type và pickup time, với cơ chế tương tự create nhưng dùng **draft state riêng** (`updatingData.updateDraft`).

---

### 5.1. Component chọn loại đơn hàng

[order-type-in-update-order-select.tsx](../app/order-ui/src/components/app/select/order-type-in-update-order-select.tsx)

**Logic giống với create**, bao gồm:
- Feature flag filter (`CREATE_PRIVATE` / `CREATE_PUBLIC`)
- Chỉ hiện DELIVERY nếu user đã đăng nhập
- Loại bị khóa không hiển thị

**Khác biệt:**
- Lấy `isUserLoggedIn` từ `userInfo` (store) HOẶC từ `updatingData.updateDraft.ownerRole`
- Giá trị hiện tại: `updatingData?.updateDraft?.type || typeOrder`
- Gọi `setDraftType(value)` thay vì `setOrderingType(value)`

---

### 5.2. Logic `setDraftType` (quan trọng)

```typescript
setDraftType: (type: OrderTypeEnum) => {
  // Nếu TAKE_OUT: xóa table, GIỮ NGUYÊN timeLeftTakeOut
  if (type === OrderTypeEnum.TAKE_OUT) {
    draft.table = ''
    draft.tableName = ''
    // timeLeftTakeOut không thay đổi
  }

  // Nếu AT_TABLE: xóa timeLeftTakeOut
  if (type === OrderTypeEnum.AT_TABLE) {
    draft.timeLeftTakeOut = undefined
  }

  updatingData.hasChanges = true
}
```

> So sánh: `setOrderingType` (create) chỉ xóa table khi chọn TAKE_OUT, **không** xóa `timeLeftTakeOut` khi chọn AT_TABLE. `setDraftType` (update) **có thêm logic** xóa `timeLeftTakeOut` khi chuyển sang AT_TABLE.

---

### 5.3. Component chọn thời gian lấy hàng

[pickup-time-in-update-order-select.tsx](../app/order-ui/src/components/app/select/pickup-time-in-update-order-select.tsx)

**Props:**

| Prop | Kiểu | Mô tả |
|---|---|---|
| `pickupTime` | `number?` | Giá trị ban đầu từ đơn gốc |
| `orderType` | `OrderTypeEnum` | Loại đơn hiện tại trong draft |
| `onPickupTimeSelect` | callback | Tùy chọn |

**Khác biệt so với create:**
- Nhận `orderType` qua **prop** (create đọc từ `cartItems.type`)
- Điều kiện render: `orderType !== TAKE_OUT → return null` (create dùng `cartItems?.type !== TAKE_OUT`)
- Có flag `isUpdatingFromProps` để tránh trigger `addDraftPickupTime` khi đang sync từ prop (ngăn vòng lặp)
- Gọi `addDraftPickupTime(minutes)` thay vì `addPickupTime(minutes)`

**Khởi tạo giá trị:**
1. `pickupTime` prop có giá trị → dùng prop
2. `cartItems.timeLeftTakeOut` có giá trị → dùng cart
3. Không có gì → set `"0"`, gọi `addDraftPickupTime(0)`

---

### 5.4. Store actions (update flow)

| Action | Mô tả |
|---|---|
| `setDraftType(type)` | Đặt type trong draft; xóa table nếu TAKE_OUT, xóa `timeLeftTakeOut` nếu AT_TABLE |
| `addDraftPickupTime(time)` | Ghi `timeLeftTakeOut` vào `updatingData.updateDraft` |
| `removeDraftPickupTime()` | Xóa `timeLeftTakeOut` khỏi `updatingData.updateDraft` |

Tất cả đều set `hasChanges = true` (trừ `addDraftPickupTime` / `removeDraftPickupTime`).

---

### 5.5. API cập nhật

`PATCH /orders/:slug`

```json
{
  "type": "take-out",
  "timeLeftTakeOut": 30
}
```

**Backend validate `UpdateOrderRequestDto`:**
- `timeLeftTakeOut` là **bắt buộc** (khác với create là optional)
- Đơn hàng phải ở trạng thái `PENDING` mới được cập nhật

---

## 6. So Sánh Xử Lý Theo Loại Đơn Hàng

| | `TAKE_OUT` | `AT_TABLE` | `DELIVERY` |
|---|---|---|---|
| `table` | `null` | Bắt buộc có | `null` |
| `timeLeftTakeOut` | Theo lựa chọn (0–60) | Luôn = `0` | Không dùng |
| `deliveryTo` | `null` | `null` | Bắt buộc có |
| `deliveryPhone` | `null` | `null` | Bắt buộc có |
| `deliveryFee` | `0` | `0` | Tính theo khoảng cách |
| Hiển thị pickup time UI | Có | Không | Không |

---

## 7. State Management (Zustand Store)

File: [order-flow.store.ts](../app/order-ui/src/stores/order-flow.store.ts)

```
IOrderingData {
  type: OrderTypeEnum          ← loại đơn hàng
  timeLeftTakeOut?: number     ← thời gian lấy hàng
  table?: string               ← slug bàn (xóa khi chọn TAKE_OUT)
  tableName?: string
  ...
}
```

**Actions liên quan:**

| Action | Mô tả |
|---|---|
| `setOrderingType(type)` | Đặt loại đơn, tự clear `table`/`tableName` nếu là TAKE_OUT |
| `addPickupTime(time)` | Đặt `timeLeftTakeOut` trong `orderingData` |
| `removePickupTime()` | Xóa `timeLeftTakeOut` khỏi `orderingData` |
| `addDraftPickupTime(time)` | Tương tự nhưng cho update flow (draft) |
| `removeDraftPickupTime()` | Tương tự nhưng cho update flow (draft) |

---

## 8. Sơ Đồ Luồng Tổng Hợp

```
Trang giỏ hàng (cart page)
      │
      ▼
[OrderTypeSelect]
  Options: Tại bàn / Mang đi / Giao hàng (nếu đủ điều kiện)
  Feature flag filter → loại bị khóa không hiển thị
      │
      ├── Chọn AT_TABLE → [TableInCartSelect] hiện ra
      │
      ├── Chọn DELIVERY → [MapAddressSelector] hiện ra
      │
      └── Chọn TAKE_OUT ──────────────────────────────┐
                │                                      │
                ▼                                      │
        setOrderingType(TAKE_OUT)                      │
        → clear table & tableName                      │
                │                                      │
                ▼                                      │
        [PickupTimeSelect] hiển thị ←──────────────────┘
          Options: 0 / 5 / 10 / 15 / 30 / 45 / 60 phút
          Default = 0 (Ngay lập tức)
                │
                ▼
        addPickupTime(minutes)
        → orderingData.timeLeftTakeOut = minutes
                │
                ▼
        Nhấn "Đặt hàng"
                │
                ▼
        POST /orders  { type: "take-out", timeLeftTakeOut: X, ... }
                │
                ▼
        BE: validateFeatureFlag(TAKE_OUT)
            order.table = null
            order.timeLeftTakeOut = X
            order.deliveryTo = null
            ...
            Lưu database
```

---

## 9. So Sánh Create vs Update

| | Create Order | Update Order |
|---|---|---|
| `timeLeftTakeOut` (BE) | Optional | **Bắt buộc** |
| Store action chọn type | `setOrderingType` | `setDraftType` |
| Store action pickup time | `addPickupTime` | `addDraftPickupTime` |
| Xóa `timeLeftTakeOut` khi chọn AT_TABLE | **Không** | **Có** |
| Đọc `orderType` để render pickup time | Từ `cartItems.type` | Từ **prop** `orderType` |
| Chống vòng lặp sync props | Không | Có (`isUpdatingFromProps` flag) |
| State lưu | `orderingData` | `updatingData.updateDraft` |
| `hasChanges` tracking | Không | Có |

---

## 10. Validation Tổng Hợp

| Ràng buộc | Phía | Mô tả |
|---|---|---|
| `type` bắt buộc | BE | `@IsEnum(OrderType)` |
| `timeLeftTakeOut` phải là giá trị cố định | BE | `@IsIn([0,5,10,15,30,45,60])` |
| `timeLeftTakeOut` optional khi tạo | BE | `@IsOptional()` trong `CreateOrderRequestDto` |
| `timeLeftTakeOut` bắt buộc khi update | BE | Không có `@IsOptional()` trong `UpdateOrderRequestDto` |
| Đơn phải ở trạng thái `PENDING` | BE | Kiểm tra trước khi update |
| Feature flag TAKE_OUT | BE + FE | Nếu bị khóa thì không cho chọn |
| Khách vãng lai không được dùng DELIVERY | BE | Kiểm tra `default-customer` |
| Pickup time chỉ hiển thị cho TAKE_OUT | FE | Component `return null` nếu không phải TAKE_OUT |
