# Phân tích Flow cập nhật đơn hàng (Update Order)

**Các file chính:**

| Nhóm | File |
|------|------|
| **Store** | `order-ui/src/stores/order-flow.store.ts` |
| **Trang Staff** | `order-ui/src/app/system/update-order/page.tsx` |
| **Trang Client** | `order-ui/src/app/client/update-order/page.tsx` |
| **UI Staff** | `order-ui/src/app/system/update-order/components/update-order-content.tsx` |
| **UI Client** | `order-ui/src/app/client/update-order/components/client-update-order-content.tsx` |
| **Dialog Staff** | `order-ui/src/components/app/dialog/staff-confirm-update-order-dialog.tsx` |
| **Dialog Client** | `order-ui/src/components/app/dialog/client-confirm-update-order-dialog.tsx` |
| **Utility so sánh** | `order-ui/src/utils/order-comparison.ts` |
| **API hooks** | `order-ui/src/hooks/use-order.ts` |

---

## 1. Tổng quan kiến trúc

Flow cập nhật đơn hàng sử dụng mô hình **two-copy state**:

```
[Server data]
     │
     ▼
initializeUpdating()
     │
     ├── originalOrder  → Bản gốc bất biến (so sánh để detect changes)
     │
     └── updateDraft    → Bản làm việc (user thao tác trên đây)
```

Mọi thay đổi của user đều chỉ tác động vào `updateDraft`. Khi confirm, so sánh với `originalOrder` để xác định những gì cần gọi API.

---

## 2. Cấu trúc dữ liệu trong Store

### `IUpdatingData`

| Field | Type | Mô tả |
|-------|------|--------|
| `originalOrder` | `IOrder` | Bản sao gốc từ server, bất biến |
| `updateDraft` | `IOrderToUpdate` | Bản làm việc, thay đổi theo user |
| `hasChanges` | `boolean` | Cờ "dirty" - có thay đổi so với gốc không |

### `updateDraft` — các field được track

| Field | Mô tả |
|-------|--------|
| `orderItems[]` | Danh sách món (quantity + note) |
| `type` | Loại đơn: `AT_TABLE`, `TAKE_OUT`, `DELIVERY` |
| `table` / `tableName` | Bàn (cho dine-in) |
| `timeLeftTakeOut` | Thời gian chờ lấy đơn (takeout) |
| `deliveryTo`, `deliveryAddress`, `deliveryPhone` | Thông tin giao hàng |
| `description` | Ghi chú đơn hàng |
| `voucher` | Voucher đã chọn |
| `owner`, `ownerPhoneNumber`, `ownerFullName` | Thông tin khách hàng |
| `paymentMethod` | Phương thức thanh toán |
| `deliveryFee`, `accumulatedPointsToUse` | Lấy từ đơn gốc |

---

## 3. Khởi tạo (Initialization)

### Entry points

- **Staff**: `/system/update-order?order=<slug>`
- **Client**: `/client/update-order?order=<slug>`

### Flow khởi tạo

```
[Trang load với ?order=<slug>]
     │
     ▼
[useOrderBySlug(slug)] → Fetch order từ API
     │
     ▼
[initializeUpdating(originalOrder)]
     │
     ├── Tạo bản gốc: originalOrder (bất biến)
     │
     └── Tạo bản draft: updateDraft (sao chép từ originalOrder)
          │
          └── hasChanges = false
```

### Đặc biệt — Staff: Bảo toàn thay đổi đang thực hiện

Staff có logic phức tạp khi data từ server cập nhật lại (polling/refetch): **không reset draft nếu user đang có thay đổi**.

```
[Server data cập nhật]
     │
     ▼
[Có updateDraft đang tồn tại?]
     │
     ├── Không → initializeUpdating() bình thường
     │
     └── Có (user đang edit)
          │
          ▼
     [Bảo toàn các giá trị user đã chỉnh:]
     - timeLeftTakeOut
     - type, description
     - voucher (nếu user đã chọn/gỡ)
     - quantity/note các item đang sửa
          │
          ▼
     [Merge với server data mới]
     (giữ thay đổi của user, cập nhật data mới từ server)
```

---

## 4. Quản lý món ăn (Order Items)

### 4.1. Thêm món (Staff only)

```typescript
addDraftItem(item: IOrderItem)
  → Tạo ID tạm: item_<timestamp>_<uuid>
  → Append vào orderItems
  → hasChanges = true
```

**Lưu ý**: Item mới có ID tạm thời. Server sẽ cấp slug vĩnh viễn khi gọi API.

### 4.2. Xóa món

```typescript
removeDraftItem(itemId: string)
  → Lọc bỏ item khỏi orderItems
  → hasChanges = true
```

**Edge case**: Nếu xóa item cuối cùng → hiện `DeleteLastOrderItemDialog` xác nhận.

### 4.3. Thay đổi số lượng

```typescript
updateDraftItemQuantity(itemId: string, quantity: number)
  → Cập nhật quantity của item khớp ID
  → hasChanges = true
```

### 4.4. Thêm ghi chú món

```typescript
addDraftNote(itemId: string, note: string)
  → Cập nhật note của item khớp ID
  → hasChanges = true
```

---

## 5. Quản lý loại đơn & địa điểm

### Thay đổi loại đơn

```typescript
setDraftType(type: OrderTypeEnum)
```

| Chuyển sang | Auto-clear |
|------------|-----------|
| `TAKE_OUT` | Xóa `table` |
| `AT_TABLE` | Xóa `timeLeftTakeOut` |
| `DELIVERY` | Không xóa gì |

### Thay đổi bàn (AT_TABLE)

```typescript
setDraftTable(table: ITable)
  → Set table.slug + table.name
  → Xóa timeLeftTakeOut
  → hasChanges = true
```

### Thay đổi giờ lấy (TAKE_OUT)

```typescript
addDraftPickupTime(time: number)
  → Set timeLeftTakeOut (phút)
  → 0 = lấy ngay
  → hasChanges = true
```

---

## 6. Quản lý Voucher

### Áp dụng voucher

```typescript
setDraftVoucher(voucher: IVoucher | null)
  → Lưu toàn bộ object voucher vào draft
  → hasChanges = true
```

### Tự động gỡ voucher

Khi số lượng items **vượt quá** `voucher.maxItems`:

```
[User thêm/tăng item]
     │
     ▼
[Kiểm tra: totalQuantity > voucher.maxItems?]
     │
     └── Có → removeDraftVoucher() + Toast cảnh báo
```

### Bảo toàn lựa chọn voucher (Staff)

Khi server data cập nhật, logic so sánh voucher draft vs server:

```
[Server trả về voucher mới]
     │
     ▼
[User đã thay đổi voucher trong draft?]
     │
     ├── Không → Dùng voucher từ server
     │
     └── Có → Giữ lựa chọn của user
              (kể cả khi user đã chủ động gỡ voucher)
```

---

## 7. Phát hiện thay đổi (Change Detection)

### Cờ `hasChanges`

Mỗi action trong store đều cập nhật `hasChanges` bằng cách so sánh JSON:

```typescript
const hasChanges = JSON.stringify(newDraft) !== JSON.stringify(originalDraft)
set({ updatingData: { ...updatingData, updateDraft: newDraft, hasChanges } })
```

### Utility `compareOrders()`

Dùng để phân tích chi tiết **cái gì** đã thay đổi (dùng trong confirmation dialog):

**Phân tích item changes:**

| Loại thay đổi | Mô tả |
|--------------|--------|
| `added` | Item mới chưa có trên server |
| `removed` | Item bị xóa khỏi draft |
| `quantity_changed` | Số lượng thay đổi |
| `orderItemNoteChanged` | Ghi chú món thay đổi |
| `unchanged` | Không thay đổi |

**Phân tích field changes:**

| Field | Detect khi |
|-------|-----------|
| `voucherChanged` | Slug voucher khác |
| `tableChanged` | Bàn thay đổi |
| `typeChanged` | Loại đơn thay đổi |
| `noteChanged` | Ghi chú đơn thay đổi |
| `pickupTimeChanged` | Giờ lấy thay đổi |
| `deliveryAddressChanged` | Địa chỉ giao thay đổi |
| `deliveryPhoneChanged` | SĐT giao thay đổi |
| `ownerChanged` | Khách hàng thay đổi |

---

## 8. Flow xác nhận & gửi (Submit)

### Thứ tự gọi API (CRITICAL)

Khi user bấm "Xác nhận cập nhật" trong dialog, các API được gọi **tuần tự theo thứ tự cố định**:

```
┌─────────────────────────────────────────────────────────────────┐
│  BƯỚC 1: Cập nhật loại đơn / bàn / ghi chú                     │
│  (nếu có thay đổi)                                              │
│  PUT /orders/{slug}                                             │
│  Payload: { type, table, description, timeLeftTakeOut, ...}     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  BƯỚC 2: Xóa các items bị remove                               │
│  DELETE /order-items/{slug}                                     │
│  (chạy song song cho từng item bị xóa)                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  BƯỚC 3: Thêm items mới                                         │
│  POST /order-items                                              │
│  → API trả về slug vĩnh viễn                                   │
│  → Lưu vào newItemSlugMap: { tempId → serverSlug }             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  BƯỚC 4: Cập nhật quantity (items đã tồn tại)                  │
│  PUT /order-items/{slug}                                        │
│  Payload: { action: 'increment' | 'decrement', quantity, note } │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  BƯỚC 5: Cập nhật note (bao gồm items mới từ bước 3)           │
│  PUT /order-items/{slug}/note                                   │
│  → Dùng newItemSlugMap để lấy đúng slug cho items mới          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  BƯỚC 6: Cập nhật voucher (CUỐI CÙNG)                          │
│  PUT /orders/{slug}/voucher                                     │
│  → Gửi sau cùng để validate trên danh sách item đã cố định     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  BƯỚC 7: Navigate đến trang thanh toán                          │
│  Staff:  /payment?order=<slug>                                  │
│  Client: /client/payment?order=<slug>                           │
└─────────────────────────────────────────────────────────────────┘
```

### Lý do thứ tự này

| Lý do | Giải thích |
|-------|-----------|
| **Xóa trước khi thêm** | Tránh conflict nếu server giới hạn số lượng item |
| **Thêm trước khi update qty** | Item mới cần có slug trên server trước |
| **Note sau khi thêm** | Item mới dùng slug từ newItemSlugMap |
| **Voucher cuối cùng** | Cần biết danh sách item final để validate `minOrderValue`, `maxItems`, `voucherProducts` |

### `newItemSlugMap` — tại sao cần?

```
[Thêm item mới]
  → ID tạm: "item_1234567_abc"
  → Gọi POST /order-items
  → Server trả về slug: "order-item-xyz"

[Cập nhật note cho item đó]
  → Phải dùng slug "order-item-xyz" (không dùng ID tạm)
  → newItemSlugMap["item_1234567_abc"] = "order-item-xyz"
```

---

## 9. Tính toán giá (Price Calculation)

### Thứ tự áp dụng giảm giá

```
Giá gốc (original)
     │ -promotion discount (per item)
     ▼
Giá sau promotion
     │ -voucher discount (order level)
     ▼
Giá sau voucher
     │ -accumulated points
     ▼
Giá cuối (final total)
```

### Các loại voucher

| Type | Cách tính |
|------|-----------|
| `SAME_PRICE_PRODUCT` | Tất cả sản phẩm match → giá cố định |
| `PERCENT_ORDER` | Giảm % trên tổng đơn |
| `FIXED_VALUE` | Giảm số tiền cố định |
| `AT_LEAST_ONE_REQUIRED` | Chỉ cần 1 sản phẩm match |
| `ALL_REQUIRED` | Tất cả sản phẩm phải match |

### Promotion: Tự động cập nhật

Promotion **không cần gọi API riêng** — backend tự tính lại dựa trên item list sau mỗi thay đổi.

---

## 10. So sánh Staff vs Client

| Tính năng | Staff | Client |
|-----------|:-----:|:------:|
| Thêm món mới | ✅ | ❌ |
| Xóa món | ✅ | ✅ |
| Thay đổi số lượng | ✅ | ✅ |
| Thêm ghi chú món | ✅ | ✅ |
| Thay đổi loại đơn | ✅ | ✅ |
| Thay đổi bàn | ✅ (trực tiếp) | ✅ (qua menu) |
| Thay đổi giờ lấy (takeout) | ✅ | ✅ |
| Thay đổi khách hàng | ✅ | ❌ |
| Thay đổi approval | ✅ | ❌ |
| Đổi voucher | ✅ | ✅ |
| Bảo toàn draft khi refetch | ✅ (phức tạp) | ❌ (reset đơn giản) |
| Dialog xác nhận | `StaffConfirmUpdateOrderDialog` | `ClientConfirmUpdateOrderDialog` |

---

## 11. Store Actions tổng hợp

### Set actions (trực tiếp)

| Action | Mô tả |
|--------|--------|
| `setDraftType(type)` | Thay loại đơn |
| `setDraftTable(table)` | Thay bàn |
| `setDraftDescription(desc)` | Thay ghi chú đơn |
| `setDraftVoucher(voucher)` | Set/xóa voucher |
| `setDraftPaymentMethod(method)` | Thay PTTT |
| `setDraftDeliveryAddress(addr)` | Thay địa chỉ giao |
| `setDraftDeliveryPhone(phone)` | Thay SĐT giao |
| `addDraftPickupTime(time)` | Set giờ lấy |

### Item actions

| Action | Mô tả |
|--------|--------|
| `addDraftItem(item)` | Thêm món mới (tạo ID tạm) |
| `removeDraftItem(id)` | Xóa món theo ID |
| `updateDraftItemQuantity(id, qty)` | Cập nhật số lượng |
| `updateDraftItem(id, changes)` | Merge thay đổi vào item |
| `addDraftNote(id, note)` | Cập nhật ghi chú món |

### Batch/reset actions

| Action | Mô tả |
|--------|--------|
| `setUpdateDraft(draft)` | Thay toàn bộ draft + recalc hasChanges |
| `resetDraftToOriginal()` | Revert về original |
| `clearUpdatingData()` | Xóa toàn bộ updating phase |

---

## 12. API Endpoints

| Action | Method | Endpoint | Hook |
|--------|--------|----------|------|
| Thêm item mới | POST | `/order-items` | `useAddNewOrderItem()` |
| Cập nhật quantity | PUT | `/order-items/{slug}` | `useUpdateOrderItem()` |
| Cập nhật note | PUT | `/order-items/{slug}/note` | `useUpdateNoteOrderItem()` |
| Xóa item | DELETE | `/order-items/{slug}` | `useDeleteOrderItem()` |
| Cập nhật type/table/desc | PUT | `/orders/{slug}` | `useUpdateOrderType()` |
| Cập nhật voucher | PUT | `/orders/{slug}/voucher` | `useUpdateVoucherInOrder()` |

---

## 13. Edge Cases

### Xóa item cuối cùng

```
[User xóa item cuối]
     │
     ▼
[Hiện DeleteLastOrderItemDialog]
     │
     ├── User xác nhận → Xóa + gọi API
     │
     └── User hủy → Không làm gì
```

### Voucher & maxItems

```
[Thêm item hoặc tăng quantity]
     │
     ▼
[totalQuantity (bỏ qua gift items) > voucher.maxItems?]
     │
     └── Có → removeDraftVoucher() + Toast "Voucher vượt quá giới hạn số lượng"
```

### Voucher & xác thực danh tính

```
[Gỡ khách hàng khỏi đơn]
     │
     ▼
[Voucher có isVerificationIdentity = true?]
     │
     └── Có → Tự động gỡ voucher (không thể dùng voucher cần xác thực khi không có owner)
```

### Item mới và slug tạm

```
Trong draft:   ID tạm "item_1706789123_abc-def"
Sau khi POST:  Server slug "oi-xyz123456"
Khi update note: Phải dùng "oi-xyz123456" (từ newItemSlugMap)
```

### Order hết hạn trong khi đang update

```
[Polling phát hiện order status = expired/cancelled]
     │
     ▼
[Hiện thông báo]
     │
     ▼
[clearUpdatingData() → Navigate về trang chủ]
```

---

## 14. Sơ đồ flow tổng quan

```
[Vào trang /update-order?order=<slug>]
     │
     ▼
[Fetch order từ API]
     │
     ▼
[initializeUpdating()] → Tạo originalOrder + updateDraft
     │
     ▼
[User thao tác trên UI]
     │
     ├── Thêm/xóa/sửa món ────────────→ addDraftItem / removeDraftItem / updateDraftItemQuantity
     │
     ├── Thay loại đơn/bàn/giờ lấy ──→ setDraftType / setDraftTable / addDraftPickupTime
     │
     ├── Thêm ghi chú ────────────────→ setDraftDescription / addDraftNote
     │
     └── Chọn voucher ───────────────→ setDraftVoucher
                                        (auto-remove nếu maxItems exceeded)
     │
     ▼
[hasChanges = true → Nút "Cập nhật" active]
     │
     ▼
[Mở Confirm Dialog]
     │  compareOrders() → Hiển thị diff cho user review
     │
     ▼
[User xác nhận]
     │
     ▼
[Gọi API theo thứ tự:]
  1. Update type/table/desc
  2. Delete removed items
  3. Add new items → capture newItemSlugMap
  4. Update quantities
  5. Update notes (dùng newItemSlugMap cho items mới)
  6. Update voucher (CUỐI CÙNG)
     │
     ▼
[Navigate → Trang thanh toán]
```
