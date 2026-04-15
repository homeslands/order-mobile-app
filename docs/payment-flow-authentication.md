# Payment Flow - Authenticated vs Unauthenticated Users

## 1. Tổng Quan

```
┌──────────────────────────────────────────────────────────┐
│ PAYMENT ROUTE STRUCTURE                                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  🛒 Customer Journey                                     │
│  └─ Order Created (public or authenticated)              │
│     ├─ Order slug: ABC123                               │
│     └─ Navigate to payment with: ?order=ABC123          │
│                                                          │
│  📍 Route: /payment                                     │
│  ├─ Unauthenticated user (guest)                       │
│  │  ├─ No token                                         │
│  │  ├─ No userInfo in store                             │
│  │  └─ Available payment: BANK_TRANSFER only            │
│  │                                                      │
│  ├─ Authenticated customer                              │
│  │  ├─ Has token                                        │
│  │  ├─ userInfo.role = CUSTOMER                         │
│  │  └─ Available payment: BANK_TRANSFER, POINT          │
│  │                                                      │
│  └─ (Staff uses /system/payment instead)                │
│                                                          │
│  📍 Route: /system/payment (Staff only)                  │
│  └─ Authenticated staff/admin                           │
│     ├─ Has token                                        │
│     ├─ userInfo.role = STAFF/ADMIN                      │
│     └─ Available payment: BANK_TRANSFER, CASH,          │
│        CREDIT_CARD, POINT                              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Route Definition

### 2.1 Client Payment Route (Both Authenticated & Unauthenticated)

```typescript
// File: src/router/index.tsx (Line 1184)

{
  path: ROUTE.CLIENT_PAYMENT,  // = '/payment'
  element: <ClientPaymentPage />,
  // NO ProtectedElement wrapper
  // → Works for both authenticated & unauthenticated users
}
```

**Route Key**: `ROUTE.CLIENT_PAYMENT = '/payment'`

✅ **Public route** - No authentication required
✅ **Works for both**: Guests & logged-in customers
✅ **Component**: `ClientPaymentPage()` from `/app/client/payment/page.tsx`

### 2.2 Staff Payment Route (Authenticated Only)

```typescript
// File: src/router/index.tsx (Line 313)

{
  path: ROUTE.STAFF_ORDER_PAYMENT,  // = '/system/payment'
  element: (
    <ProtectedElement>
      <PaymentPage />
    </ProtectedElement>
  ),
  // ProtectedElement wrapper
  // → Only accessible to authenticated staff
}
```

**Route Key**: `ROUTE.STAFF_ORDER_PAYMENT = '/system/payment'`

✅ **Protected route** - Authentication required
✅ **Works for**: Staff/Admin only
✅ **Component**: `PaymentPage()` from `/app/system/payment/payment-page.tsx`

---

## 3. Authentication Detection in Payment Page

### 3.1 Client Payment Page (Handles Both Cases)

```typescript
// File: src/app/client/payment/page.tsx (Line 29)

export function ClientPaymentPage() {
  const { userInfo } = useUserStore()  // From auth store

  // Detect if authenticated
  const isUnauthenticated = !userInfo
  const isCustomer = userInfo?.role.name === Role.CUSTOMER
  const isStaff = userInfo?.role.name === Role.STAFF

  // Conditional rendering based on auth state
  if (isUnauthenticated) {
    // Guest checkout flow
  } else if (isCustomer) {
    // Customer flow (can use loyalty points, etc)
  } else if (isStaff) {
    // Staff accessing client payment (rare)
  }
}
```

### 3.2 Staff Payment Page (Authenticated Only)

```typescript
// File: src/app/system/payment/payment-page.tsx (Line 83)

export function PaymentPage() {
  const { userInfo } = useUserStore()
  // Already protected by ProtectedElement wrapper
  // → userInfo is guaranteed to exist

  const { ... } = usePaymentResolver(
    orderData || null,
    Role.STAFF,  // Always STAFF here
    paymentData?.paymentMethod || null
  )
}
```

---

## 4. Payment Method Availability by Role

### 4.1 Payment Methods Enum

```typescript
// File: src/constants/payment.ts

export enum PaymentMethod {
  BANK_TRANSFER = 'bank-transfer',   // ✅ All roles
  CASH = 'cash',                     // ❌ Guests, ✅ Staff
  POINT = 'point',                   // ❌ Guests, ✅ Customers/Staff
  CREDIT_CARD = 'credit-card',       // ❌ Guests, ✅ Staff
}
```

### 4.2 Role-Based Method Selection

```typescript
// File: src/utils/payment-resolver.ts

function getAvailableMethodsByRole(role: Role | null): PaymentMethod[] {
  if (!role) {
    // Unauthenticated (Guest)
    return [
      PaymentMethod.BANK_TRANSFER
    ]
  }

  if (role === Role.CUSTOMER) {
    // Authenticated Customer
    return [
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.POINT
    ]
  }

  if (role === Role.STAFF || role === Role.ADMIN) {
    // Staff/Admin
    return [
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.CASH,
      PaymentMethod.CREDIT_CARD,
      PaymentMethod.POINT
    ]
  }

  return [PaymentMethod.BANK_TRANSFER]  // Default fallback
}
```

### 4.3 Available Payment Methods Table

| Payment Method | Unauthenticated | Customer | Staff |
|---|---|---|---|
| **BANK_TRANSFER** | ✅ | ✅ | ✅ |
| **CASH** | ❌ | ❌ | ✅ |
| **CREDIT_CARD** | ❌ | ❌ | ✅ |
| **POINT** (Loyalty) | ❌ | ✅ | ✅ |

---

## 5. API Endpoints - Different by Authentication

### 5.1 Payment Initiation Endpoints

```typescript
// File: src/api/order.ts (Line 88-96)

// For AUTHENTICATED users
export async function initiatePayment(
  params: IInitiatePaymentRequest,
): Promise<IApiResponse<IPayment>> {
  return await http.post<IApiResponse<IPayment>>(
    `/payment/initiate`,  // ← Authenticated endpoint
    params,
  )
}

// For UNAUTHENTICATED users (guests)
export async function initiatePublicPayment(
  params: IInitiatePaymentRequest,
): Promise<IApiResponse<IPayment>> {
  return await http.post<IApiResponse<IPayment>>(
    `/payment/initiate/public`,  // ← Public endpoint
    params,
  )
}
```

### 5.2 Voucher Validation Endpoints

```typescript
// File: src/api/voucher.ts

// For AUTHENTICATED users
export async function validateVoucherPaymentMethod(
  voucherSlug: string,
  paymentMethod: PaymentMethod,
): Promise<IApiResponse<void>> {
  return await http.post<IApiResponse<void>>(
    `/vouchers/${voucherSlug}/validate-payment-method`,
    { paymentMethod },
  )
}

// For UNAUTHENTICATED users (guests)
export async function validatePublicVoucherPaymentMethod(
  voucherSlug: string,
  paymentMethod: PaymentMethod,
): Promise<IApiResponse<void>> {
  return await http.post<IApiResponse<void>>(
    `/vouchers/${voucherSlug}/validate-payment-method/public`,
    { paymentMethod },
  )
}
```

### 5.3 Which Hook to Use

```typescript
// In Client Payment Page

const { mutate: initiatePayment } = useInitiatePayment()
const { mutate: initiatePublicPayment } = useInitiatePublicPayment()

const { mutate: validateVoucherPaymentMethod } =
  useValidateVoucherPaymentMethod()
const { mutate: validatePublicVoucherPaymentMethod } =
  useValidatePublicVoucherPaymentMethod()

// In handleConfirmPayment() method
if (!userInfo) {
  // UNAUTHENTICATED
  initiatePublicPayment(...)  // ← Public endpoint
  validatePublicVoucherPaymentMethod(...)  // ← Public endpoint
} else {
  // AUTHENTICATED
  initiatePayment(...)  // ← Auth endpoint
  validateVoucherPaymentMethod(...)  // ← Auth endpoint
}
```

---

## 6. Payment Flow - Detailed Steps

### 6.1 Client Payment Page Flow (Unauthenticated)

```
┌─────────────────────────────────────────────────────┐
│ GUEST CHECKOUT (Unauthenticated)                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Step 1: Enter Payment Page                         │
│ └─ GET /payment?order=ABC123                       │
│    └─ useOrderBySlug('ABC123')                     │
│       └─ GET /orders/ABC123 (public)               │
│                                                     │
│ Step 2: Render Payment Methods                     │
│ └─ availableMethods = [BANK_TRANSFER]              │
│    (POINT not available for guests)                │
│                                                     │
│ Step 3: Guest Selects BANK_TRANSFER                │
│ └─ handleSelectPaymentMethod(BANK_TRANSFER)       │
│    ├─ Check if voucher compatible                  │
│    └─ validatePublicVoucherPaymentMethod(...)     │
│       └─ POST /vouchers/.../validate-payment-method/public
│                                                     │
│ Step 4: Review & Confirm                           │
│ └─ handleConfirmPayment()                          │
│    ├─ Validate order data                         │
│    ├─ Prepare payment request                      │
│    └─ POST initiatePublicPayment()                │
│       └─ POST /payment/initiate/public             │
│                                                     │
│ Step 5: Response & Polling                         │
│ ├─ Receive: { qrCode, bankCode, paymentId, ... }  │
│ ├─ Display QR code to guest                        │
│ ├─ Poll for payment status (every 2s)              │
│ │  └─ GET /orders/ABC123                          │
│ │     └─ Check orderStatus = PAID?                │
│ │                                                  │
│ └─ When PAID:                                      │
│    └─ Navigate /client/order-success/ABC123       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 6.2 Client Payment Page Flow (Authenticated Customer)

```
┌─────────────────────────────────────────────────────┐
│ CUSTOMER CHECKOUT (Authenticated)                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Step 1: Enter Payment Page                         │
│ └─ GET /payment?order=ABC123                       │
│    └─ useOrderBySlug('ABC123')                     │
│       └─ GET /orders/ABC123 (auth)                │
│          Authorization: Bearer <token>             │
│                                                     │
│ Step 2: Render Payment Methods                     │
│ └─ availableMethods = [                            │
│      BANK_TRANSFER,                               │
│      POINT (Loyalty)                              │
│    ]                                               │
│    └─ Display loyalty points balance               │
│                                                     │
│ Step 3: Customer Selects POINT (Loyalty)           │
│ └─ handleSelectPaymentMethod(POINT)               │
│    ├─ Check if voucher compatible                  │
│    └─ validateVoucherPaymentMethod(...)           │
│       └─ POST /vouchers/.../validate-payment-method
│          Authorization: Bearer <token>             │
│                                                     │
│ Step 4: Apply Loyalty Points (Optional)            │
│ └─ selectLoyaltyPoints(50)  // Use 50 points      │
│    └─ Update UI with discount                      │
│                                                     │
│ Step 5: Review & Confirm                           │
│ └─ handleConfirmPayment()                          │
│    ├─ Validate order data                         │
│    ├─ Prepare payment request                      │
│    │  {                                            │
│    │    "orderId": "...",                         │
│    │    "paymentMethod": "point",                 │
│    │    "loyaltyPointsToUse": 50,                │
│    │    "amount": finalAmount                     │
│    │  }                                            │
│    └─ POST initiatePayment()                      │
│       └─ POST /payment/initiate                    │
│          Authorization: Bearer <token>             │
│                                                     │
│ Step 6: Response & Polling                         │
│ ├─ Receive: { transactionId, paymentId, ... }     │
│ ├─ Start polling for payment status                │
│ │  └─ GET /orders/ABC123                          │
│ │     └─ Check orderStatus = PAID?                │
│ │                                                  │
│ └─ When PAID:                                      │
│    └─ Navigate /client/order-success/ABC123       │
│       └─ Update loyalty points (deducted)          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 6.3 Staff Payment Page Flow

```
┌─────────────────────────────────────────────────────┐
│ STAFF PAYMENT (Authenticated Staff/Admin)           │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Step 1: Protection Check                           │
│ └─ ProtectedElement validates token                │
│    ├─ Extract userInfo from store                  │
│    ├─ Check: role = STAFF/ADMIN? ✅               │
│    └─ Grant access to /system/payment              │
│                                                     │
│ Step 2: Enter Payment Page                         │
│ └─ GET /system/payment?order=ABC123                │
│    └─ useOrderBySlug('ABC123')                     │
│       └─ GET /orders/ABC123 (auth)                │
│          Authorization: Bearer <token>             │
│                                                     │
│ Step 3: Render Payment Methods                     │
│ └─ availableMethods = [                            │
│      BANK_TRANSFER,                               │
│      CASH,                                         │
│      CREDIT_CARD,                                 │
│      POINT (Loyalty)                              │
│    ]                                               │
│    └─ All methods available                        │
│                                                     │
│ Step 4: Staff Selects CASH (example)               │
│ └─ handleSelectPaymentMethod(CASH)                │
│    ├─ Check if voucher compatible                  │
│    └─ validateVoucherPaymentMethod(...)           │
│       └─ POST /vouchers/.../validate-payment-method
│          Authorization: Bearer <token>             │
│                                                     │
│ Step 5: Review & Confirm                           │
│ └─ handleConfirmPayment()                          │
│    ├─ Validate order data                         │
│    ├─ Prepare payment request                      │
│    └─ POST initiatePayment()                      │
│       └─ POST /payment/initiate                    │
│          Authorization: Bearer <token>             │
│                                                     │
│ Step 6: Processing                                 │
│ ├─ CASH: Immediate marking as PAID                │
│ ├─ BANK_TRANSFER: Show QR for verification        │
│ ├─ CREDIT_CARD: Process transaction                │
│ ├─ Poll for status changes                         │
│ │  └─ GET /orders/ABC123                          │
│ │     └─ Check orderStatus = PAID?                │
│ │                                                  │
│ └─ When PAID:                                      │
│    └─ Navigate /order-success/ABC123              │
│       └─ Staff notification displayed              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 7. Code Implementation - Payment Confirmation

### 7.1 Client Payment Page - Conditional Logic

```typescript
// File: src/app/client/payment/page.tsx (Line 359-480)

const handleConfirmPayment = () => {
  const paymentRequest = {
    orderId: orderData?.id,
    paymentMethod: selectedPaymentMethod,
    amount: totalAmount,
    ...(selectedLoyaltyPoints && {
      accumulatedPointsToUse: selectedLoyaltyPoints
    }),
  }

  if (!userInfo) {
    // ========== UNAUTHENTICATED (GUEST) ==========

    if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
      // Guest can only pay via bank transfer
      setIsLoading(true)

      initiatePublicPayment(paymentRequest)  // ← PUBLIC endpoint
        .then(response => {
          // Show QR code
          handlePaymentSuccess(response)
        })
        .catch(error => {
          // Error automatically shown as toast
          setIsLoading(false)
        })
    }

  } else if (userInfo.role.name === Role.CUSTOMER) {
    // ========== AUTHENTICATED CUSTOMER ==========

    if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
      setIsLoading(true)

      initiatePayment(paymentRequest)  // ← AUTH endpoint
        .then(response => {
          handlePaymentSuccess(response)
        })
        .catch(error => {
          setIsLoading(false)
        })

    } else if (paymentMethod === PaymentMethod.POINT) {
      // Use loyalty points
      setIsLoading(true)

      initiatePayment({
        ...paymentRequest,
        accumulatedPointsToUse: selectedLoyaltyPoints,
      })  // ← AUTH endpoint
        .then(response => {
          // Deduct points from account
          updateUserLoyaltyPoints(response.pointsDeducted)
          handlePaymentSuccess(response)
        })
        .catch(error => {
          setIsLoading(false)
        })
    }

  } else {
    // ========== STAFF ACCESSING CLIENT PAYMENT ==========
    // (rare case, but handled)
    initiatePayment(paymentRequest)  // ← AUTH endpoint
      .then(response => {
        handlePaymentSuccess(response)
      })
      .catch(error => {
        setIsLoading(false)
      })
  }
}

// Payment success - start polling
const handlePaymentSuccess = (paymentResponse: IPayment) => {
  setPaymentData(paymentResponse)
  startPollingOrderStatus()  // Check status every 2 seconds
}
```

### 7.2 Staff Payment Page - No Conditional Logic

```typescript
// File: src/app/system/payment/payment-page.tsx (Line 439-500+)

const handleConfirmPayment = () => {
  const paymentRequest = {
    orderId: orderData?.id,
    paymentMethod: selectedPaymentMethod,
    amount: totalAmount,
  }

  // Always use authenticated endpoint (no conditional)

  if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
    setIsLoading(true)
    initiatePayment(paymentRequest)  // Always AUTH endpoint
      .then(response => handlePaymentSuccess(response))
      .catch(error => setIsLoading(false))

  } else if (paymentMethod === PaymentMethod.CASH) {
    // Cash payment - immediate
    setIsLoading(true)
    initiatePayment(paymentRequest)  // Always AUTH endpoint
      .then(response => {
        // Immediately mark as paid
        handlePaymentSuccess(response)
      })
      .catch(error => setIsLoading(false))

  } else if (paymentMethod === PaymentMethod.CREDIT_CARD) {
    // Credit card processing
    setIsLoading(true)
    initiatePayment(paymentRequest)  // Always AUTH endpoint
      .then(response => handlePaymentSuccess(response))
      .catch(error => setIsLoading(false))

  } else if (paymentMethod === PaymentMethod.POINT) {
    // Loyalty points
    setIsLoading(true)
    initiatePayment(paymentRequest)  // Always AUTH endpoint
      .then(response => handlePaymentSuccess(response))
      .catch(error => setIsLoading(false))
  }
}
```

---

## 8. Voucher Validation - Conditional by Role

### 8.1 Payment Method Selection with Voucher Check

```typescript
// File: src/app/client/payment/page.tsx (Line 307-350)

const handleSelectPaymentMethod = (method: PaymentMethod) => {
  setSelectedPaymentMethod(method)

  // If a voucher is applied, validate it against new payment method
  if (appliedVoucher?.slug) {

    if (!userInfo) {
      // ========== UNAUTHENTICATED ==========
      validatePublicVoucherPaymentMethod({
        voucherSlug: appliedVoucher.slug,
        paymentMethod: method,
      })  // ← PUBLIC endpoint
        .then(() => {
          // Voucher is compatible
          setVoucherValidationError(null)
        })
        .catch(error => {
          // Voucher incompatible with this method
          showErrorToast(error.statusCode)
          setVoucherValidationError(true)
        })

    } else {
      // ========== AUTHENTICATED ==========
      validateVoucherPaymentMethod({
        voucherSlug: appliedVoucher.slug,
        paymentMethod: method,
      })  // ← AUTH endpoint
        .then(() => {
          // Voucher is compatible
          setVoucherValidationError(null)
        })
        .catch(error => {
          // Voucher incompatible
          showErrorToast(error.statusCode)
          setVoucherValidationError(true)
        })
    }
  }
}
```

---

## 9. Order Status Polling

### 9.1 Shared Polling Logic

```typescript
// Both payment pages use same polling mechanism

const startPollingOrderStatus = () => {
  const pollingInterval = setInterval(async () => {
    try {
      // Fetch latest order data
      const updatedOrder = await refetchOrder()

      // Check if paid
      if (updatedOrder.status === OrderStatus.PAID) {
        clearInterval(pollingInterval)
        setIsLoading(false)

        // Success - navigate away
        if (!userInfo) {
          navigate(`/client/order-success/${orderSlug}`)
        } else if (userInfo.role === Role.CUSTOMER) {
          navigate(`/client/order-success/${orderSlug}`)
        } else {
          navigate(`/order-success/${orderSlug}`)
        }
      }

    } catch (error) {
      // Error during polling
      clearInterval(pollingInterval)
      setIsLoading(false)
      showErrorToast(error.code)
    }
  }, 2000)  // Poll every 2 seconds

  // Stop polling after 5 minutes (safety)
  setTimeout(() => {
    clearInterval(pollingInterval)
  }, 300000)
}
```

---

## 10. Key Differences Summary

### 10.1 Comparison Table

| Aspect | Unauthenticated | Authenticated Customer | Staff |
|--------|---|---|---|
| **Route** | `/payment` | `/payment` | `/system/payment` |
| **Page Component** | ClientPaymentPage | ClientPaymentPage | PaymentPage |
| **Auth Check** | `!userInfo` | `userInfo?.role === CUSTOMER` | Protected by ProtectedElement |
| **Payment API** | `/payment/initiate/public` | `/payment/initiate` | `/payment/initiate` |
| **Voucher API** | `/validate-payment-method/public` | `/validate-payment-method` | `/validate-payment-method` |
| **Payment Methods** | BANK_TRANSFER only | BANK_TRANSFER, POINT | BANK_TRANSFER, CASH, CREDIT_CARD, POINT |
| **Conditional Logic** | ✅ Yes (if !userInfo) | ✅ Yes (if userInfo?.role) | ❌ No (always Auth) |
| **Loyalty Points** | ❌ No | ✅ Yes | ✅ Yes |
| **Success Route** | `/client/order-success/:slug` | `/client/order-success/:slug` | `/order-success/:slug` |
| **Layout Wrapper** | ClientLayout | ClientLayout | SystemLayout |

### 10.2 API Endpoints Used

```
┌─────────────────────────────────────────────────────┐
│ API ENDPOINT ROUTING                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Order Fetch                                         │
│ ├─ Unauthenticated: GET /orders/ABC123 (public)   │
│ └─ Authenticated: GET /orders/ABC123 (auth)        │
│                                                     │
│ Payment Initiation                                  │
│ ├─ Unauthenticated: POST /payment/initiate/public  │
│ └─ Authenticated: POST /payment/initiate            │
│                                                     │
│ Voucher Validation                                  │
│ ├─ Unauthenticated:                                │
│ │  POST /vouchers/{slug}/validate-payment-method/public
│ └─ Authenticated:                                   │
│    POST /vouchers/{slug}/validate-payment-method   │
│                                                     │
│ Status Polling                                      │
│ ├─ Unauthenticated: GET /orders/ABC123 (public)   │
│ └─ Authenticated: GET /orders/ABC123 (auth)        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 11. File Locations

```
Client Payment Page (Both Auth & Unauth):
  src/app/client/payment/page.tsx
  └─ Component: ClientPaymentPage()
  └─ Handles: Guest & Customer checkout
  └─ Conditionals: Checks !userInfo and role

Staff Payment Page (Auth Only):
  src/app/system/payment/payment-page.tsx
  └─ Component: PaymentPage()
  └─ Wrapped: ProtectedElement (staff only)
  └─ No conditionals: Always authenticated

Hooks & Utilities:
  src/api/order.ts
    ├─ initiatePayment() → /payment/initiate
    └─ initiatePublicPayment() → /payment/initiate/public

  src/api/voucher.ts
    ├─ validateVoucherPaymentMethod()
    └─ validatePublicVoucherPaymentMethod()

  src/utils/payment-resolver.ts
    └─ getAvailableMethodsByRole(role)

  src/stores/order-flow.store.ts
    └─ useOrderFlowStore() - payment data management

Routes:
  src/router/index.tsx
    ├─ Line 1184: '/payment' → ClientPaymentPage
    └─ Line 313: '/system/payment' → PaymentPage (protected)
```

---

## 12. Flow Diagram - Complete

```
USER ENTERS PAYMENT
│
├─── Unauthenticated (Guest)
│    │
│    ├─ Route: /payment?order=ABC
│    ├─ Component: ClientPaymentPage
│    ├─ Detection: !userInfo
│    │
│    ├─ API: GET /orders/ABC (public)
│    ├─ Available Methods: [BANK_TRANSFER]
│    │
│    ├─ Select Payment: BANK_TRANSFER
│    ├─ Validate Voucher: POST .../validate-payment-method/public
│    │
│    ├─ Confirm: POST /payment/initiate/public
│    ├─ Receive: QR code, transaction ID
│    ├─ Polling: GET /orders/ABC (public)
│    │
│    └─ Success: /client/order-success/ABC
│
├─── Authenticated Customer
│    │
│    ├─ Route: /payment?order=ABC
│    ├─ Component: ClientPaymentPage
│    ├─ Detection: userInfo?.role === CUSTOMER
│    │
│    ├─ API: GET /orders/ABC (auth)
│    ├─ Available Methods: [BANK_TRANSFER, POINT]
│    │
│    ├─ Select Payment: POINT (example)
│    ├─ Validate Voucher: POST .../validate-payment-method (auth)
│    │
│    ├─ Apply Loyalty: Select 50 points
│    ├─ Confirm: POST /payment/initiate (with points)
│    ├─ Receive: Transaction ID, points deducted
│    ├─ Polling: GET /orders/ABC (auth)
│    │
│    └─ Success: /client/order-success/ABC
│
└─── Authenticated Staff
     │
     ├─ Route: /system/payment?order=ABC
     ├─ Component: PaymentPage
     ├─ Protection: ProtectedElement ✅
     │
     ├─ API: GET /orders/ABC (auth)
     ├─ Available Methods: [BANK_TRANSFER, CASH, CREDIT_CARD, POINT]
     │
     ├─ Select Payment: CASH (example)
     ├─ Validate Voucher: POST .../validate-payment-method (auth)
     │
     ├─ Confirm: POST /payment/initiate (always auth)
     ├─ Receive: Transaction ID, immediate PAID
     ├─ Polling: GET /orders/ABC (auth)
     │
     └─ Success: /order-success/ABC
```

---

## 13. Important Notes

⚠️ **Key Points to Remember:**

1. **Same Component, Different Cases**
   - ClientPaymentPage handles BOTH authenticated customers AND unauthenticated guests
   - Detects auth state with `const { userInfo } = useUserStore()`

2. **Different API Endpoints for Different Auth States**
   - `/payment/initiate/public` for unauthenticated
   - `/payment/initiate` for authenticated
   - Not optional - different endpoints used based on auth

3. **Payment Methods Limited by Role**
   - Guests can ONLY use BANK_TRANSFER
   - Customers can use BANK_TRANSFER + POINT
   - Staff can use all 4 methods

4. **Voucher Validation is Auth-Aware**
   - Two separate endpoints for validation
   - Called conditionally based on `!userInfo`

5. **Polling is Shared**
   - Both authenticated and unauthenticated use same polling logic
   - Different order fetch endpoints (public vs auth)

6. **Staff Uses Different Route**
   - `/system/payment` instead of `/payment`
   - Protected by ProtectedElement
   - No conditional logic needed (always authenticated)

---

## 14. Summary

✅ **Not exactly "same route"** - There are TWO routes:
- `/payment` - For customers (both auth & unauth)
- `/system/payment` - For staff (auth only)

✅ **Same Component, Different Logic**
- ClientPaymentPage handles both auth states
- Uses conditional logic based on `userInfo`

✅ **Different Backends Called**
- `initiatePayment()` vs `initiatePublicPayment()`
- `validateVoucherPaymentMethod()` vs `validatePublicVoucherPaymentMethod()`

✅ **User Experience is Consistent**
- Same UI flow for both auth states
- Only differences are available payment methods & features
