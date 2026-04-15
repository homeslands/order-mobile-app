# Phân tích chi tiết Flow thanh toán Client

**Các file chính:**
- `app/order-ui/src/app/client/payment/page.tsx` — Trang thanh toán chính
- `app/order-ui/src/stores/order-flow.store.ts` — Store quản lý flow đơn hàng
- `app/order-ui/src/utils/payment-resolver.ts` — Logic xác định phương thức thanh toán khả dụng
- `app/order-ui/src/hooks/use-order.ts` — Hooks API đơn hàng & thanh toán
- `app/order-ui/src/hooks/use-voucher.ts` — Hooks validate voucher

---

## 1. Tổng quan

Flow thanh toán client bắt đầu sau khi đơn hàng được tạo. User được redirect đến trang `/client/payment?order=<slug>` với đồng hồ đếm ngược **15 phút**. Flow hỗ trợ cả **khách đăng nhập** và **khách vãng lai**.

---

## 2. Cấu trúc dữ liệu Payment Phase

### `IPaymentData` (trong Order Flow Store)

| Field | Type | Mô tả |
|-------|------|--------|
| `orderSlug` | `string` | Mã đơn hàng |
| `paymentMethod` | `PaymentMethod` | Phương thức thanh toán đã chọn |
| `transactionId` | `string?` | Mã giao dịch (cho thẻ tín dụng / membership card) |
| `qrCode` | `string` | Hình ảnh QR code cho chuyển khoản |
| `paymentSlug` | `string` | Mã tham chiếu thanh toán |
| `orderData` | `IOrder?` | Dữ liệu đơn hàng cache từ API |
| `paymentAmount` | `number?` | Số tiền thanh toán |
| `isQrValid` | `boolean` | Cờ xác nhận QR code hợp lệ |

### Actions của Store

| Action | Mô tả |
|--------|--------|
| `initializePayment(orderSlug, paymentMethod)` | Khởi tạo thanh toán |
| `updatePaymentMethod(method, transactionId?)` | Cập nhật phương thức |
| `updateQrCode(qrCode)` | Cập nhật QR code (có validate) |
| `setOrderFromAPI(order)` | Đồng bộ order từ API (giữ QR nếu API không trả) |
| `setPaymentSlug(slug)` | Set mã tham chiếu thanh toán |
| `clearPaymentData()` | Xóa dữ liệu, reset về bước ORDERING |

---

## 3. Phương thức thanh toán theo vai trò

### Payment Method Constants

| Constant | Giá trị |
|----------|---------|
| `PaymentMethod.BANK_TRANSFER` | `'bank-transfer'` |
| `PaymentMethod.CASH` | `'cash'` |
| `PaymentMethod.POINT` | `'point'` |
| `PaymentMethod.CREDIT_CARD` | `'credit-card'` |

### Phương thức khả dụng theo Role

| Role | Phương thức khả dụng |
|------|---------------------|
| **CUSTOMER** (đăng nhập) | `BANK_TRANSFER`, `POINT` |
| **STAFF / ADMIN** | `BANK_TRANSFER`, `CASH`, `CREDIT_CARD`, `POINT` |
| **Khách vãng lai** (không đăng nhập) | `BANK_TRANSFER` |

---

## 4. Payment Resolver (`paymentResolver`)

Utility xác định phương thức thanh toán khả dụng dựa trên nhiều yếu tố:

### Input
- User role
- Voucher hiện tại (nếu có)
- Phương thức thanh toán hiện tại

### Output

| Field | Mô tả |
|-------|--------|
| `effectiveMethods` | Các phương thức khả dụng cho đơn hàng + user hiện tại |
| `defaultMethod` | Phương thức đề xuất mặc định |
| `disabledMethods` | Phương thức bị vô hiệu hóa + lý do |
| `payButtonEnabled` | Có cho phép bấm thanh toán không |
| `bannerMessage` | Thông báo cảnh báo nếu không có phương thức nào khả dụng |

### Logic lọc

```
1. Lấy danh sách phương thức theo role
2. Nếu voucher có ràng buộc paymentMethod:
   → Lọc chỉ giữ phương thức voucher cho phép
3. Nếu không còn phương thức nào:
   → payButtonEnabled = false
   → bannerMessage = cảnh báo
4. Trả về defaultMethod:
   → Ưu tiên: voucher method > store method > role default > BANK_TRANSFER
```

---

## 5. Khởi tạo trang thanh toán

### Flow khởi tạo

```
[User đến trang /client/payment?order=<slug>]
     │
     ▼
[useOrderBySlug(slug)] ── Fetch order từ API
     │
     ▼
[initializePayment(orderSlug, defaultPaymentMethod)]
     │  ↳ defaultMethod = voucher method > store method > role default > BANK_TRANSFER
     │
     ▼
[Bắt đầu đồng hồ đếm ngược 15 phút]
     │
     ▼
[Render: Thông tin đơn hàng + Chọn phương thức + Voucher + Loyalty points]
```

### Thông tin hiển thị trên trang

- Tên khách hàng, số điện thoại, ngày đặt
- Phương thức giao hàng, bàn, thời gian nhận, địa chỉ
- Danh sách sản phẩm với giá gốc, giảm giá promotion, giảm giá voucher
- Loyalty points (nếu có)
- Phí giao hàng
- **Tổng cộng cuối cùng**

---

## 6. Chọn phương thức thanh toán

### Component: `ClientPaymentMethodSelect`

**Hiển thị:**
- Radio group các phương thức khả dụng
- QR code hiển thị bên cạnh `BANK_TRANSFER` (nếu tổng tiền >= 2.000đ)
- Phương thức bị disable hiện lý do

### Flow khi chọn phương thức

```
[User chọn phương thức mới]
     │
     ▼
[Kiểm tra voucher có tương thích không?]
     │
     ├── Tương thích → updatePaymentMethod(method)
     │
     └── Không tương thích
          │
          ▼
     [Hiện dialog "Remove Voucher When Paying"]
          │
          ├── User chọn "Xóa voucher"
          │   → Gỡ voucher khỏi đơn
          │   → Cập nhật phương thức mới
          │   → Refetch order
          │
          └── User chọn "Hủy"
              → Giữ nguyên phương thức cũ
```

### Dialog xóa voucher khi thanh toán

Có 2 phiên bản:
- `ClientRemoveVoucherWhenPayingDialog` — cho khách đăng nhập
- `ClientNoLoginRemoveVoucherWhenPayingDialog` — cho khách vãng lai

**Trigger**: Khi user chọn phương thức không tương thích với voucher đang áp dụng.

---

## 7. Voucher trong trang thanh toán

### Component: `ClientVoucherListSheetInPayment`

**Khác biệt so với voucher sheet khi tạo đơn:**
- Gọi API cập nhật voucher trực tiếp lên server (không chỉ local)
- Trigger `onSuccess` callback để parent refetch order

### Flow

```
[User mở voucher sheet]
     │
     ▼
[Fetch voucher dựa trên:]
  - Phương thức thanh toán hiện tại
  - Giá trị đơn tối thiểu
  - Trạng thái đăng nhập (logged-in vs public)
     │
     ▼
[User chọn/gỡ voucher]
     │
     ▼
[Gọi API cập nhật voucher cho đơn hàng]
  - useUpdateVoucherInOrder (đăng nhập)
  - useUpdatePublicVoucherInOrder (vãng lai)
     │
     ▼
[Callback onSuccess → refetchOrder → reinitialize payment]
```

---

## 8. Loyalty Points (Điểm thưởng)

### Component: `ClientLoyaltyPointSelector`

**Chỉ hiển thị cho khách đăng nhập.**

### Tính năng

| Tính năng | Mô tả |
|-----------|--------|
| Toggle "Dùng tất cả" | Áp dụng toàn bộ điểm khả dụng |
| Nhập thủ công | Nhập số điểm muốn dùng (khi không chọn "tất cả") |
| Hiển thị | Điểm khả dụng vs. điểm tối đa có thể dùng |
| Tính toán real-time | Giảm trực tiếp vào tổng thanh toán |

### Hooks sử dụng

| Hook | Mô tả |
|------|--------|
| `useApplyLoyaltyPoint()` | Áp dụng điểm vào đơn hàng |
| `useCancelReservationForOrder()` | Hủy reservation điểm đã đặt |

---

## 9. Đồng hồ đếm ngược (Order Countdown)

### Component: `OrderCountdown`

| Thuộc tính | Giá trị |
|------------|---------|
| Thời gian | **15 phút** (900 giây) từ lúc tạo đơn |
| UI | Draggable, có thể kéo thả vị trí |

### Khi hết thời gian

```
[Countdown = 0]
     │
     ▼
[setIsExpired(true)] → callback lên parent
     │
     ▼
[clearPaymentData()] → xóa store thanh toán
     │
     ▼
[Navigate → /menu hoặc /order-success]
```

---

## 10. Flow thanh toán chính (Initiate Payment)

### Phân nhánh theo trạng thái đăng nhập

| Trạng thái | API Hook | Endpoint |
|------------|----------|----------|
| Đã đăng nhập | `useInitiatePayment()` | `POST /payment/initiate` |
| Vãng lai | `useInitiatePublicPayment()` | `POST /payment/initiate/public` |

### Request body

```ts
{
  orderSlug: string,
  paymentMethod: PaymentMethod,
  transactionId?: string  // Chỉ cho CREDIT_CARD
}
```

### Flow theo từng phương thức

#### 10.1. BANK_TRANSFER (Chuyển khoản)

```
[User bấm "Xác nhận thanh toán"]
     │
     ▼
[Gọi API initiate payment]
     │
     ▼
[API trả về QR code (nếu tổng tiền >= 2.000đ)]
     │
     ▼
[updateQrCode(qrCode)] → Lưu vào store
     │
     ▼
[Hiển thị QR code + số tiền cho user]
     │
     ▼
[Bắt đầu polling refetchOrder() mỗi 2 giây]
     │
     ├── Nếu tổng tiền < 2.000đ:
     │   → Không có QR code
     │   → Vẫn polling chờ trạng thái
     │
     ▼
[Polling kiểm tra: order.payment.statusMessage === 'completed'?]
     │
     ├── Chưa completed → Tiếp tục polling
     │
     └── Completed
          │
          ▼
     [clearPaymentData()]
          │
          ▼
     [Navigate → /order-success/<slug>]
```

#### 10.2. CASH (Tiền mặt) — Chỉ STAFF/ADMIN

```
[User bấm "Xác nhận thanh toán"]
     │
     ▼
[Gọi API initiate payment]
     │
     ▼
[Thành công → Navigate ngay → /order-success/<slug>]
     │  (Không cần polling, không cần QR)
     │
     └── Thất bại → Hiển thị toast lỗi
```

#### 10.3. POINT (Điểm thưởng) — Chỉ CUSTOMER đăng nhập

```
[User bấm "Xác nhận thanh toán"]
     │
     ▼
[Gọi API initiate payment]
     │
     ▼
[Bắt đầu polling refetchOrder() mỗi 2 giây]
     │
     ▼
[Polling kiểm tra: order.payment.statusMessage === 'completed'?]
     │
     ├── Chưa completed → Tiếp tục polling
     │
     └── Completed → clearPaymentData() → Navigate → /order-success/<slug>
```

#### 10.4. CREDIT_CARD (Thẻ tín dụng) — Chỉ STAFF/ADMIN

```
[User nhập transactionId]
     │
     ▼
[User bấm "Xác nhận thanh toán"]
     │
     ▼
[Gọi API initiate payment (kèm transactionId)]
     │
     ▼
[Thành công → Navigate → /order-success/<slug>]
```

---

## 11. QR Code Management

### Điều kiện hiển thị QR

| Điều kiện | Bắt buộc |
|-----------|----------|
| Phương thức = `BANK_TRANSFER` | ✅ |
| QR code tồn tại và không rỗng | ✅ |
| `isQrValid = true` | ✅ |
| Số tiền QR khớp với subtotal | ✅ |
| Tổng tiền >= 2.000đ | ✅ |

### Quy tắc quản lý QR

- Dùng `ref` để tránh set QR code trùng lặp
- Khi polling, nếu API không trả QR → **giữ QR cũ** (không ghi đè)
- Validate: số tiền trên QR phải khớp với subtotal đơn hàng
- Nút "Download QR" cho phép lưu QR code

---

## 12. Polling (Kiểm tra trạng thái thanh toán)

### Cơ chế

| Thuộc tính | Giá trị |
|------------|---------|
| Interval | **2 giây** |
| Trigger | Sau khi initiate payment thành công |
| Áp dụng cho | `BANK_TRANSFER`, `POINT` |
| Không áp dụng | `CASH`, `CREDIT_CARD` (hoàn thành ngay) |

### Payment Status

| Status | Mô tả |
|--------|--------|
| `pending` | Đang chờ thanh toán |
| `completed` | Thanh toán thành công |
| `cancelled` | Đã hủy |

### Điều kiện dừng polling

```
polling dừng khi:
  - order.payment.statusMessage === 'completed' → Navigate đến success
  - Countdown hết hạn → Navigate về menu
  - User rời trang
```

---

## 13. Xử lý lỗi & Edge cases

### Voucher conflict

```
[Voucher có ràng buộc paymentMethod]
     │
     ├── User chọn phương thức không tương thích
     │   → Hiện dialog xác nhận gỡ voucher
     │
     └── Không có phương thức nào tương thích với voucher + role
         → payButtonEnabled = false
         → Hiện banner cảnh báo
```

### QR code edge cases

| Case | Xử lý |
|------|--------|
| Tổng tiền < 2.000đ | Không tạo QR, vẫn polling chờ xác nhận thủ công |
| QR amount ≠ subtotal | `isQrValid = false`, không hiển thị QR |
| API không trả QR trong lần polling | Giữ QR cũ |
| Set QR trùng lặp | Dùng ref chặn |

### Order hết hạn

```
[15 phút hết]
     │
     ▼
[clearPaymentData()] → Xóa toàn bộ dữ liệu thanh toán
     │
     ▼
[Navigate → /menu hoặc /order-success/<slug>]
```

### Payment thất bại

```
[API trả lỗi]
     │
     ▼
[Hiển thị toast lỗi]
     │
     ▼
[Reset loading state → User có thể thử lại]
```

---

## 14. So sánh flow Đăng nhập vs Vãng lai

| Tính năng | Đã đăng nhập | Vãng lai |
|-----------|:------------:|:--------:|
| Phương thức khả dụng | `BANK_TRANSFER`, `POINT` | `BANK_TRANSFER` |
| API thanh toán | `useInitiatePayment` | `useInitiatePublicPayment` |
| API cập nhật voucher | `useUpdateVoucherInOrder` | `useUpdatePublicVoucherInOrder` |
| API validate voucher PM | `useValidateVoucherPaymentMethod` | `useValidatePublicVoucherPaymentMethod` |
| Dialog gỡ voucher | `ClientRemoveVoucherWhenPayingDialog` | `ClientNoLoginRemoveVoucherWhenPayingDialog` |
| Loyalty points | ✅ Có | ❌ Không |
| QR code (chuyển khoản) | ✅ | ✅ |
| Thanh toán tiền mặt | ❌ (chỉ Staff/Admin) | ❌ |
| Thanh toán thẻ tín dụng | ❌ (chỉ Staff/Admin) | ❌ |

---

## 15. API Endpoints tổng hợp

| Endpoint | Method | Mô tả |
|----------|--------|--------|
| `/order/<slug>` | GET | Lấy thông tin đơn hàng |
| `/payment/initiate` | POST | Khởi tạo thanh toán (đăng nhập) |
| `/payment/initiate/public` | POST | Khởi tạo thanh toán (vãng lai) |
| `/order/<slug>/voucher` | POST | Cập nhật voucher đơn hàng (đăng nhập) |
| `/order/<slug>/voucher/public` | POST | Cập nhật voucher đơn hàng (vãng lai) |
| `/voucher/payment-methods/<slug>` | GET | Validate voucher tương thích payment method |
| `/payment/loyalty-points` | POST | Áp dụng loyalty points |

---

## 16. Sơ đồ flow tổng quan

```
[Trang thanh toán /client/payment?order=<slug>]
     │
     ▼
[Fetch order by slug] ──→ [initializePayment]
     │                         │
     ▼                         ▼
[Hiển thị thông tin đơn]   [Bắt đầu countdown 15 phút]
     │
     ▼
[paymentResolver: xác định phương thức khả dụng]
     │
     ├── Voucher conflict? ──→ Hiện dialog gỡ voucher
     │
     ▼
[User chọn phương thức thanh toán]
     │
     ├── BANK_TRANSFER
     │   │
     │   ▼
     │   [Initiate → QR code → Polling 2s → Completed → Success page]
     │
     ├── CASH (Staff/Admin only)
     │   │
     │   ▼
     │   [Initiate → Success → Navigate ngay]
     │
     ├── POINT (Customer only)
     │   │
     │   ▼
     │   [Apply loyalty points → Initiate → Polling 2s → Completed → Success page]
     │
     └── CREDIT_CARD (Staff/Admin only)
         │
         ▼
         [Nhập transactionId → Initiate → Success → Navigate ngay]

[Song song: User có thể thay đổi voucher / loyalty points bất kỳ lúc nào]
[Song song: Countdown chạy → hết hạn → clear data → redirect]
```

---

## 17. Nút thanh toán (Payment Button)

### Điều kiện disable

| Điều kiện | Disable? |
|-----------|----------|
| `payButtonEnabled = false` (không có phương thức khả dụng) | ✅ |
| Đang gọi API initiate (loading) | ✅ |
| Tổng tiền < 0 | ✅ |

### Hiển thị theo trạng thái

| Trạng thái | Nút hiển thị |
|------------|-------------|
| `BANK_TRANSFER` + QR hợp lệ | "Download QR Code" |
| Các phương thức khác / chưa có QR | "Xác nhận thanh toán" |
