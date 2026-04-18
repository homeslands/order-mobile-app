# Perf Cart Voucher — Implementation Tasks

Chia nhỏ theo thứ tự dễ → khó, mỗi step build on step trước.

---

## Phase 1: Hiển thị (không cần API)

### 1.1 Input nhập mã voucher

- Thêm `TextInput` vào `PerfVoucherSheet`
- Local state `code` trong sheet
- Nút "Áp dụng" (disabled khi code rỗng)
- **File:** `components/perf/cart-content.tsx` (PerfVoucherSheet)

### 1.2 Hiển thị voucher đã áp dụng

- Trigger button đổi UI: "Thêm mã giảm giá" → hiện title + code + nút X gỡ
- Đọc từ `usePerfCartVoucher()` selector
- Bấm X → `setVoucher(null)`
- **File:** `components/perf/cart-content.tsx` (PerfCartFooter)

### 1.3 Tổng tiền trừ voucher discount

- Footer hiện giá gốc gạch ngang + giá sau voucher
- Tính đơn giản: `total - voucherDiscount` (chưa cần 6 combinations)
- **File:** `components/perf/cart-content.tsx` (PerfCartFooter)

---

## Phase 2: Kết nối API

### 2.1 Fetch voucher theo code

- Nhập code trong sheet → gọi `useSpecificPublicVoucher({ code })`
- Hiện kết quả: tên voucher, giá trị giảm, min order
- Loading state khi fetch
- Error state khi không tìm thấy
- **File:** `components/perf/cart-content.tsx` (PerfVoucherSheet)
- **Hook:** `hooks/use-voucher.ts` → `useSpecificPublicVoucher`

### 2.2 Validate voucher trước khi áp dụng

- Bấm "Áp dụng" → build request từ perf cart items → gọi `validatePublicVoucher`
- Thành công → `setVoucher(voucher)` → đóng sheet → toast
- Thất bại → hiện lỗi trong sheet
- **File:** `components/perf/cart-content.tsx` (PerfVoucherSheet)
- **Hook:** `hooks/use-voucher.ts` → `useValidatePublicVoucher`
- **Store:** `stores/perf-cart.store.ts` → `setVoucher`

### 2.3 Fetch danh sách voucher eligible

- Gọi `usePublicVouchersForOrder` với perf cart items khi sheet mở
- Build request: `{ orderItems, minOrderValue }` từ perf cart
- Hiện danh sách voucher cards trong sheet (dưới input)
- Bấm voucher → set code vào input
- **File:** `components/perf/cart-content.tsx` (PerfVoucherSheet)
- **Hook:** `hooks/use-voucher.ts` → `usePublicVouchersForOrder`

---

## Phase 3: Validation client-side

### 3.1 Phân loại valid / invalid voucher

- Dùng `processVoucherList()` từ `components/sheet/voucher-validation.ts`
- Input: danh sách voucher + cart product slugs + subtotal
- Output: `{ voucher, isValid, errorMessage }[]`
- Hiện valid trước (bấm được), invalid sau (mờ, không bấm)
- **File:** `components/perf/cart-content.tsx` (PerfVoucherSheet)
- **Import:** `components/sheet/voucher-validation.ts` → `processVoucherList`

### 3.2 Error message per voucher

- Hiện lý do không khả dụng dưới mỗi voucher card:
  - Hết hạn
  - Hết lượt sử dụng
  - Chưa đạt giá trị đơn tối thiểu
  - Sản phẩm không phù hợp (ALL_REQUIRED / AT_LEAST_ONE)
  - Cần xác thực danh tính
- Đã có sẵn trong `processVoucherList` output → chỉ cần hiển thị
- **File:** `components/perf/cart-content.tsx` (voucher card trong sheet)

### 3.3 Auto-remove khi giỏ thay đổi

- Khi user thêm/xoá/đổi số lượng trong perf cart → check voucher còn valid không
- Dùng `shouldAutoRemoveVoucher()` từ `voucher-validation.ts`
- Nếu không valid → `setVoucher(null)` + toast thông báo
- Trigger: `useMemo` watch `items` + `voucher` → `useEffect` gỡ nếu cần
- **File:** `components/perf/cart-content.tsx` (CartContent level)
- **Import:** `components/sheet/voucher-validation.ts` → `shouldAutoRemoveVoucher`

---

## Phase 4: UI polish

### 4.1 Voucher card UI

- Card style: left color strip + dashed separator + content + checkbox
- Hiện: discount label, min order value, usage progress bar, expiry countdown
- Reuse `getDiscountLabel()` + `getExpiryText()` từ `voucher-row.tsx`
- Selected state: primary border + bg tint
- Invalid state: opacity 0.6
- **File:** tạo `components/perf/perf-voucher-card.tsx` hoặc inline trong sheet

### 4.2 Pagination load more

- Nút "Tải thêm" khi API trả `hasNext: true`
- `currentPage` state → tăng khi bấm → fetch thêm → append vào list
- Cap 50 items (dùng `truncateVoucherList`)
- **File:** `components/perf/cart-content.tsx` (PerfVoucherSheet)

### 4.3 Voucher condition detail

- Bấm "Xem điều kiện" trên card → mở sub-sheet chi tiết
- Hiện: code (copy), hạn sử dụng, danh sách điều kiện
- Dùng `buildVoucherConditions()` từ `voucher-validation.ts`
- Reuse `VoucherConditionSheet` component có sẵn
- **File:** `components/perf/cart-content.tsx` (PerfVoucherSheet)

---

## Phase 5: Tính giá chính xác

### 5.1 Discount calculation đầy đủ

- Thay thế tính đơn giản (Phase 1.3) bằng logic đầy đủ 6 combinations:
  - `percent_order` × `all_required` / `at_least_one_required`
  - `fixed_value` × `all_required` / `at_least_one_required`
  - `same_price_product` × any
- Dùng `calculateCartDisplayAndTotals()` từ `utils/cart.ts` hoặc native module
- Cần map `PerfCartItem[]` → format tương thích với calculation functions
- **File:** `components/perf/cart-content.tsx` (PerfCartFooter)
- **Import:** `utils/cart.ts` hoặc `cart-price-calc` native module

### 5.2 Hiện giá per-item sau voucher

- Mỗi `PerfCartItemRow` hiện giá sau voucher discount (nếu item eligible)
- Cần `displayItems` từ calculation → truyền xuống per-item
- Giá gạch ngang (original) + giá mới (sau voucher)
- **File:** `components/perf/cart-content.tsx` (PerfCartItemRow)

---

## Dependencies Graph

```
1.1 (input) ──→ 1.2 (hiển thị applied) ──→ 1.3 (tổng tiền)
     │
     ▼
2.1 (fetch by code) ──→ 2.2 (validate API) ──→ 2.3 (fetch list)
                                                      │
                                                      ▼
                              3.1 (valid/invalid) ──→ 3.2 (error msg) ──→ 3.3 (auto-remove)
                                     │
                                     ▼
                              4.1 (card UI) ──→ 4.2 (pagination) ──→ 4.3 (conditions)
                                     │
                                     ▼
                              5.1 (calc đầy đủ) ──→ 5.2 (per-item price)
```

## MVP (đủ dùng): 1.1 → 1.2 → 2.1 → 2.2

User nhập code → validate → áp dụng → hiện trong cart → gỡ được. Không cần list, không cần client validation phức tạp.

## Hiện trạng

- [x] Trigger button (dashed border) trong footer
- [x] Empty sheet (Modal + BottomSheet pattern)
- [x] `perf-cart.store` có `voucher` field + `setVoucher`
- [x] `voucher-validation.ts` có pure functions sẵn sàng
- [x] 1.1 — Input nhập mã (BottomSheetTextInput + search icon)
- [x] 1.2 — Hiển thị applied voucher (trigger: title + discount badge + chevron)
- [x] 1.3 — Tổng tiền trừ discount (giá gốc gạch ngang + giá sau voucher)
- [x] 2.1 — Fetch by code (useSpecificPublicVoucher + loading/error/result states)
- [x] 4.1 — Card UI (left strip + dashed separator + content + progress + expiry + checkbox) — done sớm vì cần cho 2.1
- [x] 4.3 — Condition detail sheet (chồng lên, hiện mã + HSD + điều kiện)
- [x] Footer nút Áp dụng/Gỡ mã/Đóng (3 states)
- [x] Pre-fill voucher khi mở lại sheet
- [x] 2.2 — Validate API (validatePublicVoucher trước khi apply)
- [x] 2.3 — Fetch eligible list (usePublicVouchersForOrder khi sheet mở)
- [x] 3.3 — Auto-remove (shouldAutoRemoveVoucher khi cart thay đổi)
- [x] Copy mã voucher trong condition sheet
- [x] Note "Áp dụng tối đa 1 mã / đơn hàng" dưới search
- [x] Keyboard dismiss khi bấm ngoài input
- [x] 3.1 — Valid/invalid classification (valid trước, invalid mờ)
- [x] 3.2 — Error messages per card (đỏ dưới mỗi invalid card)
- [x] 4.2 — Pagination load more (page accumulation + "Tải thêm")
- [x] 5.1 — Full discount calc (6 combinations: type × applicabilityRule)
- [x] 5.2 — Per-item voucher price (giá gạch ngang + giá sau voucher per item)
