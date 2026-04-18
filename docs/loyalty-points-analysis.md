# Phân Tích Chức Năng: Quản Lý Điểm Tích Lũy (Loyalty Points)

## 1. Tổng Quan

Hệ thống điểm tích lũy cho phép khách hàng đã đăng ký tài khoản tích lũy điểm từ các đơn hàng và sử dụng điểm để thanh toán cho đơn hàng tiếp theo. Hệ thống bao gồm cả giao diện khách hàng (client) và giao diện quản trị (admin/staff).

---

## 2. Phạm Vi Áp Dụng

| Đối tượng                                 | Tích lũy điểm | Sử dụng điểm |
| ----------------------------------------- | ------------- | ------------ |
| Khách hàng đã đăng ký (role = `Customer`) | Có            | Có           |
| Khách vãng lai (`default-customer`)       | Không         | Không        |
| Staff / Admin                             | Không         | Không        |

---

## 3. Cấu Trúc Dữ Liệu

### 3.1. Entity `AccumulatedPoint`

Lưu trữ **số dư điểm hiện tại** của từng khách hàng.

| Trường        | Kiểu     | Mô tả             |
| ------------- | -------- | ----------------- |
| `id`          | UUID     | Khóa chính        |
| `user`        | Relation | Liên kết với User |
| `totalPoints` | number   | Tổng điểm hiện có |

### 3.2. Entity `AccumulatedPointTransactionHistory`

Lưu trữ **lịch sử từng giao dịch** điểm.

| Trường             | Kiểu     | Mô tả                                             |
| ------------------ | -------- | ------------------------------------------------- |
| `id`               | UUID     | Khóa chính                                        |
| `type`             | enum     | Loại giao dịch: `ADD`, `USE`, `RESERVE`, `REFUND` |
| `status`           | enum     | Trạng thái: `PENDING`, `CONFIRMED`, `CANCELLED`   |
| `amount`           | number   | Số điểm trong giao dịch                           |
| `order`            | Relation | Đơn hàng liên quan                                |
| `accumulatedPoint` | Relation | Tài khoản điểm của user                           |

### 3.3. Enum Loại Giao Dịch

| Loại      | Ý nghĩa                                          | Màu hiển thị |
| --------- | ------------------------------------------------ | ------------ |
| `ADD`     | Điểm được cộng sau khi thanh toán thành công     | Xanh lá      |
| `RESERVE` | Điểm tạm giữ khi áp dụng vào đơn chưa thanh toán | Xám          |
| `USE`     | Điểm đã sử dụng (xác nhận sau thanh toán)        | Đỏ           |
| `REFUND`  | Điểm được hoàn lại khi hủy đơn                   | Cam          |

---

## 4. Luồng Use Cases

### UC-01: Tích Lũy Điểm Sau Thanh Toán

**Trigger**: Đơn hàng được thanh toán thành công (Job Service xử lý)

**Precondition**:

- Khách hàng có role = `Customer`
- Không phải `default-customer`
- Đơn hàng ở trạng thái đã thanh toán

**Luồng chính**:

1. Job Service gọi `addPointsForOrder(orderSlug)`
2. Hệ thống lấy thông tin đơn hàng và cấu hình tỷ lệ tích điểm (`ACCUMULATED_POINTS_PERCENTAGE`)
3. Tính điểm: `Math.floor(orderTotal × percentage / 100)`
4. Tạo transaction với type = `ADD`, status = `CONFIRMED`
5. Cộng điểm vào `AccumulatedPoint.totalPoints`

**Kết quả**: Khách hàng nhận được điểm tương ứng với giá trị đơn hàng.

---

### UC-02: Áp Dụng Điểm Vào Đơn Hàng (Reserve)

**Actor**: Khách hàng / Nhân viên (khi tạo đơn giúp khách)

**Trigger**: Khách hàng nhập số điểm muốn dùng và nhấn "Áp dụng"

**Precondition**:

- Đơn hàng ở trạng thái `PENDING`
- Khách hàng có đủ điểm
- Số điểm ≤ tổng tiền đơn hàng

**Luồng chính**:

1. Khách nhập số điểm (hoặc chọn nhanh: 1K, 2K, 5K, MAX)
2. Hệ thống gọi `reservePointsForOrder(orderSlug, pointsToUse)`
3. Validate:
   - Số điểm > 0
   - Số điểm ≤ `totalPoints` của khách
   - Số điểm ≤ subtotal đơn hàng
4. Tạo transaction với type = `RESERVE`, status = `PENDING`
5. Trừ tạm điểm khỏi `totalPoints`
6. Cập nhật `order.accumulatedPointsToUse`

**Lưu ý quan trọng**:

- Mỗi đơn hàng chỉ có **một reservation** tại một thời điểm (cập nhật đè lên reservation cũ)
- Không thể áp dụng điểm cho nhiều đơn hàng đồng thời

**Kết quả**: Điểm được "giữ chỗ", số tiền cần thanh toán giảm tương ứng.

---

### UC-03: Xác Nhận Sử Dụng Điểm (Confirm)

**Trigger**: Đơn hàng thanh toán thành công (Job Service xử lý)

**Precondition**: Đơn hàng có `accumulatedPointsToUse > 0` và transaction `RESERVE` đang `PENDING`

**Luồng chính**:

1. Job Service gọi `confirmPointsUsage(orderSlug)`
2. Hệ thống tìm transaction `RESERVE - PENDING` của đơn hàng
3. Cập nhật status → `CONFIRMED`
4. Tạo thêm transaction mới type = `USE`, status = `CONFIRMED`

**Kết quả**: Điểm chính thức được ghi nhận là đã sử dụng.

---

### UC-04: Hủy Reservation Điểm

**Actor**: Khách hàng (huỷ áp dụng) hoặc hệ thống (khi huỷ đơn)

**Trigger**: Khách bấm "Hủy áp dụng điểm" HOẶC đơn hàng bị hủy

**Luồng chính**:

1. Gọi `cancelReservation(orderSlug)` hoặc `handleCancelReservation(orderSlug)`
2. Hệ thống tìm transaction `RESERVE - PENDING`
3. Cập nhật status → `CANCELLED`
4. Hoàn điểm về `AccumulatedPoint.totalPoints`
5. Nếu huỷ đơn: tạo transaction type = `REFUND`, status = `CONFIRMED`

**Kết quả**: Điểm được hoàn trả đầy đủ, đơn hàng không còn giảm giá điểm.

---

### UC-05: Xem Số Dư Điểm

**Actor**: Khách hàng / Staff / Admin

**Endpoint**: `GET /accumulated-point/user/:slug/points`

**Frontend**:

- Khách hàng: Trang profile → Tab điểm tích lũy (`loyalty-point-page.tsx`)
- Staff/Admin: Trang quản lý khách hàng → Tab điểm (`customer-loyalty-point.tabscontent.tsx`)

**Hiển thị**:

- Tổng điểm hiện có
- Icon trending indicator

---

### UC-06: Xem Lịch Sử Giao Dịch Điểm

**Actor**: Khách hàng / Staff / Admin

**Endpoint**: `GET /accumulated-point/user/:slug/history`

**Query params hỗ trợ**:

- Phân trang (page, pageSize)
- Lọc theo loại giao dịch (ADD / USE / RESERVE / REFUND)
- Lọc theo khoảng thời gian (startDate, endDate)

**Frontend hiển thị**:

- Bảng lịch sử giao dịch (DataTable có phân trang)
- Badge màu theo loại giao dịch
- Dialog xem chi tiết từng giao dịch
- Summary: tổng điểm đã nhận, đã dùng, số dư hiện tại

---

## 5. Cấu Hình Hệ Thống

| Cấu hình        | Key                             | Mô tả                                      |
| --------------- | ------------------------------- | ------------------------------------------ |
| Tỷ lệ tích điểm | `ACCUMULATED_POINTS_PERCENTAGE` | % giá trị đơn hàng được quy đổi thành điểm |

**Công thức tính điểm nhận được**:

```
points = Math.floor(orderTotal × ACCUMULATED_POINTS_PERCENTAGE / 100)
```

**Công thức tính điểm tối đa có thể dùng**:

```
maxPoints = min(totalPoints, orderSubtotal)
```

---

## 6. Validation & Ràng Buộc

| Ràng buộc               | Mô tả                                                  |
| ----------------------- | ------------------------------------------------------ |
| Chỉ khách hàng đăng ký  | Role phải là `Customer`, không phải `default-customer` |
| Điểm không âm           | Số điểm nhập phải > 0                                  |
| Không vượt quá số dư    | `pointsToUse ≤ totalPoints`                            |
| Không vượt quá tổng đơn | `pointsToUse ≤ orderSubtotal`                          |
| Đơn hàng PENDING        | Chỉ áp dụng điểm khi đơn đang ở trạng thái `PENDING`   |
| Một reservation/đơn     | Mỗi đơn chỉ có 1 reservation tại 1 thời điểm           |
| Không dùng đồng thời    | Không thể reserve điểm cho nhiều đơn cùng lúc          |

---

## 7. Cấu Trúc File

### Backend (`app/order-api/src/accumulated-point/`)

```
accumulated-point/
├── entities/
│   ├── accumulated-point.entity.ts              # Entity số dư điểm
│   └── accumulated-point-transaction-history.entity.ts  # Entity lịch sử giao dịch
├── accumulated-point.service.ts                 # Business logic chính
├── accumulated-point.controller.ts              # REST API endpoints
├── accumulated-point.dto.ts                     # Request/Response DTOs
├── accumulated-point.constants.ts               # Enums (type, status)
├── accumulated-point.utils.ts                   # Helper functions (tính điểm, validate)
├── accumulated-point.validation.ts              # Error codes
├── accumulated-point.exception.ts               # Custom exceptions
├── accumulated-point.mapper.ts                  # AutoMapper config
└── accumulated-point.module.ts                  # NestJS module
```

### Frontend (`app/order-ui/src/`)

```
api/
└── loyalty-point.ts                             # API calls

hooks/
└── use-loyalty-point.ts                         # React Query hooks

types/
└── loyalty-point.type.ts                        # TypeScript interfaces

constants/
└── loyalty-point.ts                             # Enums frontend

utils/
└── loyalty-point.ts                             # Utility functions

components/app/
├── badge/loyalty-point-type-badge.tsx           # Badge loại giao dịch
├── input/loyalty-point-input.tsx                # Input nhập điểm
├── select/
│   ├── client-loyalty-point-selector.tsx        # Selector phía client
│   ├── staff-loyalty-point-selector.tsx         # Selector phía staff
│   └── loyalty-point-type-select.tsx            # Dropdown loại giao dịch
├── dialog/
│   ├── loyalty-point-detail-history-dialog.tsx  # Dialog chi tiết (client)
│   └── staff-loyalty-point-detail-history-dialog.tsx # Dialog chi tiết (staff)
└── tabscontent/
    ├── customer-loyalty-point.tabscontent.tsx   # Tab điểm cho admin
    └── system-customer-loyalty-point.tabscontent.tsx  # Tab điểm hệ thống

app/client/profile/
└── components/loyalty-point-page.tsx            # Trang điểm của khách

app/system/customers/DataTable/
├── actions/loyalty-point-history-action.tsx     # Action admin
└── columns/loyalty-point-history-columns.tsx    # Cột bảng admin
```

---

## 8. API Endpoints

> Controller: `accumulated-point.controller.ts` | Prefix: `/accumulated-point` | Auth: Bearer token (tất cả)

---

### `GET /accumulated-point/user/:slug/points`

Lấy tổng điểm hiện có của user.

|           |                        |
| --------- | ---------------------- |
| **Param** | `slug` — slug của user |
| **Body**  | Không có               |

**Response**:

```json
{
  "totalPoints": 1200
}
```

---

### `POST /accumulated-point/order/:slug/apply-points`

Áp dụng (reserve) điểm vào đơn hàng. `userId` lấy từ JWT token của người dùng hiện tại.

|           |                                |
| --------- | ------------------------------ |
| **Param** | `slug` — slug của **order**    |
| **Auth**  | Lấy `userId` từ `@CurrentUser` |

**Request body**:

```json
{
  "pointsToUse": 200
}
```

| Field         | Kiểu      | Validate          |
| ------------- | --------- | ----------------- |
| `pointsToUse` | `integer` | Bắt buộc, min = 1 |

**Response**:

```json
{
  "pointsUsed": 200,
  "finalAmount": 800
}
```

---

### `POST /accumulated-point/order/:slug/cancel-reservation`

Hủy reservation điểm của đơn hàng, hoàn điểm về tài khoản user.

|           |                                |
| --------- | ------------------------------ |
| **Param** | `slug` — slug của **order**    |
| **Body**  | Không có                       |
| **Auth**  | Lấy `userId` từ `@CurrentUser` |

**Response**:

```json
{
  "result": "Cancel reservation for order successfully"
}
```

---

### `GET /accumulated-point/user/:slug/history`

Lấy lịch sử giao dịch điểm, hỗ trợ phân trang và filter.

|           |                        |
| --------- | ---------------------- |
| **Param** | `slug` — slug của user |

**Query params**:

| Param       | Kiểu         | Bắt buộc | Mô tả                           | Ví dụ                             |
| ----------- | ------------ | -------- | ------------------------------- | --------------------------------- |
| `types`     | `string[]`   | Có       | Mảng loại giao dịch             | `add`, `use`, `reserve`, `refund` |
| `fromDate`  | `ISO string` | Không    | Lọc từ ngày                     | `2025-08-01T00:00:00.000Z`        |
| `toDate`    | `ISO string` | Không    | Lọc đến ngày                    | `2025-08-31T23:59:59.999Z`        |
| `hasPaging` | `boolean`    | Không    | Bật phân trang (default `true`) | `true` / `false`                  |
| `page`      | `number`     | Không    | Trang hiện tại                  | `1`                               |
| `pageSize`  | `number`     | Không    | Số item mỗi trang               | `10`                              |

> Lưu ý: `types` nhận một giá trị string sẽ tự động wrap thành mảng `[value]`.

**Response** (mỗi item):

```json
{
  "type": "add",
  "points": 100,
  "lastPoints": 1200,
  "orderSlug": "order-slug-123",
  "date": "2025-08-01T00:00:00.000Z"
}
```

| Field        | Mô tả                                                |
| ------------ | ---------------------------------------------------- |
| `type`       | Loại giao dịch: `add` / `use` / `reserve` / `refund` |
| `points`     | Số điểm thay đổi trong giao dịch này                 |
| `lastPoints` | Số dư điểm **sau** giao dịch                         |
| `orderSlug`  | Slug đơn hàng liên quan (nếu có)                     |
| `date`       | Thời điểm giao dịch                                  |

---

## 9. Tích Hợp Với Các Module Khác

| Module                            | Tích hợp                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------- |
| **Order**                         | Trường `accumulatedPointsToUse`; relation với transaction history             |
| **Invoice**                       | Theo dõi thanh toán bằng điểm như một phương thức thanh toán                  |
| **Payment**                       | `point.strategy.ts` xử lý điểm như payment method                             |
| **Job Service**                   | Gọi `confirmPointsUsage()` và `addPointsForOrder()` sau khi thanh toán        |
| **Branch Revenue**                | Thống kê `totalOrderPoint`, `totalAmountPoint`, `totalAccumulatedPointsToUse` |
| **Gift Card / Point Transaction** | Module phụ quản lý giao dịch điểm liên quan đến thẻ quà tặng                  |

---

## 10. Sơ Đồ Luồng Điểm

```
Khách đặt đơn
      │
      ▼
Thanh toán thành công
      │
      ├──► [addPointsForOrder] → Tạo transaction ADD (CONFIRMED) → Cộng điểm
      │
      └──► [confirmPointsUsage] (nếu có RESERVE) → RESERVE → CONFIRMED + tạo USE

Khách muốn dùng điểm
      │
      ▼
[reservePointsForOrder] → Tạo RESERVE (PENDING) → Trừ tạm điểm
      │
      ├── Thanh toán thành công → [confirmPointsUsage] → CONFIRMED + tạo USE
      │
      └── Hủy / Không dùng nữa → [cancelReservation] → CANCELLED → Hoàn điểm
                                                              │
                                                    (hủy đơn) → Tạo REFUND
```
