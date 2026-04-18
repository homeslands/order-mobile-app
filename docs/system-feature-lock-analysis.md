# Phân Tích Flow: Khoá Tính Năng Hệ Thống (System Feature Flag)

> Đây là hệ thống khoá tính năng **toàn cục** của hệ thống (order type, printer…), khác với khoá tính năng gift card (quản lý riêng trong module gift card).

---

## 1. Tổng Quan

Hệ thống cho phép **Admin / SuperAdmin** khoá hoặc mở khoá các tính năng của hệ thống theo thời gian thực. Khi một tính năng bị khoá:

- **Client / Staff** không thể sử dụng tính năng đó (UI ẩn, BE từ chối)
- Không cần deploy lại code

---

## 2. Cấu Trúc Phân Cấp

Hệ thống flag có 3 cấp:

```
Group (nhóm)
  └── Parent Feature (tính năng cha)
        └── Child Feature (tính năng con)
```

### Danh sách flag hiện tại

```
GROUP: ORDER
├── CREATE_PRIVATE  (cho user đã đăng nhập)
│   ├── AT_TABLE    (tại bàn)
│   ├── TAKE_OUT    (mang đi)
│   └── DELIVERY    (giao hàng)
│
└── CREATE_PUBLIC   (cho khách vãng lai)
    ├── AT_TABLE
    └── TAKE_OUT

GROUP: PRINTER
└── EVENT_FAILED_PRINTING  (trigger khi máy in lỗi)
    ├── PRINT_INVOICE
    ├── PRINT_CHEF_ORDER
    └── PRINT_LABEL_TICKET
```

---

## 3. Cấu Trúc Dữ Liệu

### Bảng `feature_system_group_tbl` — Nhóm tính năng

| Trường | Mô tả                        |
| ------ | ---------------------------- |
| `name` | Tên nhóm: `ORDER`, `PRINTER` |

### Bảng `feature_flag_system_tbl` — Tính năng cha

| Trường        | Mô tả                                          |
| ------------- | ---------------------------------------------- |
| `name`        | Tên feature: `CREATE_PRIVATE`, `CREATE_PUBLIC` |
| `groupName`   | Nhóm chứa                                      |
| `isLocked`    | Trạng thái khoá                                |
| `description` | Mô tả                                          |

### Bảng `child_feature_flag_system_tbl` — Tính năng con

| Trường        | Mô tả                                         |
| ------------- | --------------------------------------------- |
| `name`        | Tên child: `AT_TABLE`, `TAKE_OUT`, `DELIVERY` |
| `parentName`  | Tên feature cha                               |
| `isLocked`    | Trạng thái khoá                               |
| `description` | Mô tả                                         |

> Unique constraint: `(name, groupName)` ở parent; `(name, parentName)` ở child.

---

## 4. Khởi Tạo & Đồng Bộ

**File:** `feature-flag-system.scheduler.ts`

Khi ứng dụng khởi động, scheduler chạy sau **1 giây** để đồng bộ cấu trúc flag từ constant (`feature-flag-system.constant.ts`) vào database:

- Tạo group nếu chưa có
- Tạo parent feature nếu chưa có
- Tạo child feature nếu chưa có
- Không ghi đè `isLocked` — chỉ tạo record mới thiếu

→ Thêm feature mới vào constant → tự động xuất hiện trong DB sau restart.

---

## 5. Backend — Luồng Kiểm Tra & Khoá

### 5.1. Cơ Chế Kiểm Tra

**Service:** `FeatureFlagSystemService.isLockedFeature(group, feature, childFeature?)`

```
isLockedFeature('ORDER', 'CREATE_PRIVATE', 'TAKE_OUT')
      │
      ▼
1. Tìm parent feature (name='CREATE_PRIVATE', groupName='ORDER')
   → Nếu parent.isLocked = true → return true (đã khoá)
      │
      ▼
2. Tìm child feature (name='TAKE_OUT', parentName='CREATE_PRIVATE')
   → Nếu child.isLocked = true → return true (đã khoá)
      │
      ▼
3. Không bị khoá → return false
```

**Ưu tiên:** Parent khoá → mọi child đều khoá, không cần check con.

### 5.2. Hai Cách Enforce Trên Controller

**Cách 1 — Decorator `@Feature()` + Guard:**

```typescript
// Tự động chặn request nếu flag bị khoá
@Feature(`ORDER:CREATE_PRIVATE:TAKE_OUT`)
@Post()
async createOrder() { ... }
```

Guard `FeatureGuard` parse format `GROUP:FEATURE:CHILD`, gọi `isEnabled()`, throw exception nếu locked.

**Cách 2 — Gọi trực tiếp trong service:**

```typescript
// Dùng khi cần kiểm tra trong logic nghiệp vụ
await this.featureFlagSystemService.validateFeatureFlag(
  FeatureSystemGroups.ORDER,
  FeatureFlagSystems.ORDER.CREATE_PRIVATE.key,
  FeatureFlagSystems.ORDER.CREATE_PRIVATE.children.TAKE_OUT.key,
)
// Throw FeatureFlagSystemException nếu locked
```

Order service dùng cách 2 khi update order type.

### 5.3. API Endpoints

> Prefix: `/feature-flag-system` | Auth: Bearer token

| Method  | Endpoint                                 | Quyền             | Mô tả                                      |
| ------- | ---------------------------------------- | ----------------- | ------------------------------------------ |
| `GET`   | `/feature-flag-system/group`             | **Public**        | Lấy tất cả groups + features + children    |
| `GET`   | `/feature-flag-system/group/:groupName`  | **Public**        | Lấy features theo group                    |
| `PATCH` | `/feature-flag-system/bulk-toggle`       | Admin, SuperAdmin | Toggle parent features (cascade xuống con) |
| `PATCH` | `/feature-flag-system/child/bulk-toggle` | Admin, SuperAdmin | Toggle child features (kèm logic parent)   |

---

## 6. Logic Toggle — Cascade & Auto-Sync

### Khi toggle Parent Feature:

```
Admin khoá/mở parent (ví dụ: CREATE_PRIVATE)
      │
      ▼
Cập nhật parent.isLocked = true/false
Cascade: tất cả children.isLocked = true/false (đồng loạt)
```

→ Khoá parent = khoá toàn bộ nhóm con cùng lúc.

### Khi toggle Child Feature:

```
Admin mở khoá child (ví dụ: TAKE_OUT của CREATE_PRIVATE)
      │
      ▼
child.isLocked = false
      │
      ├── Nếu parent đang bị khoá → tự động mở khoá parent
      │   (vì có ít nhất 1 child đang mở)
      │
      └── Lưu child + parent (nếu cần)

Sau đó kiểm tra lại:
→ Nếu TẤT CẢ children đều bị khoá → tự động khoá parent
```

**Tóm tắt logic tự động:**

| Hành động                              | Kết quả                                   |
| -------------------------------------- | ----------------------------------------- |
| Mở khoá child khi parent đang khoá     | Parent tự động mở khoá                    |
| Khoá tất cả children                   | Parent tự động bị khoá                    |
| Mở một số children (không phải tất cả) | Parent mở khoá, các child khác giữ nguyên |

---

## 7. Frontend — Phía Staff/Admin Quản Lý

### 7.1. Trang Quản Lý

**URL:** `/system/system-lock-management`

**Component:** [system-lock-management/page.tsx](../app/order-ui/src/app/system/system-lock-management/page.tsx)

**Hiển thị:**

- Danh sách theo Group → Parent → Children (dạng cây có thể thu gọn)
- Badge trạng thái mỗi cấp:
  - Xanh lá: tất cả mở khoá
  - Đỏ: tất cả bị khoá
  - Vàng: một phần bị khoá (`X/total`)
- Icon `Lock` (đỏ) / `LockOpen` (xanh) bên cạnh mỗi item

**Skeleton loading** khi đang fetch dữ liệu.

### 7.2. Cơ Chế Toggle

**Toggle Parent** — [change-parent-feature-lock-status-dialog.tsx](../app/order-ui/src/components/app/dialog/change-parent-feature-lock-status-dialog.tsx)

- Switch bật/tắt → mở dialog xác nhận
- Nhấn Confirm → gọi `PATCH /feature-flag-system/bulk-toggle`
- Thành công → invalidate cả 2 query key: `systemFeatureFlagGroups` + `systemFeatureFlagsByGroup`
- Hiển thị toast thành công / lỗi

**Toggle Child** — [change-feature-lock-status-dialog.tsx](../app/order-ui/src/components/app/dialog/change-feature-lock-status-dialog.tsx)

- Tương tự parent nhưng gọi `PATCH /feature-flag-system/child/bulk-toggle`
- Cùng invalidate query sau khi thành công

### 7.3. Flow Admin Toggle Tính Năng

```
Admin vào /system/system-lock-management
      │
      ▼
useGetSystemFeatureFlagGroups() → GET /feature-flag-system/group
      │
      ▼
Hiển thị cây: Group → Parent → Children
Mỗi item có Switch + Badge trạng thái
      │
      ├── Admin bật Switch (Parent)
      │       │
      │       ▼
      │   Dialog xác nhận hiện ra
      │       │ Confirm
      │       ▼
      │   PATCH /feature-flag-system/bulk-toggle
      │   { updates: [{ slug, isLocked: !current }] }
      │       │
      │       ▼ (BE)
      │   parent.isLocked = newValue
      │   tất cả children.isLocked = newValue (cascade)
      │       │
      │       ▼ (FE)
      │   invalidate queries → refetch → UI cập nhật
      │
      └── Admin bật Switch (Child)
              │
              ▼
          Dialog xác nhận
              │ Confirm
              ▼
          PATCH /feature-flag-system/child/bulk-toggle
          { updates: [{ slug, isLocked: !current }] }
              │
              ▼ (BE)
          child.isLocked = newValue
          + auto mở/khoá parent theo logic cascade
              │
              ▼ (FE)
          invalidate queries → refetch → UI cập nhật
```

---

## 8. Frontend — Phía Client Phản Ứng Với Flag

### 8.1. Đọc Flag

**Hook:** `useGetSystemFeatureFlagsByGroup(SystemLockFeatureGroup.ORDER)`

Gọi `GET /feature-flag-system/group/ORDER` (public endpoint, không cần auth).

### 8.2. Lọc Order Type Theo Flag

**Component:** [order-type-select.tsx](../app/order-ui/src/components/app/select/order-type-select.tsx)

```
Fetch features của group ORDER
      │
      ▼
Xác định parent phù hợp:
  - User đã đăng nhập → CREATE_PRIVATE
  - Khách vãng lai   → CREATE_PUBLIC
      │
      ▼
Lấy trạng thái isLocked của từng child:
  { AT_TABLE: false, TAKE_OUT: true, DELIVERY: false }
      │
      ▼
Lọc danh sách hiển thị:
  allTypes.filter(type => !orderTypeLockStatus[type.featureKey])
      │
      ▼
Hiển thị dropdown chỉ các type chưa bị khoá

Nếu type hiện tại bị khoá:
  → useEffect tự động chuyển sang type đầu tiên còn khả dụng
```

**Tác động với khách:**

- TAKE_OUT bị khoá → Dropdown không có option "Mang đi"
- Nếu khách đang chọn TAKE_OUT mà bị khoá → tự động chuyển sang AT_TABLE (hoặc option đầu tiên còn lại)
- Tương tự với update order flow (`order-type-in-update-order-select.tsx`)

---

## 9. Quyền Truy Cập

| Hành động                       | Quyền                       |
| ------------------------------- | --------------------------- |
| Đọc danh sách tính năng (`GET`) | **Public** — không cần auth |
| Toggle khoá/mở khoá (`PATCH`)   | **Admin, SuperAdmin** only  |
| Tạo order khi feature bị khoá   | **Bị từ chối** — mọi role   |

---

## 10. Cấu Trúc File

### Backend (`app/order-api/src/feature-flag-system/`)

```
feature-flag-system/
├── entities/
│   ├── feature-flag-system.entity.ts        # Entity parent feature
│   ├── feature-system-group.entity.ts       # Entity group
│   └── child-feature-flag-system.entity.ts  # Entity child feature
├── decorator/
│   └── feature.decorator.ts                 # @Feature() decorator
├── guard/
│   └── fureture.guard.ts                    # FeatureGuard (enforce on controller)
├── feature-flag-system.constant.ts          # Định nghĩa toàn bộ cấu trúc flag
├── feature-flag-system.service.ts           # isEnabled, validateFeatureFlag, bulkToggle
├── feature-flag-system.controller.ts        # REST API endpoints
├── feature-flag-system.dto.ts               # Request/Response DTOs
├── feature-flag-system.scheduler.ts         # Khởi tạo sync khi app start
├── feature-flag-system.exception.ts         # Custom exception
├── feature-flag-system.validation.ts        # Error codes
├── feature-flag-system.mapper.ts            # AutoMapper
└── feature-flag-system.module.ts            # NestJS module
```

### Frontend (`app/order-ui/src/`)

```
constants/lock-feature.ts                    # Enum Group, Type, Child
types/feature-lock.type.ts                   # IFeatureLock, IFeatureLockGroup
api/feature-lock.ts                          # API calls
hooks/use-feature-lock.ts                    # React Query hooks

app/system/system-lock-management/
└── page.tsx                                 # Trang quản lý khoá tính năng (Admin)

components/app/dialog/
├── change-parent-feature-lock-status-dialog.tsx  # Toggle parent với confirm dialog
└── change-feature-lock-status-dialog.tsx         # Toggle child với confirm dialog

components/app/select/
├── order-type-select.tsx                    # Lọc order type theo flag (create)
└── order-type-in-update-order-select.tsx    # Lọc order type theo flag (update)
```

---

## 11. Sơ Đồ Tổng Hợp

```
[Constant định nghĩa cấu trúc flag]
      │ App start (1s delay)
      ▼
[Scheduler sync vào DB] → feature_system_group_tbl
                        → feature_flag_system_tbl
                        → child_feature_flag_system_tbl

Admin toggle flag
      │
      ▼
PATCH /feature-flag-system/bulk-toggle (parent)
      hoặc
PATCH /feature-flag-system/child/bulk-toggle (child)
      │
      ├── Parent toggle → cascade tất cả children
      │
      └── Child toggle → auto sync parent (mở/khoá theo logic)

Client/Staff truy cập
      │
      ├── FE: GET /feature-flag-system/group/ORDER (public)
      │       → lọc UI theo isLocked
      │       → ẩn option bị khoá, tự chuyển type nếu cần
      │
      └── BE: validateFeatureFlag() hoặc FeatureGuard
              → throw exception nếu locked
              → cho qua nếu unlocked
```
