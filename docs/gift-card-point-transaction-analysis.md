# Phân Tích Chức Năng: Điểm Từ Thẻ Quà Tặng (Gift Card Point Transaction)

> Module này **hoàn toàn độc lập** với hệ thống điểm tích lũy từ đơn hàng ([loyalty-points-analysis.md](./loyalty-points-analysis.md)).

---

## 1. Tổng Quan

Hệ thống quản lý **xu (points)** mà người dùng nhận được từ việc mua hoặc sử dụng thẻ quà tặng. Xu được ghi nhận vào tài khoản người dùng và có thể xem lịch sử giao dịch.

---

## 2. So Sánh Với Loyalty Points

| Khía cạnh | Gift Card Points (`point_transaction_tbl`) | Loyalty Points (`accumulated_point_transaction_history_tbl`) |
|---|---|---|
| **Module** | `gift-card-modules/point-transaction` | `accumulated-point` |
| **Loại giao dịch** | `IN` / `OUT` | `ADD` / `USE` / `RESERVE` / `REFUND` |
| **Trạng thái** | Không có | `PENDING` / `CONFIRMED` / `CANCELLED` |
| **Nguồn gốc** | Mua thẻ quà tặng, dùng thẻ | Thanh toán đơn hàng thức ăn |
| **Object liên quan** | `ORDER` / `GIFT_CARD` / `CARD_ORDER` | Order |
| **Mục đích** | Theo dõi xu từ thẻ quà tặng | Theo dõi điểm tích lũy mua hàng |

---

## 3. Cấu Trúc Dữ Liệu

### Entity `PointTransaction` (bảng `point_transaction_tbl`)

| Trường | Kiểu | Mô tả |
|---|---|---|
| `type` | `IN` / `OUT` | Hướng giao dịch: nhận vào / chi ra |
| `desc` | string | Mô tả giao dịch |
| `objectId` | UUID | ID của object liên quan |
| `objectType` | enum | Loại object: `order` / `gift-card` / `card-order` |
| `objectSlug` | string | Slug của object liên quan |
| `points` | number | Số điểm giao dịch |
| `userId` | UUID | ID user sở hữu giao dịch |
| `userSlug` | string | Slug user |
| `balance` | decimal(10,2) | **Số dư sau giao dịch** |

### Enum `PointTransactionTypeEnum`

| Giá trị | Ý nghĩa |
|---|---|
| `IN` | Nhận xu vào tài khoản |
| `OUT` | Dùng xu khỏi tài khoản |

### Enum `PointTransactionObjectTypeEnum`

| Giá trị | Ý nghĩa |
|---|---|
| `ORDER` | Liên quan đến đơn hàng |
| `GIFT_CARD` | Liên quan đến thẻ quà tặng |
| `CARD_ORDER` | Liên quan đến đơn mua thẻ |

---

## 4. Luồng Use Cases

### Luồng A: Mua Card Order loại GIFT (tặng người khác)

**Trigger**: Card order thanh toán thành công, loại `GIFT`

```
Người mua thanh toán card order (type = GIFT)
      │
      ▼
Với từng người nhận:
  - Tính điểm: totalAmount = quantity × cardPoint
  - SharedBalanceService.calcBalance({ userSlug: recipientSlug, points: totalAmount, type: 'in' })
  - SharedPointTransactionService.create({
      type: IN,
      desc: `Nạp ${totalAmount} xu từ người gửi ${senderName}`,
      objectType: CARD_ORDER,
      objectSlug: cardOrder.slug,
      points: totalAmount,
      userSlug: recipientSlug,
      balance: currentBalance.points
    })
```

**Kết quả**: Người nhận được cộng xu, lịch sử ghi nhận nguồn từ card order.

---

### Luồng B: Mua Card Order loại SELF (nạp cho bản thân)

**Trigger**: Card order thanh toán thành công, loại `SELF`

```
Người mua thanh toán card order (type = SELF)
      │
      ▼
- Tính điểm: totalAmount = quantity × cardPoint
- SharedBalanceService.calcBalance({ userSlug, points: totalAmount, type: 'in' })
- SharedPointTransactionService.create({
    type: IN,
    desc: `Nạp cho bản thân ${totalAmount} xu`,
    objectType: CARD_ORDER,
    objectSlug: cardOrder.slug,
    points: totalAmount,
    userSlug: buyerSlug,
    balance: currentBalance.points
  })
```

**Kết quả**: Người mua nhận xu vào tài khoản của chính mình.

---

### Luồng C: Sử Dụng Thẻ Quà Tặng (Redeem Gift Card)

**Trigger**: Người dùng redeem thẻ quà tặng

```
GiftCardService.use(req)
      │
      ▼
1. Redeem thẻ → đánh dấu đã dùng
2. SharedBalanceService.calcBalance({
     userSlug: gc.usedBySlug,
     points: gc.cardPoints,
     type: 'in'
   })
3. SharedPointTransactionService.create({
     type: IN,
     desc: `Sử dụng thẻ quà tặng ${cardPoints} xu`,
     objectType: GIFT_CARD,
     objectSlug: gc.slug,
     points: gc.cardPoints,
     userSlug: gc.usedBySlug,
     balance: currentBalance.points
   })
```

**Kết quả**: Xu từ thẻ được cộng vào tài khoản người dùng.

---

## 5. Validation & Ràng Buộc

| Ràng buộc | Mô tả |
|---|---|
| `OUT + GIFT_CARD` bị cấm | Gift card chỉ cho xu, không trừ xu |
| `IN + ORDER` bị cấm | Order không tự tạo xu IN qua module này |
| `points ≥ 0` | Số xu phải không âm |
| `userSlug` bắt buộc | Phải xác định được user nhận/dùng xu |
| `objectSlug` bắt buộc | Phải có object tham chiếu hợp lệ |

---

## 6. API Endpoints

> Controller prefix: `/point-transaction` | Auth: Bearer token

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/point-transaction` | Tạo giao dịch điểm thủ công |
| `GET` | `/point-transaction` | Lấy danh sách giao dịch (có filter, phân trang) |
| `GET` | `/point-transaction/analysis` | Thống kê tổng nhận / tổng dùng / chênh lệch |
| `GET` | `/point-transaction/:slug` | Xem chi tiết 1 giao dịch |
| `GET` | `/point-transaction/export` | Xuất PDF lịch sử của user |
| `GET` | `/point-transaction/:slug/export` | Xuất PDF 1 giao dịch |
| `GET` | `/point-transaction/export/system` | Xuất Excel toàn hệ thống (admin) |

### `GET /point-transaction` — Query params

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `userSlug` | string | Không | Lọc theo user |
| `type` | `in` / `out` | Không | Lọc theo loại giao dịch |
| `fromDate` | `YYYY-MM-DD` | Không | Từ ngày |
| `toDate` | `YYYY-MM-DD` | Không | Đến ngày |
| `k` | string | Không | Tìm theo tên / số điện thoại |
| `page`, `size` | number | Không | Phân trang |

### `GET /point-transaction/analysis` — Response

```json
{
  "totalEarned": 5000,
  "totalSpent": 1200,
  "netDifference": 3800
}
```

### `POST /point-transaction` — Request body

```json
{
  "type": "in",
  "desc": "Mô tả giao dịch",
  "objectType": "card-order",
  "objectSlug": "card-order-slug-123",
  "points": 500,
  "userSlug": "user-slug-123",
  "balance": 1500
}
```

---

## 7. Frontend — Xem Lịch Sử Xu

### Vị trí trong ứng dụng

**Trang**: `/system/card-order-history` → Tab **"Xu"** (`COIN_TAB`)

Component: `system-transaction-point-history.tabscontent.tsx`

### Summary cards (phía trên bảng)

| Card | Icon | Màu | Giá trị |
|---|---|---|---|
| Tổng xu nhận | TrendingUp | Xanh lá | `totalEarned` |
| Tổng xu đã dùng | TrendingDown | Đỏ | `totalSpent` |
| Chênh lệch | Arrow | Theo giá trị | `netDifference` |

### Bộ lọc

- Date range picker (`fromDate` / `toDate`)
- Loại giao dịch: Tất cả / Nhận (IN) / Dùng (OUT)
- Tìm kiếm theo tên / số điện thoại (`k`)
- Nút "Xóa bộ lọc"

### Bảng dữ liệu (columns)

| Cột | Nội dung |
|---|---|
| STT | Số thứ tự |
| Tên khách hàng | `firstName lastName` |
| Số điện thoại | `phoneNumber` |
| Loại | Badge: xanh "+Nhận xu" (IN) / đỏ "-Dùng xu" (OUT) |
| Số xu | Formatted với dấu +/-, màu tương ứng |
| Thời gian | `HH:mm:ss DD/MM/YYYY` |

**Export**: Nút xuất Excel theo filter hiện tại.

### Dashboard widget

Component: `point-transaction.summary.tsx` — hiển thị tổng hợp xu trên trang home của admin.

---

## 8. Cấu Trúc File

### Backend (`app/order-api/src/gift-card-modules/point-transaction/`)

```
point-transaction/
├── entities/
│   ├── point-transaction.entity.ts           # Entity chính
│   └── point-transaction.enum.ts             # Enum IN/OUT, ORDER/GIFT_CARD/CARD_ORDER
├── dto/
│   ├── create-point-transaction.dto.ts       # DTO tạo giao dịch
│   ├── find-all-point-transaction.dto.ts     # DTO query / filter
│   ├── point-transaction-response.dto.ts     # Response DTO + AnalysisDto
│   ├── export-all-point-transaction.dto.ts   # DTO xuất PDF user
│   └── export-all-system-point-transaction.dto.ts  # DTO xuất Excel admin
├── point-transaction.controller.ts           # REST API endpoints
├── point-transaction.service.ts              # Business logic
├── point-transaction.mapper.ts               # AutoMapper config
├── point-transaction.validation.ts           # Error codes
└── point-transaction.module.ts               # NestJS module

shared/services/
├── shared-point-transaction.service.ts       # Core tạo giao dịch + validate business rules
└── shared-balance.service.ts                 # Cập nhật số dư xu của user
```

### Frontend (`app/order-ui/src/`)

```
types/point-transaction.type.ts               # IPointTransaction, IAnalyzePointTransaction
constants/point-transaction.ts                # PointTransactionType, PointTransactionObjectType
api/point-transaction.ts                      # API calls
hooks/use-point-transaction.ts                # React Query hooks

app/system/card-order-history/
├── page.tsx                                  # Trang card order history
└── DataTable/columns/
    └── point-transaction-columns.ts          # Cột bảng lịch sử xu

components/app/tabscontent/
└── system-transaction-point-history.tabscontent.tsx  # Tab Xu với summary + filter + table

app/system/home/components/summaries/
└── point-transaction.summary.tsx             # Widget tổng hợp xu trên dashboard
```
