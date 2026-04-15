# Feature 4: Voucher List Filter by Payment Method

## Mô tả
Khi mở voucher sheet trong màn payment, tự động truyền `paymentMethod` hiện tại vào query để chỉ hiển thị voucher compatible với phương thức đang chọn.

---

## Files cần tạo mới

### `app/payment/voucher-sheet-in-payment.tsx`

Fork từ `VoucherSheetInUpdateOrder` nhưng:
- Nhận `currentPaymentMethod` prop → truyền vào voucher query
- Thay store-based calls bằng direct props từ `order`
- Apply/remove voucher qua `useUpdateVoucherInOrder` / `useUpdatePublicVoucherInOrder`

Props interface:
```typescript
interface VoucherSheetInPaymentProps {
  visible: boolean
  onClose: () => void
  isDark: boolean
  primaryColor: string
  order: IOrder
  currentPaymentMethod: PaymentMethod | null
  isLoggedIn: boolean
  onVoucherApplied: () => void   // → refetchOrder()
  onVoucherRemoved: () => void   // → refetchOrder() + resetLoyaltyPoints (Feature 3)
}
```

---

## Files cần sửa

### `app/payment/[order].tsx`

State mới:
```typescript
const [showVoucherSheet, setShowVoucherSheet] = useState(false)
```

Button trigger (trong Payment Summary card hoặc riêng, chỉ show khi `order.status === PENDING`):
```tsx
{order.status === OrderStatus.PENDING && (
  <Pressable
    onPress={() => setShowVoucherSheet(true)}
    style={[ps.voucherBtn, { borderColor: isDark ? colors.gray[700] : colors.gray[200] }]}
  >
    <TicketPercent size={16} color={primaryColor} />
    <Text style={[ps.voucherBtnText, { color: primaryColor }]}>
      {order.voucher
        ? `${order.voucher.code} · ${formatCurrency(cartTotals?.voucherDiscount ?? 0)} giảm`
        : 'Thêm mã giảm giá'}
    </Text>
    <ChevronRight size={16} color={isDark ? colors.gray[400] : colors.gray[500]} />
  </Pressable>
)}
```

Mount sheet:
```tsx
<VoucherSheetInPayment
  visible={showVoucherSheet}
  onClose={() => setShowVoucherSheet(false)}
  isDark={isDark}
  primaryColor={primaryColor}
  order={order}
  currentPaymentMethod={selectedPaymentMethod}
  isLoggedIn={isLoggedIn}
  onVoucherApplied={refetchOrder}
  onVoucherRemoved={() => {
    refetchOrder()
    resetLoyaltyPointsInput()  // Feature 3
  }}
/>
```

---

## Logic chi tiết — `voucher-sheet-in-payment.tsx`

### Query params với paymentMethod filter

```typescript
// Derived data từ order
const orderItems = order.orderItems
const subTotal = order.originalSubtotal ?? order.subtotal  // dùng original cho minOrderValue

const listRequestItems = useMemo(
  () =>
    orderItems.map((item) => ({
      quantity: item.quantity,
      variant: item.variant?.slug ?? '',
      promotion: (item.promotionValue ?? 0) > 0 ? (item.promotion?.slug ?? '') : '',
      order: order.slug,
    })),
  [orderItems, order.slug],
)

const voucherParams = useMemo<IGetAllVoucherRequest | undefined>(
  () =>
    visible
      ? {
          hasPaging: true,
          page: currentPage,
          size: 10,
          minOrderValue: subTotal,
          orderItems: listRequestItems,
          // KEY: filter theo payment method hiện tại
          ...(currentPaymentMethod ? { paymentMethod: currentPaymentMethod } : {}),
          ...(isLoggedIn && userSlug ? { user: userSlug } : {}),
        }
      : undefined,
  [visible, currentPage, subTotal, listRequestItems, currentPaymentMethod, isLoggedIn, userSlug],
)
```

Khi `currentPaymentMethod` thay đổi (ít xảy ra nhưng có thể):
- `voucherParams` tự cập nhật → query refetch với filter mới
- Reset `currentPage = 1` và `allVouchers = []`

### Apply voucher (2-step: validate → apply)

```typescript
const { mutate: updateVoucher, isPending: isApplying } = isLoggedIn
  ? useUpdateVoucherInOrder()
  : useUpdatePublicVoucherInOrder()

const { mutate: validateVoucher } = useValidateVoucher()

const handleApplyVoucher = useCallback(() => {
  if (!selectedVoucher || !order.slug) return

  // Nếu chọn lại voucher đang active → chỉ đóng sheet
  if (order.voucher?.slug === selectedVoucher.slug) {
    onClose()
    return
  }

  setIsValidating(true)

  validateVoucher(
    {
      voucher: selectedVoucher.slug,
      user: userSlug ?? '',
      orderItems: listRequestItems,
    },
    {
      onSuccess: () => {
        updateVoucher(
          {
            slug: order.slug,
            voucher: selectedVoucher.slug,
            orderItems: listRequestItems,
          },
          {
            onSuccess: () => {
              onVoucherApplied()
              onClose()
            },
            onError: () => showToast('Không thể áp dụng voucher'),
          }
        )
      },
      onError: () => showToast('Voucher không hợp lệ'),
      onSettled: () => setIsValidating(false),
    }
  )
}, [selectedVoucher, order, userSlug, listRequestItems, updateVoucher, validateVoucher, onVoucherApplied, onClose])
```

### Remove voucher

```typescript
const handleRemoveVoucher = useCallback(() => {
  if (!order.slug) return
  updateVoucher(
    { slug: order.slug, voucher: null, orderItems: listRequestItems },
    {
      onSuccess: () => {
        onVoucherRemoved()
        onClose()
      },
      onError: () => showToast('Không thể xóa voucher'),
    }
  )
}, [order.slug, listRequestItems, updateVoucher, onVoucherRemoved, onClose])
```

### Filter label trong sheet header

```typescript
const filterLabel = useMemo(() => {
  if (!currentPaymentMethod) return null
  const labels: Record<PaymentMethod, string> = {
    [PaymentMethod.BANK_TRANSFER]: 'Chuyển khoản',
    [PaymentMethod.CASH]: 'Tiền mặt',
    [PaymentMethod.POINT]: 'Điểm tích lũy',
    [PaymentMethod.CREDIT_CARD]: 'Thẻ tín dụng',
  }
  return labels[currentPaymentMethod]
}, [currentPaymentMethod])

// Header:
// "Chọn mã giảm giá"
// {filterLabel && <Text>Hiển thị voucher tương thích với {filterLabel}</Text>}
```

### Voucher selection state

```typescript
// Pre-fill với voucher hiện tại khi mở sheet
const [selectedVoucher, setSelectedVoucher] = useState<IVoucher | null>(null)

useEffect(() => {
  if (visible) {
    setSelectedVoucher(order.voucher ?? null)
    setCurrentPage(1)
    setAllVouchers([])
  }
}, [visible])

// Toggle select: click cùng voucher → deselect
const handleVoucherClick = (voucher: IVoucher) => {
  setSelectedVoucher((prev) => prev?.slug === voucher.slug ? null : voucher)
}
```

---

## Edge Cases

| Case | Xử lý |
|------|--------|
| `currentPaymentMethod` null | Không truyền `paymentMethod` → show tất cả voucher |
| Method thay đổi khi sheet đang mở | `voucherParams` update → query refetch, reset page + list |
| Backend không support filter | Returns all → show tất cả, không có lỗi |
| Voucher hiện tại không trong filtered list | Pre-fill selected vẫn hiển thị (highlight), cảnh báo không compatible |
| Chọn cùng voucher đang active | Chỉ đóng sheet, không gọi API |
| Pagination khi đổi filter | Reset `currentPage = 1`, `allVouchers = []` khi `currentPaymentMethod` thay đổi |
| `updateVoucherInOrder` vs `updatePublicVoucherInOrder` | Chọn theo `isLoggedIn` |
| Apply thất bại (conflict phía backend) | Toast error, không đóng sheet |
| `originalSubtotal` không có | Fallback về `order.subtotal` |

---

## Cần verify trước khi implement

**Câu hỏi quan trọng**: API `GET /vouchers/for-order` có nhận param `paymentMethod` không?
- Type `IGetAllVoucherRequest` trong `types/voucher.type.ts` có field `paymentMethod?: string` → **assume backend support**
- Nếu backend chưa support → thêm client-side filter sau khi nhận danh sách:
  ```typescript
  const filteredVouchers = currentPaymentMethod
    ? allVouchers.filter(v =>
        !v.voucherPaymentMethods?.length ||
        v.voucherPaymentMethods.some(vpm => vpm.paymentMethod === currentPaymentMethod)
      )
    : allVouchers
  ```

---

## Thứ tự implement

1. Verify API support `paymentMethod` filter (test bằng curl hoặc hỏi BE)
2. Tạo `voucher-sheet-in-payment.tsx` — skeleton + props
3. Implement `voucherParams` với `paymentMethod` conditional
4. Implement voucher list rendering (reuse `VoucherCard` component hiện có)
5. Implement `handleApplyVoucher` (validate → apply flow)
6. Implement `handleRemoveVoucher`
7. Implement filter label header
8. Sửa `[order].tsx`: thêm `showVoucherSheet` state, button trigger, mount sheet
9. Test client-side filter fallback nếu backend không support

---

## Verification

- Chọn "Chuyển khoản" → mở voucher sheet → header hiện "tương thích với Chuyển khoản" → chỉ thấy voucher support bank-transfer
- Chưa chọn method → mở sheet → thấy tất cả voucher, không có filter label
- Chọn voucher → "Áp dụng" → validate → apply → order refetch → voucher hiện trong receipt
- Voucher đang active → mở sheet → đóng không chọn gì → không thay đổi
- Xóa voucher trong sheet → `onVoucherRemoved` → refetch + reset loyalty points
- Pagination: cuộn xuống → load page 2 → vẫn filter đúng
