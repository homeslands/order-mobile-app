# Perf Voucher Sheet — Performance Fixes

Các fix cho PerfVoucherSheet, sắp theo impact giảm dần.

---

## F1 — Stable onSelect callback (V2)
**Impact:** Cao — giảm N card re-renders → 2 khi select
**Effort:** Thấp

Hiện tại: inline `onSelect={() => setSelectedVoucher(...)}` trong `.map()` → function mới mỗi render → tất cả cards re-render.

Fix: Card nhận `onSelect(slug: string)`, parent có 1 stable callback:
```tsx
const handleSelect = useCallback((slug: string) => {
  setSelectedVoucher(prev => prev?.slug === slug ? null : allVouchers.find(v => v.slug === slug) ?? null)
}, [allVouchers])
```

**File:** `components/perf/cart-content.tsx` — valid + invalid voucher list sections

---

## F2 — Remove useTranslation inside PerfVoucherCard (V1)
**Impact:** Cao — giảm N subscriptions → 0 per card
**Effort:** Thấp

Hiện tại: Card có `const { t: tLocal } = useTranslation(['voucher'])` làm fallback. 10 cards = 10 subscriptions.

Fix: Bỏ fallback, require `t` prop:
```tsx
// Bỏ:
const { t: tLocal } = useTranslation(['voucher'])
const t = tFn ?? tLocal

// Thành:
// t is required prop, no fallback hook
```

**File:** `components/perf/cart-content.tsx` — PerfVoucherCard

---

## F3 — Fix setState in render body (V6 + V7)
**Impact:** Trung bình — bỏ 2 extra renders
**Effort:** Thấp

Hiện tại: `setCode`, `setSearchCode`, `setSelectedVoucher`, `setAllVouchers` gọi trong render body (không phải useEffect).

Fix: Chuyển vào `useEffect` với deps đúng:
```tsx
// Pre-fill
useEffect(() => {
  if (visible && currentVoucher) {
    setCode(currentVoucher.code)
    setSearchCode(currentVoucher.code)
    setSelectedVoucher(currentVoucher)
  }
}, [visible, currentVoucher])

// Accumulate pages
useEffect(() => {
  if (!eligibleRes?.result?.items) return
  // ... set allVouchers logic
}, [eligibleRes?.result, currentPage])
```

**File:** `components/perf/cart-content.tsx` — PerfVoucherSheet

---

## F4 — Memoize processVoucherList deps (V5)
**Impact:** Trung bình — tránh recalc khi t ref đổi
**Effort:** Thấp

Hiện tại: `tVoucher` từ `useTranslation` tạo ref mới mỗi render → `processed` useMemo invalidate.

Fix: Extract translated strings 1 lần, dùng object stable thay vì `t` function:
```tsx
const voucherLabels = useMemo(() => ({
  needVerify: tVoucher('voucher.needVerifyIdentity'),
  expired: tVoucher('voucher.expired'),
  outOfStock: tVoucher('voucher.outOfStock'),
  minOrderNotMet: tVoucher('voucher.minOrderNotMet'),
  requireOnly: tVoucher('voucher.requireOnlyApplicableProducts'),
  requireSome: tVoucher('voucher.requireSomeApplicableProducts'),
}), [tVoucher])
```
Hoặc đơn giản hơn: chỉ tính `processed` khi `rawEligibleVouchers` thay đổi, bỏ `tVoucher` khỏi deps (t strings ít khi đổi).

**File:** `components/perf/cart-content.tsx` — processed useMemo

---

## F5 — Reduce idle React Query hooks (V4)
**Impact:** Thấp — giảm 2 idle hook allocations
**Effort:** Trung bình

Hiện tại: 4 query hooks luôn mount (2 private + 2 public), chỉ 2 active.

Fix: Dùng 1 hook wrapper cho mỗi cặp:
```tsx
const fetchFn = isCustomerOwner ? getVouchersForOrder : getPublicVouchersForOrder
const queryKey = isCustomerOwner ? QUERYKEY.vouchersForOrder : QUERYKEY.publicVouchersForOrder

const { data: eligibleRes } = useQuery({
  queryKey: [queryKey, paginatedParams],
  queryFn: () => fetchFn(paginatedParams),
  enabled: visible && items.length > 0,
})
```
Tương tự cho specific voucher + validate.

**File:** `components/perf/cart-content.tsx` — PerfVoucherSheet hooks

---

## Checklist

- [x] F1 — Stable onSelect (V2) — handleSelectBySlug shared, N→2 re-renders
- [x] F2 — Remove useTranslation from card (V1) — t required prop, 0 hooks per card
- [x] F3 — setState in useEffect (V6+V7) — 3 blocks moved, bỏ 2 extra renders
- [x] F4 — Memoize processVoucherList deps (V5) — tVoucherRef, bỏ t khỏi deps
- [x] F5 — Reduce idle query hooks (V4) — 4 hooks → 2, conditional fetch fn

## Priority

**F1 + F2** trước — effort thấp, impact cao nhất. Giảm N×re-renders + N×subscriptions ngay.
