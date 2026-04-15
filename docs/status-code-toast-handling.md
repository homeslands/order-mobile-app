# Status Code & Toast Notification Handling

## 1. Tổng Quan Architecture

```
┌─────────────────────────────────────────────────────────┐
│ API RESPONSE                                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  HTTP 200 ← AxiosError / AxiosResponse                 │
│     ↓                                                   │
│  ├─ response.data.code (backend error code)            │
│  └─ response.data.statusCode (API statusCode)          │
│                                                         │
└────────────┬─────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ ERROR INTERCEPTOR (http.ts / http.unified.ts)           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Extract code từ response.data                         │
│  ↓                                                      │
│  showErrorToast(code)                                   │
│                                                         │
└────────────┬─────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ TOAST UTILITY (toast.ts)                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  errorCodes[code] → messageKey                         │
│  ↓                                                      │
│  i18next.t(messageKey, { ns: 'toast' })               │
│  ↓                                                      │
│  toast.error(translatedMessage)                        │
│                                                         │
└────────────┬─────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ UI - TOAST NOTIFICATION                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Error Message Display]                               │
│  (red background, dismissable, auto-hide)              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Global Error Handling (App.tsx)

```typescript
// Query Errors (GET requests)
onError: (error, query) => {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<IApiResponse<void>>
    if (axiosError.response?.data.code) {
      showErrorToast(axiosError.response.data.code)  // ← Tự động show toast
    }
  }
}

// Mutation Errors (POST/PUT/DELETE requests)
onError: (error, _, __, mutation) => {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<IApiErrorResponse>
    if (axiosError.response?.data.statusCode) {
      showErrorToast(axiosError.response?.data.statusCode)  // ← Tự động show toast
    }
  }
}
```

⚠️ **Chú ý**: Tất cả API errors đều tự động show toast ở level App. Không cần phải handle riêng trong component.

---

## 3. Toast Functions

```typescript
// File: toast.ts

// 1. Show success toast (dùng khi API success)
showToast(message: string)
  → Tìm translations key trong i18n namespace 'toast'
  → Display green notification
  Example: showToast('toast.sendVerifyPhoneNumberSuccess')

// 2. Show error toast (core function)
showErrorToast(code: number)
  → Lookup errorCodes[code] → messageKey
  → If not found → default 'toast.requestFailed'
  → i18next.t(messageKey, { ns: 'toast' })
  → Display red notification
  Example: showErrorToast(101001)  → toast.orderNotFound

// 3. Hook version (dùng trong custom hooks)
useErrorToast(code: number)
  → Same as showErrorToast()
  → Used in custom mutations

// 4. Show error with custom message (override)
showErrorToastMessage(message: string)
  → Directly pass translation key
  → Don't lookup từ errorCodes
  Example: showErrorToastMessage('toast.customErrorMsg')
```

---

## 4. HTTP Status Codes (Standard)

| Code | Message Key | Mô tả |
|------|-------------|--------|
| `401` | `toast.unauthorized` | Không xác thực / token hết hạn |
| `403` | `toast.forbidden` | Không có quyền truy cập |
| `409` | `toast.conflict` | Data bị conflict (duplicate, etc) |
| `429` | `toast.tooManyRequests` | Request quá nhanh, bị rate limit |

---

## 5. Order-Related Error Codes (101000+)

```
┌─────────────────────────────────────────────────────────┐
│ ORDER DOMAIN (101000-101999)                            │
├──────────┬──────────────────────────────────────────────┤
│ Code     │ Message Key / Mô tả                          │
├──────────┼──────────────────────────────────────────────┤
│ 101000   │ toast.ownerNotFound                          │
│          │ → Khách hàng không tồn tại                   │
│                                                         │
│ 101001   │ toast.orderNotFound                          │
│          │ → Đơn hàng không tồn tại                     │
│                                                         │
│ 101002   │ toast.orderStatusInvalid                     │
│          │ → Trạng thái đơn không hợp lệ                │
│                                                         │
│ 101003   │ toast.requestQuantityExcessCurrentQuantity   │
│          │ → Số lượng yêu cầu vượt quá hiện tại        │
│                                                         │
│ 101004   │ toast.orderSlugInvalid                       │
│          │ → Slug đơn không hợp lệ                      │
│                                                         │
│ 101005   │ toast.subtotalNotValid                       │
│          │ → Tổng tiền không hợp lệ                     │
│                                                         │
│ 101006   │ toast.orderTypeInvalid                       │
│          │ → Loại đơn không hợp lệ                      │
│          │ → (AT_TABLE/TAKE_OUT/DELIVERY)               │
│                                                         │
│ 101007   │ toast.createOrderError                       │
│          │ → Lỗi tạo đơn hàng                           │
│                                                         │
│ 101008   │ toast.orderIdInvalid                         │
│          │ → ID đơn không hợp lệ                        │
│                                                         │
│ 101009   │ toast.orderInvalid                           │
│          │ → Đơn hàng không hợp lệ (general)            │
│                                                         │
│ 101010   │ toast.invalidOrderOwner                      │
│          │ → Khách hàng (owner) không hợp lệ            │
│                                                         │
│ 101011   │ toast.invalidOrderApproval                   │
│          │ → Trạng thái phê duyệt không hợp lệ          │
│                                                         │
│ 101012   │ toast.invalidOrderItems                      │
│          │ → Danh sách món không hợp lệ                 │
│                                                         │
│ 101013   │ toast.updateOrderError                       │
│          │ → Lỗi cập nhật đơn hàng                      │
│                                                         │
│ 101014   │ toast.invalidOrderSlug                       │
│          │ → Slug đơn không hợp lệ (duplicate)          │
│                                                         │
│ 101015   │ toast.invalidVoucherSlug                     │
│          │ → Slug voucher không hợp lệ                  │
│                                                         │
│ 101019   │ toast.invalidTableSlug                       │
│          │ → Slug bàn không hợp lệ                      │
│                                                         │
│ 101020   │ toast.invalidVoucherSlug (duplicate)         │
│          │ → Slug voucher không tồn tại                 │
│                                                         │
└──────────┴──────────────────────────────────────────────┘
```

---

## 6. Order Item Error Codes (131000+)

| Code | Message Key | Mô tả |
|------|-------------|--------|
| `131000` | `toast.orderItemNotBelongToAnyOrder` | Item không thuộc đơn nào |
| `131001` | `toast.requestOrderItemGreaterOrderItemQuantity` | Số lượng yêu cầu > hiện tại |
| `131002` | `toast.allOrderItemMustBelongToAOrder` | Tất cả items phải belong một order |
| `131004` | `toast.createOrderItemError` | Lỗi tạo item |
| `131005` | `toast.deleteOrderItemError` | Lỗi xóa item |
| `131006` | `toast.updateOrderItemError` | Lỗi cập nhật item |
| `131007` | `toast.orderItemNotFound` | Item không tồn tại |

---

## 7. Voucher Error Codes (143000+)

```
┌─────────────────────────────────────────────────────────┐
│ VOUCHER DOMAIN (143000-143999)                          │
├──────────┬──────────────────────────────────────────────┤
│ Code     │ Message Key / Mô tả                          │
├──────────┼──────────────────────────────────────────────┤
│ 143001   │ toast.createBranchRevenueError               │
│          │                                              │
│ 143201   │ toast.createRevenueError                     │
│          │ → Lỗi tạo revenue                            │
│                                                         │
│ 143202   │ toast.newRevenueNotFound                     │
│          │ → Revenue mới không tìm thấy                 │
│                                                         │
│ 143401   │ toast.voucherNotFound                        │
│          │ → Voucher không tồn tại                      │
│                                                         │
│ 143402   │ toast.duplicateVoucherCode                   │
│          │ → Mã voucher đã tồn tại                      │
│                                                         │
│ 143407   │ toast.voucherAlreadyUsed                     │
│          │ → Voucher đã được sử dụng                    │
│                                                         │
│ 143408   │ toast.voucherNotActive                       │
│          │ → Voucher chưa active / đã hết hạn           │
│                                                         │
│ 143409   │ toast.orderValueLessThanMinOrderValue        │
│          │ → Giá đơn < minOrderValue của voucher        │
│                                                         │
│ 143410   │ toast.voucherNoRemainingUsage                │
│          │ → Voucher hết lượt sử dụng                   │
│                                                         │
│ 143411   │ toast.userMustBeCustomer                     │
│          │ → User phải là customer mới dùng được        │
│                                                         │
│ 143412   │ toast.validateVoucherUsageFailed             │
│          │ → Validation voucher usage thất bại          │
│                                                         │
│ 143413   │ toast.invalidVoucherType                     │
│          │ → Loại voucher không hợp lệ                  │
│                                                         │
│ 143414   │ toast.invalidNumberOfUsagePerUser            │
│          │ → Số lần dùng per user không hợp lệ          │
│                                                         │
│ 143415   │ toast.duplicateVoucherTitle                  │
│          │ → Tiêu đề voucher đã tồn tại                 │
│                                                         │
│ 143416   │ toast.mustVerifyIdentityToUseVoucher         │
│          │ → Phải xác thực danh tính mới dùng           │
│                                                         │
│ 143417   │ toast.voucherHasOrder                        │
│          │ → Voucher đã có order, không xóa được        │
│                                                         │
│ 143421   │ toast.productNotAppliedToVoucher             │
│          │ → Sản phẩm không được áp dụng voucher        │
│                                                         │
│ 143422   │ toast.voucherProductNotApplicable            │
│          │ → Sản phẩm trong order không match            │
│                                                         │
│ 143424   │ toast.allProductMustBeAppliedToVoucher       │
│          │ → Tất cả product phải được apply              │
│                                                         │
│ 143426   │ toast.voucherExpired                         │
│          │ → Voucher đã hết hạn                         │
│                                                         │
│ 143428   │ toast.mustVerifyIdentityToUseVoucher         │
│          │ → Cần xác thực danh tính                      │
│                                                         │
│ 143429   │ toast.voucherPaymentMethodAlreadyExists      │
│          │ → Payment method đã tồn tại cho voucher       │
│                                                         │
│ 143431   │ toast.voucherPaymentMethodValidationError    │
│          │ → Validation payment method thất bại          │
│                                                         │
│ 143434   │ toast.userNotInUserGroupToApplyVoucher       │
│          │ → User không trong group áp dụng voucher      │
│                                                         │
│ 143435   │ toast.requireVerificationForUserGroup        │
│          │ → Cần xác thực cho user group                 │
│                                                         │
│ 143437   │ toast.cannotUpdateAppliedVoucherForUserGroup │
│          │ → Không thể update voucher đã apply           │
│                                                         │
│ 143443   │ toast.voucherNotAssignedToUser               │
│          │ → Voucher không được gán cho user             │
│                                                         │
│ 143444   │ toast.verificationIdentityMustBeTrueIf...    │
│          │ → Identity verification required              │
│                                                         │
│ 143446   │ toast.assignedUserRequired                   │
│          │ → User assignment yêu cầu                     │
│                                                         │
└──────────┴──────────────────────────────────────────────┘
```

---

## 8. Gift Card Error Codes (158000+)

| Code | Message Key | Mô tả |
|------|-------------|--------|
| `1005` | `toast.giftCardValidationError` | Lỗi validate gift card |
| `1006` | `toast.giftCardUpdated` | Gift card được cập nhật |
| `158205` | `toast.insufficientBalance` | Không đủ số dư gift card |
| `158402` | `toast.giftCardNotFound` | Gift card không tồn tại |
| `158404` | `toast.errorWhenRemoveGiftCard` | Lỗi khi gỡ gift card |
| `158406` | `toast.errorWhenUseGiftCard` | Lỗi khi sử dụng gift card |
| `158408` | `toast.giftCardExpired` | Gift card đã hết hạn |
| `158409` | `toast.giftCardAlreadyUsed` | Gift card đã được sử dụng |

---

## 9. Accumulated Points Error Codes (159000+)

| Code | Message Key | Mô tả |
|------|-------------|--------|
| `159016` | `toast.loyaltyPointAlreadyReserved` | Điểm tích lũy đã được reserve |
| `159017` | `toast.userGroupMemberNotFound` | User group member không tìm thấy |
| `159305` | `toast.branchConfigNotFound` | Cấu hình branch không tìm thấy |
| `159706` | `toast.exceedMaxBalance` | Vượt quá max balance |
| `159707` | `toast.userBalanceExceedMaximum` | User balance vượt quá max |
| `159704` | `toast.policyValueMustBeInteger` | Policy value phải là integer |

---

## 10. Authentication & User Error Codes (119000+)

```
┌─────────────────────────────────────────────────────────┐
│ USER/AUTH DOMAIN (119000-119999)                        │
├──────────┬──────────────────────────────────────────────┤
│ Code     │ Message Key / Mô tả                          │
├──────────┼──────────────────────────────────────────────┤
│ 119000   │ toast.invalidPhoneNumber                     │
│          │ → Số điện thoại không hợp lệ                 │
│                                                         │
│ 119001   │ toast.invalidPassword                        │
│          │ → Mật khẩu không hợp lệ                      │
│                                                         │
│ 119002   │ toast.invalidFirstName                       │
│          │ → Tên không hợp lệ                           │
│                                                         │
│ 119003   │ toast.invalidLastName                        │
│          │ → Họ không hợp lệ                            │
│                                                         │
│ 119004   │ toast.invalidUserId                          │
│          │ → ID user không hợp lệ                       │
│                                                         │
│ 119005   │ toast.userExists                             │
│          │ → User đã tồn tại                            │
│                                                         │
│ 119006   │ toast.userNotFound                           │
│          │ → User không tồn tại                         │
│                                                         │
│ 119007   │ toast.invalidOldPassword                     │
│          │ → Mật khẩu cũ không hợp lệ                   │
│                                                         │
│ 119008   │ toast.forgotTokenExpired                     │
│          │ → Token reset password hết hạn               │
│                                                         │
│ 119009   │ toast.forgotPasswordTokenExists              │
│          │ → Token reset password đã tồn tại            │
│                                                         │
│ 119010   │ toast.invalidCredentials                     │
│          │ → Username/password sai                      │
│                                                         │
│ 119014   │ toast.invalidDob                             │
│          │ → Ngày sinh không hợp lệ                     │
│                                                         │
│ 119016   │ toast.emailAlreadyExists                     │
│          │ → Email đã tồn tại                           │
│                                                         │
│ 119017   │ toast.emailTokenExists                       │
│          │ → Token verify email đã tồn tại              │
│                                                         │
│ 119018   │ toast.emailTokenNotFound                     │
│          │ → Token verify email không tìm thấy          │
│                                                         │
│ 119019   │ toast.emailTokenExpired                      │
│          │ → Token verify email hết hạn                 │
│                                                         │
│ 119020   │ toast.errorWhenConfirmEmailVerification      │
│          │ → Lỗi xác thực email                         │
│                                                         │
│ 119021   │ toast.emailAlreadyExists (dup)               │
│          │                                              │
│ 119022   │ toast.invalidEmail                           │
│          │ → Email không hợp lệ                         │
│                                                         │
│ 119027   │ toast.verifyPhoneNumberTokenExists           │
│          │ → Token verify phone đã tồn tại              │
│                                                         │
│ 119030   │ toast.verifyPhoneNumberTokenNotFound         │
│          │ → Token verify phone không tìm thấy          │
│                                                         │
│ 119033   │ toast.accountDisabled                        │
│          │ → Tài khoản đã bị disable                    │
│                                                         │
│ 119035   │ toast.userPhoneNumberNotVerified             │
│          │ → Số điện thoại chưa được xác thực           │
│                                                         │
│ 119038   │ toast.forgotPasswordTokenNotExists           │
│          │ → Token reset password không tồn tại         │
│                                                         │
└──────────┴──────────────────────────────────────────────┘
```

---

## 11. Payment Error Codes (123000+)

| Code | Message Key | Mô tả |
|------|-------------|--------|
| `123000` | `toast.paymentQueryInvalid` | Query payment không hợp lệ |
| `123001` | `toast.paymentMethodInvalid` | Payment method không hợp lệ |
| `123002` | `toast.paymentNotFound` | Payment không tìm thấy |
| `123003` | `toast.transactionNotFound` | Transaction không tìm thấy |
| `123004` | `toast.onlyBankTransferCanExport` | Chỉ bank transfer mới export được |
| `123005` | `toast.initiatePublicPaymentDenied` | Không thể initiate public payment |
| `123008` | `toast.orderAlreadyHasPayment` | Đơn đã có payment rồi |
| `123010` | `toast.creditCardTransactionIdRequired` | Credit card transaction ID required |

---

## 12. File Upload Error Codes (121000+)

| Code | Message Key | Mô tả |
|------|-------------|--------|
| `121000` | `toast.fileNotFound` | File không tìm thấy |
| `121001` | `toast.fileSizeExceedsLimitAllowed` | Dung lượng file vượt quá giới hạn |
| `121002` | `toast.numberOfFilesExceedLimitAllowed` | Số file vượt quá giới hạn |
| `121003` | `toast.limitUnexpectedFile` | File loại unexpected |
| `121004` | `toast.limitPartCount` | Part count vượt giới hạn |
| `121005` | `toast.limitFieldKey` | Field key vượt giới hạn |
| `121006` | `toast.limitFieldCount` | Field count vượt giới hạn |
| `121007` | `toast.limitFieldValue` | Field value vượt giới hạn |
| `121008` | `toast.multerError` | Multer error |
| `121009` | `toast.errorWhenUploadFile` | Lỗi upload file |
| `121010` | `toast.mustExcelFile` | Phải là file Excel |
| `121011` | `toast.excelFileWrongHeader` | Header file Excel sai |

---

## 13. Client-Only Error Codes (1000-1999)

| Code | Message Key | Mô tả |
|------|-------------|--------|
| `1` | `toast.invalidQuery` | Query không hợp lệ |
| `1000` | `toast.voucherNotFound` | Voucher không tìm thấy |
| `1001` | `toast.minOrderNotMet` | Giá đơn < min order value |
| `1002` | `toast.voucherExpired` | Voucher hết hạn |
| `1003` | `toast.voucherNotValid` | Voucher không hợp lệ |
| `1004` | `toast.minOrderValueNotMet` | Min order value không đạt |
| `1005` | `toast.giftCardValidationError` | Gift card validation lỗi |
| `1006` | `toast.giftCardUpdated` | Gift card được cập nhật |
| `1041` | `toast.createTrackingFailed` | Tạo tracking thất bại |
| `1042` | `toast.unloggedIn` | Chưa đăng nhập |
| `1010010` | `toast.invalidOrderOwner` | Order owner không hợp lệ |
| `1010011` | `toast.invalidOrderApproval` | Order approval không hợp lệ |
| `1010012` | `toast.invalidOrderItems` | Order items không hợp lệ |
| `1010013` | `toast.updateOrderError` | Lỗi update order |
| `1010014` | `toast.invalidOrderSlug` | Order slug không hợp lệ |
| `1010015` | `toast.requestQuantityMustOtherInfinity` | Quantity phải other infinity |
| `1010016` | `toast.errorWhenCreateChefOrdersFromOrder` | Lỗi tạo chef orders |
| `1010019` | `toast.invalidTableSlug` | Table slug không hợp lệ |
| `1010020` | `toast.invalidVoucherSlug` | Voucher slug không hợp lệ |

---

## 14. Fallback & Default Behavior

```typescript
// Nếu statusCode không có trong errorCodes mapping
const messageKey = errorCodes[code] || 'toast.requestFailed'

// → Hiển thị: "Yêu cầu thất bại" (hoặc tùy theo i18n config)
```

⚠️ **Lưu ý**: Luôn có fallback message `'toast.requestFailed'` cho status code chưa được map.

---

## 15. Usage Examples Trong Components

### Example 1: Form Forgot Password
```typescript
const { mutate } = useForgotPasswordMutation()

const handleForgotPassword = async (phone: string) => {
  mutate(
    { phone },
    {
      onSuccess: (response) => {
        showToast('toast.sendVerifyPhoneNumberSuccess')  // Show success manually
        setStep(2)
      }
      // onError: Tự động xử lý bởi global error handler
      // → showErrorToast(statusCode) được gọi tự động
    }
  )
}
```

### Example 2: Order Update
```typescript
const handleUpdateOrder = async (orderSlug: string, draft: IOrderToUpdate) => {
  // API call via useUpdateOrderMutation hook
  mutate(
    { orderSlug, data: draft },
    {
      onSuccess: (data) => {
        showToast('toast.updateOrderSuccess')
        navigateToPayment()
      }
      // Error handling tự động từ global handler
    }
  )
}
```

### Example 3: Manual Error Handling (khi cần custom)
```typescript
const handleApplyVoucher = async (voucher: IVoucher) => {
  try {
    await applyVoucherAPI(voucher)
    showToast('toast.voucherAppliedSuccess')
  } catch (error) {
    if (isAxiosError(error) && error.response?.data?.statusCode) {
      // Custom handling cho 1 status code cụ thể
      if (error.response.data.statusCode === 143428) {
        // Voucher yêu cầu verification
        openVerificationDialog()
      } else {
        // Default error toast
        showErrorToast(error.response.data.statusCode)
      }
    }
  }
}
```

---

## 16. Toast Message Localization

Tất cả toast messages đều được i18n translate với namespace `'toast'`:

```typescript
showErrorToast(101001)
  ↓
errorCodes[101001] = 'toast.orderNotFound'
  ↓
i18next.t('toast.orderNotFound', { ns: 'toast' })
  ↓
Lookup trong i18n JSON: en/toast.json, vi/toast.json
  ↓
Display translated message (English, Vietnamese, etc.)
```

**File translations**:
- `app/order-ui/locales/en/toast.json` (English messages)
- `app/order-ui/locales/vi/toast.json` (Vietnamese messages)

---

## 17. Toast Behavior Configuration

```typescript
// react-hot-toast configuration
toast.success(message, {
  duration: 4000,        // Auto-dismiss sau 4 giây
  position: 'top-right', // Vị trí hiển thị
  // ... other options
})

toast.error(message, {
  duration: 5000,        // Lâu hơn success (user cần đọc error)
  position: 'top-right'
})
```

---

## 18. Tóm Tắt Status Code Handling

```
┌─────────────────────────────────────────────────────────┐
│ STATUS CODE → TOAST FLOW                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. API Response chứa statusCode/code                   │
│     ↓                                                   │
│  2. Global error interceptor catch lỗi                 │
│     ↓                                                   │
│  3. Call showErrorToast(code)                          │
│     ↓                                                   │
│  4. Lookup errorCodes[code] → messageKey               │
│     ↓                                                   │
│  5. i18next.t(messageKey, { ns: 'toast' })            │
│     ↓                                                   │
│  6. toast.error(translatedMessage)                     │
│     ↓                                                   │
│  7. UI displays toast notification (red, dismissable)  │
│     ↓                                                   │
│  8. Auto-dismiss sau 5 giây (hoặc user click close)   │
│                                                         │
│ ✓ Không cần component tự implement error handling       │
│ ✓ Nhất quán across toàn app                            │
│ ✓ Dễ dàng add custom handling khi cần                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 19. Status Code Mapping Reference Table

Tất cả ~320 status codes được map tại file [toast.ts](../app/order-ui/src/utils/toast.ts)

**Danh mục chính:**
- **HTTP Status**: 401, 403, 409, 429
- **Order Domain**: 101000-101999 (20 codes)
- **Order Item**: 131000-131999 (7 codes)
- **Voucher**: 143000-143999 (40+ codes)
- **Gift Card**: 158000-158999 (8 codes)
- **Accumulated Points**: 159000-159999 (6 codes)
- **Auth/User**: 119000-119999 (30+ codes)
- **Payment**: 123000-123999 (8 codes)
- **File Upload**: 121000-121999 (12 codes)
- **Client-only**: 1000-1999 (18 codes)

**Lookup tool**: Tìm một statusCode cụ thể bằng Ctrl+F trong file này, sau đó tìm message key tương ứng trong i18n translation files.
