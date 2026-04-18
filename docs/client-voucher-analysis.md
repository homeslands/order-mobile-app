# Phân tích logic: ClientVoucherListSheetInUpdateOrderWithLocalStorage

**File:** `app/order-ui/src/components/app/sheet/client-voucher-list-sheet-in-update-order-with-local-storage.tsx`

---

## 1. Tổng quan

Component hiển thị danh sách voucher cho **khách hàng** khi cập nhật đơn hàng. Voucher được lưu local (zustand store) thay vì gọi API cập nhật trực tiếp. Chỉ cho phép áp dụng **tối đa 1 voucher** cho mỗi đơn hàng.

---

## 2. Phân loại người dùng (Owner)

Component xác định 2 loại khách hàng dựa trên `orderDraft`:

| Loại                         | Điều kiện                                                                            | Biến                       |
| ---------------------------- | ------------------------------------------------------------------------------------ | -------------------------- |
| **Khách có tài khoản**       | `owner` tồn tại, `ownerRole === CUSTOMER`, `ownerPhoneNumber !== 'default-customer'` | `isCustomerOwner = true`   |
| **Khách vãng lai (default)** | `owner` tồn tại, `ownerRole === CUSTOMER`, `ownerPhoneNumber === 'default-customer'` | `isDefaultCustomer = true` |

---

## 3. Nguồn dữ liệu voucher (API)

Tùy loại khách hàng, component gọi **API khác nhau**:

| Case                                       | API Hook                    | Điều kiện kích hoạt                       |
| ------------------------------------------ | --------------------------- | ----------------------------------------- |
| Khách có tài khoản (`isCustomerOwner`)     | `useVouchersForOrder`       | `sheetOpen && isCustomerOwner`            |
| Khách vãng lai / khác (`!isCustomerOwner`) | `usePublicVouchersForOrder` | `sheetOpen && !isCustomerOwner`           |
| Tìm voucher theo mã code                   | `useSpecificVoucher`        | `sheetOpen && selectedVoucher` không rỗng |

### Tham số gửi lên API (`debouncedVoucherForOrderRequestParam`)

```ts
{
  hasPaging: true,
  page: currentPage,
  size: pagination.pageSize,
  user: isCustomerOwner ? orderDraft.owner : undefined,  // Chỉ gửi user nếu có tài khoản
  paymentMethod: paymentMethod || undefined,
  minOrderValue: debouncedMinOrderValue,
  orderItems: nonGiftOrderItems.map(item => ({
    quantity, variant, promotion, order
  }))
}
```

- `minOrderValue` = subTotalBeforeDiscount - promotionDiscount (tổng tiền sau khuyến mãi, trước voucher)
- `nonGiftOrderItems`: lọc bỏ các item là quà tặng (`isGift`)
- Tất cả đều được **debounce 800ms** để tránh spam API khi user chỉnh sửa đơn hàng

---

## 4. Quản lý danh sách voucher local (`localVoucherList`)

### 4.1. Khi mở sheet

- Reset `currentPage = 1`, `hasMore = true`, `localVoucherList = []`
- React Query tự động fetch khi `enabled` chuyển từ `false` → `true`

### 4.2. Tích lũy voucher từ nhiều trang (pagination)

- **Page 1 hoặc list rỗng**: Thay thế toàn bộ list
- **Page > 1**: Append thêm vào list hiện tại, loại bỏ trùng lặp theo `slug`

### 4.3. Các nguồn voucher được merge vào list

Ngoài data từ API, list còn bổ sung:

1. **Voucher tìm kiếm** (`specificVoucher`): Nếu user nhập code, voucher tìm được sẽ được thêm vào đầu list
2. **Voucher đang áp dụng** (`orderDraft.voucher`): Luôn hiển thị trong list dù API không trả về
3. **Voucher đã bị gỡ** (`removedVouchers`): Giữ lại trong list để user có thể chọn lại

### 4.4. Reset khi filter thay đổi

Khi `minOrderValue`, `orderItems`, `paymentMethod`, hoặc `isCustomerOwner` thay đổi → reset về page 1.

---

## 5. Logic áp dụng / gỡ voucher (`handleToggleVoucher`)

### 5.1. Áp dụng voucher (Apply)

```
1. Kiểm tra orderDraft và originalOrder tồn tại
2. Nếu voucher yêu cầu xác thực (isVerificationIdentity) nhưng không có owner → lỗi 1004
3. Gọi API validateVoucher với params: { voucher slug, user, orderItems }
4. Nếu validate thành công:
   - addVoucher(voucher) → lưu vào store
   - setAppliedVoucher(slug)
   - Xóa voucher khỏi removedVouchers
   - Đóng sheet
   - Hiển thị toast thành công
5. Nếu validate thất bại → hiển thị lỗi
```

### 5.2. Gỡ voucher (Remove)

```
1. removeVoucher() → xóa khỏi store
2. Clear appliedVoucher và selectedVoucher
3. Thêm voucher vào removedVouchers (để user có thể chọn lại)
4. removeDraftVoucher() → xóa khỏi draft
```

> **Lưu ý**: Phần gọi API `updateVoucherInOrder` đã bị comment out. Hiện tại chỉ cập nhật local store.

---

## 6. Auto-check voucher validity (tự động gỡ voucher)

Khi `orderItems` thay đổi (sau debounce 800ms), component kiểm tra voucher đang áp dụng có còn hợp lệ không:

### Các điều kiện gỡ tự động

| Điều kiện                 | Mô tả                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **ALL_REQUIRED**          | Tất cả sản phẩm trong giỏ phải nằm trong `voucherProducts`. Nếu có sản phẩm nào **không thuộc** voucher → gỡ    |
| **AT_LEAST_ONE_REQUIRED** | Ít nhất 1 sản phẩm trong giỏ phải nằm trong `voucherProducts`. Nếu **không có sản phẩm nào** thuộc voucher → gỡ |
| **minOrderValue**         | Tổng tiền sau promotion < `minOrderValue` của voucher (trừ type `SAME_PRICE_PRODUCT`) → gỡ                      |
| **maxItems**              | Tổng số lượng items (không tính quà tặng) > `maxItems` của voucher → gỡ                                         |

### Flow

```
orderItems thay đổi
  → debounce 800ms
    → so sánh orderItemsKey với debouncedOrderItemsKey
      → nếu khớp (user đã dừng chỉnh sửa) → chạy validation
        → nếu shouldRemove = true → gọi handleToggleVoucher để gỡ voucher
```

---

## 7. Validation voucher (`isVoucherValid`)

Hàm kiểm tra voucher có hợp lệ để hiển thị ở khu vực "Voucher hợp lệ" hay "Voucher không khả dụng":

| Check               | Chi tiết                                                                            |
| ------------------- | ----------------------------------------------------------------------------------- |
| **Đang áp dụng?**   | Nếu voucher đang được áp dụng → luôn trả `true` (bỏ qua validation)                 |
| **isActive**        | Voucher phải đang active                                                            |
| **Hết hạn**         | `endDate + 30 phút` < now → hết hạn (grace period 30 phút)                          |
| **Remaining usage** | `remainingUsage > 0`                                                                |
| **Min order value** | `minOrderValue <= subTotal - promotionDiscount` (trừ type `SAME_PRICE_PRODUCT`)     |
| **Valid date**      | `7:00 sáng hôm nay <= endDate`                                                      |
| **Identity**        | Nếu `isVerificationIdentity = true` → owner phải là `CUSTOMER` có tài khoản         |
| **Products**        | Phải có `voucherProducts` và sản phẩm trong giỏ phải match theo `applicabilityRule` |

---

## 8. Error messages (`getVoucherErrorMessage`)

Trả về thông báo lỗi đầu tiên tìm thấy (theo thứ tự ưu tiên):

| #   | Điều kiện                                                                                | Message                               |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | `isVerificationIdentity && !isCustomerOwner`                                             | Cần xác thực danh tính                |
| 2   | `endDate + 30min < now`                                                                  | Voucher đã hết hạn                    |
| 3   | `remainingUsage === 0` và voucher **không đang áp dụng**                                 | Hết lượt sử dụng                      |
| 4   | `type !== SAME_PRICE_PRODUCT` và `minOrderValue > subTotalAfterPromotion`                | Chưa đạt giá trị đơn tối thiểu        |
| 5   | `applicabilityRule === ALL_REQUIRED` và giỏ có sản phẩm không thuộc voucher              | Yêu cầu chỉ chứa sản phẩm áp dụng     |
| 6   | `applicabilityRule === AT_LEAST_ONE_REQUIRED` và giỏ không có sản phẩm nào thuộc voucher | Yêu cầu có ít nhất 1 sản phẩm áp dụng |

---

## 9. Hiển thị UI

### 9.1. Phân vùng voucher

Danh sách được chia 2 nhóm:

1. **Voucher hợp lệ** (`validVouchers`): Hiển thị trước, có nút "Sử dụng" / "Gỡ"
2. **Voucher không khả dụng** (`invalidVouchers`): Hiển thị sau, mờ đi (opacity), **không có nút áp dụng**

### 9.2. Voucher card

Mỗi card hiển thị:

- Tiêu đề voucher
- Giá trị đơn tối thiểu
- Thông báo lỗi (nếu có)
- Thanh progress lượt sử dụng còn lại (%)
- Badge thời gian hết hạn (countdown)
- Tooltip/Popover điều kiện chi tiết (responsive: Tooltip trên desktop, Popover trên mobile)

### 9.3. Trạng thái visual

| Trạng thái                            | Style                             |
| ------------------------------------- | --------------------------------- |
| Đang được chọn                        | `bg-primary/10`, `border-primary` |
| Hết lượt sử dụng (không đang áp dụng) | `opacity-50`                      |
| Không hợp lệ (không đang áp dụng)     | `opacity-60` + overlay mờ         |

### 9.4. Tìm kiếm voucher

- Input nhập mã voucher → trigger `useSpecificVoucher` → thêm vào đầu danh sách

### 9.5. Load more (Pagination)

- Nút "Tải thêm" xuất hiện khi `hasMore = true`
- Click → tăng `currentPage` → fetch thêm data → append vào list

---

## 10. Payment method logic

```ts
const paymentMethod =
  orderDraft?.paymentMethod ?? // Ưu tiên: method từ đơn hàng draft
  voucher?.voucherPaymentMethods[0].paymentMethod ?? // Fallback: method đầu tiên của voucher
  undefined
```

Payment method được gửi kèm trong API request để lọc voucher phù hợp.

---

## 11. Các effect lifecycle

| Effect                            | Trigger                                                           | Hành động                                |
| --------------------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| Sheet mở                          | `sheetOpen = true`                                                | Reset pagination, clear list             |
| Filter thay đổi                   | `minOrderValue`, `orderItems`, `paymentMethod`, `isCustomerOwner` | Reset về page 1                          |
| `orderDraft.voucher` thay đổi     | voucher được set/remove                                           | Sync `selectedVoucher`, `appliedVoucher` |
| Sheet mở + voucher private        | `sheetOpen && voucher.isPrivate`                                  | Refetch specific voucher                 |
| Sheet đóng                        | `sheetOpen = false`                                               | Clear `removedVouchers`                  |
| `specificVoucher` data trả về     | API trả kết quả                                                   | Thêm vào `localVoucherList`              |
| Voucher list data trả về          | API trả kết quả (page N)                                          | Merge vào `localVoucherList`             |
| `orderItems` thay đổi (debounced) | Sau 800ms ngừng chỉnh sửa                                         | Auto-check validity, gỡ voucher nếu cần  |

---

## 12. Sơ đồ flow tổng quan

```
[User mở sheet]
     │
     ▼
[Reset state: page=1, list=[]]
     │
     ▼
[Xác định loại khách hàng]
     │
     ├── isCustomerOwner ──→ useVouchersForOrder (có param user)
     │
     └── !isCustomerOwner ─→ usePublicVouchersForOrder (không param user)
     │
     ▼
[Merge voucher list: API + specificVoucher + draftVoucher + removedVouchers]
     │
     ▼
[Phân loại: valid / invalid]
     │
     ▼
[Hiển thị: valid trước (có nút), invalid sau (mờ, không nút)]
     │
     ▼
[User chọn voucher]
     │
     ├── Gỡ voucher ──→ removeVoucher() + thêm vào removedVouchers
     │
     └── Áp dụng voucher
          │
          ├── Cần xác thực nhưng không có owner → Lỗi 1004
          │
          └── validateVoucher API
               │
               ├── Thành công → addVoucher + đóng sheet
               │
               └── Thất bại → Hiển thị lỗi
```
