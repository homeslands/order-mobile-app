# QR Thanh toán bằng Xu (Point QR Payment)

## 1. Tổng quan

- **Mục tiêu:** Cho phép Customer tạo mã QR tạm thời (TTL 30s) trên app. Nhân viên (Staff) tại máy POS quét mã QR này để thanh toán đơn hàng bằng xu (point/balance) của khách, tương tự flow thanh toán Momo.
- **Đối tượng sử dụng:** Customer (tạo QR), Staff/Manager (quét QR tại POS)

## 2. Flow nghiệp vụ

1. Staff tạo đơn hàng (Order) trên máy POS, đơn hàng ở trạng thái PENDING
2. Staff chọn hình thức thanh toán "Xu" (Point) → cần mã QR từ khách
3. Customer mở app, chọn "Tạo mã QR thanh toán" → app gọi `POST /payment/qr/generate`
4. Server tạo token (`crypto.randomBytes(32)`), hash SHA-256 lưu Redis (TTL 30s), trả rawToken + QR image cho client
5. **Client tự động refresh QR:** app tự gọi lại `/generate` mỗi 25s → QR luôn valid, customer không cần bấm lại
6. Customer đưa màn hình QR cho Staff quét
7. Staff quét QR trên máy POS, gửi `POST /payment/qr/verify` với token + orderSlug
8. Server verify (theo thứ tự):
   - a. Token hợp lệ (tồn tại trong Redis, chưa hết hạn) → nếu không: QR_TOKEN_INVALID / QR_TOKEN_EXPIRED
   - b. **Xóa token khỏi Redis ngay lập tức** (atomic DEL, đảm bảo one-time use)
   - c. Lấy userSlug từ Redis value → tìm Customer
   - d. Order tồn tại và ở trạng thái PENDING → nếu không: ORDER_NOT_FOUND / ORDER_NOT_PENDING
   - e. Order chưa có payment → nếu có: ORDER_ALREADY_PAID
   - f. Staff thuộc cùng chi nhánh (branch) với Order → nếu không: FORBIDDEN_BRANCH
   - g. Customer có đủ xu (balance >= order.subtotal) → nếu không: INSUFFICIENT_BALANCE
9. **Atomic transaction:** trừ xu + tạo Payment (COMPLETED, paymentMethod='point') + cập nhật Order status → nếu fail giữa chừng → rollback toàn bộ
10. **Push notification cho Customer** qua Firebase FCM: "Bạn vừa thanh toán {amount} xu cho đơn hàng #{orderSlug}"
11. Trả kết quả thành công cho Staff trên POS

## 3. Actors & Permissions

| Actor    | Hành động được phép                                        |
| -------- | ---------------------------------------------------------- |
| Customer | Tạo mã QR thanh toán cho chính mình                        |
| Staff    | Quét mã QR để thanh toán đơn hàng thuộc chi nhánh của mình |
| Manager  | Quét mã QR để thanh toán đơn hàng thuộc chi nhánh của mình |
| Admin    | Không trực tiếp tham gia flow                              |

## 4. API Endpoints

### POST /payment/qr/generate (Customer)

**Request:** không cần body (lấy userId từ JWT)

**Response:**

```json
{
  "token": "a1b2c3...hex64chars",
  "qrCode": "data:image/png;base64,...",
  "expiresAt": "2024-01-01T00:00:30.000Z"
}
```

- `token`: rawToken 64 ký tự hex (để client có thể dùng lại nếu cần)
- `qrCode`: ảnh QR dạng base64 (nội dung QR = rawToken)
- `expiresAt`: thời điểm hết hạn (client dùng để hiển thị countdown)

### POST /payment/qr/verify (Staff, Manager)

**Request:**

```json
{
  "token": "a1b2c3...hex64chars",
  "orderSlug": "order-xxx-yyy"
}
```

**Response (thành công):**

```json
{
  "message": "Payment successful",
  "paymentSlug": "payment-xxx-yyy",
  "amount": 50000,
  "customerName": "Nguyễn Văn A",
  "orderSlug": "order-xxx-yyy"
}
```

**Response (thất bại):** trả error code tương ứng (xem section 8)

## 5. Data Model & Redis

### 5.1 Prerequisite: SharedRedisService

> **Xem chi tiết tại [`prompt/SharedRedisService.md`](./SharedRedisService.md)**
>
> QR Payment cần SET/GET/DEL Redis trực tiếp. SharedRedisService phải được tạo và đăng ký trong AppModule trước khi implement feature này.

### 5.4 Redis Keys cho QR Payment

| Key                                       | Value         | TTL | Mục đích                                       |
| ----------------------------------------- | ------------- | --- | ---------------------------------------------- |
| `qr:token:{SHA-256(rawToken)}`            | `userSlug`    | 30s | Lookup token → tìm customer                    |
| `qr:active:{userSlug}`                    | `hashedToken` | 30s | Track QR active, xóa token cũ khi generate mới |
| `qr:idempotent:{orderSlug}:{hashedToken}` | `1`           | 60s | Chống duplicate payment                        |

**Cách sử dụng trong QR Payment service:**

```typescript
// Generate QR
const rawToken = crypto.randomBytes(32).toString('hex')
const hashedToken = createHash('sha256').update(rawToken).digest('hex')

// Xóa QR cũ nếu có
const oldHash = await this.sharedRedisService.get(`qr:active:${userSlug}`)
if (oldHash) await this.sharedRedisService.del(`qr:token:${oldHash}`)

// Lưu QR mới
await this.sharedRedisService.set(`qr:token:${hashedToken}`, userSlug, 30)
await this.sharedRedisService.set(`qr:active:${userSlug}`, hashedToken, 30)

// Verify QR (Staff quét)
const hashedToken = createHash('sha256').update(token).digest('hex')
const deleted = await this.sharedRedisService.del(`qr:token:${hashedToken}`)
if (deleted === 0) throw QR_TOKEN_INVALID // token không tồn tại hoặc đã dùng
```

### 5.5 Không thay đổi entity hiện có

- Tận dụng Payment entity hiện có (paymentMethod = 'point')
- Tận dụng SharedBalanceService để validate và trừ xu
- Tận dụng PointStrategy hiện có hoặc tạo strategy mới

## 6. Quan hệ với module hiện có

- **SharedRedisModule (MỚI):** Service dùng chung cho SET/GET/DEL Redis trực tiếp — cần tạo trước khi implement QR Payment (xem 5.3)
- **Payment module:** Tích hợp vào flow payment hiện tại, thêm bước verify QR trước khi gọi PointStrategy
- **Balance module (SharedBalanceService):** Dùng validate() để kiểm tra đủ xu, dùng calcBalance() để trừ xu
- **Order module:** Đơn hàng phải ở trạng thái PENDING, chưa có payment
- **QR Code module (qr-code.service):** Dùng generateQRCode() để tạo ảnh QR từ token
- **User module:** Xác định Customer từ userSlug để lấy balance
- **Notification module (NotificationService):** Sau khi verify thành công, gọi NotificationService.create() để push thông báo qua Firebase FCM đến mọi device của Customer
- **TransactionManagerService:** Đảm bảo atomic transaction cho bước trừ xu + tạo payment + update order

## 7. Business Rules

- QR token hết hạn sau 30 giây, không thể sử dụng lại
- Mỗi QR token chỉ dùng được 1 lần (one-time use, xóa khỏi Redis ngay khi verify)
- Customer phải có đủ xu (balance >= order.subtotal)
- Đơn hàng phải ở trạng thái PENDING và chưa có payment nào
- Nếu order.subtotal < 2000 thì chuyển sang CASH (rule hiện có)
- Một Customer tại một thời điểm chỉ có 1 QR token active (tạo mới sẽ hủy cái cũ)
- Staff chỉ được verify order thuộc chi nhánh (branch) của mình
- QR token của Customer nào chỉ thanh toán được đơn hàng của chính Customer đó (user A tạo QR không thể thanh toán đơn hàng của user B)
- Trừ xu + tạo payment + update order phải trong cùng 1 transaction (rollback nếu fail)

## 8. Error Cases

| Trường hợp                            | Error Code            | HTTP Status |
| ------------------------------------- | --------------------- | ----------- |
| QR token không tồn tại hoặc hết hạn   | QR_TOKEN_INVALID      | 400         |
| QR token đã được sử dụng              | QR_TOKEN_ALREADY_USED | 400         |
| Customer không đủ xu                  | INSUFFICIENT_BALANCE  | 400         |
| Order không tồn tại                   | ORDER_NOT_FOUND       | 404         |
| Order không ở trạng thái PENDING      | ORDER_NOT_PENDING     | 400         |
| Order đã có payment (đã thanh toán)   | ORDER_ALREADY_PAID    | 400         |
| Staff không thuộc chi nhánh của Order | FORBIDDEN_BRANCH      | 403         |
| QR token không thuộc chủ đơn hàng     | QR_OWNER_MISMATCH     | 403         |

## 9. Bảo mật

### 9.1 Token Generation & Storage

- Dùng `crypto.randomBytes(32)` — entropy 256-bit, chống brute-force
- Hash token bằng **SHA-256** trước khi lưu Redis (không dùng bcrypt — quá chậm cho token ngắn hạn 30s)
- Flow:
  1. `rawToken = crypto.randomBytes(32).toString('hex')` → 64 ký tự hex
  2. `hashedToken = SHA-256(rawToken)` → dùng làm Redis key
  3. Redis: `SET qr:{hashedToken} {userSlug} EX 30`
  4. Trả `rawToken` cho client hiển thị QR
  5. Staff quét → server tính lại `SHA-256(rawToken)` → lookup Redis
  6. Tìm thấy → **DEL key ngay** → xử lý thanh toán
- Nếu Redis bị dump, attacker chỉ thấy hash, không dùng được token gốc
- QR chỉ chứa rawToken (hex string), không chứa userSlug hay balance

### 9.2 Rate Limiting

| Endpoint                  | Limit                     | Mục đích                                       |
| ------------------------- | ------------------------- | ---------------------------------------------- |
| POST /payment/qr/generate | 5 request / phút / user   | Chống spam (cho phép auto-refresh 25s + retry) |
| POST /payment/qr/verify   | 10 request / phút / staff | Chống brute-force quét token                   |
| Cả 2 endpoint             | 60 request / phút / IP    | Chống abuse từ 1 IP                            |

### 9.3 Anti-Replay & Double-Spend

- Dùng Redis `DEL qr:{hashedToken}` atomic: trả về 1 nếu key tồn tại, 0 nếu đã bị xóa → đảm bảo token chỉ dùng 1 lần, tránh race condition khi 2 POS quét cùng lúc
- Thêm idempotency key `SET qr:idempotent:{orderSlug}:{hashedToken} 1 EX 60` → tránh Staff quét 2 lần tạo 2 payment
- Dùng TransactionManagerService cho bước trừ xu + tạo payment → rollback nếu fail giữa chừng

### 9.4 Transport & Authentication

- HTTPS bắt buộc — token truyền qua network phải được mã hóa TLS
- JWT Authentication: `/generate` check role Customer, `/verify` check role Staff/Manager
- Response của verify không trả về balance còn lại của Customer cho Staff (tránh lộ thông tin)

### 9.5 Audit & Monitoring

- Log mọi generate/verify kèm userId, IP, timestamp, kết quả (success/fail/reason)
- Alert khi verify fail rate cao bất thường (dấu hiệu brute-force)

## 10. Notification cho Customer (sau khi thanh toán thành công)

- Sau khi verify QR + trừ xu thành công, server gọi `NotificationService.create()` với:
  - `receiverId`: userId của Customer (lấy từ userSlug trong QR token)
  - `title`: "Thanh toán thành công"
  - `body`: "Bạn vừa thanh toán {amount} xu cho đơn hàng #{orderSlug}"
  - `type`: "PAYMENT_QR_SUCCESS"
  - `link`: route đến chi tiết đơn hàng trên app
- NotificationService tự động gửi push notification qua Firebase FCM đến mọi device đã đăng ký của Customer

## 11. Client-side: Auto-refresh QR

- App client tự động gọi lại `POST /payment/qr/generate` mỗi 25 giây
- Mỗi lần generate mới, server tự xóa token cũ trong Redis (chỉ 1 QR active / user)
- Hiển thị countdown 30s trên UI, reset khi refresh
- Nếu customer tắt màn hình QR → stop auto-refresh
