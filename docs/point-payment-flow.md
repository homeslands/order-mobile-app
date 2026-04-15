# Point Payment Flow (Thanh Toán Bằng Xu)

## Overview
The point payment system allows customers to pay for orders entirely using points (xu) from their balance. Points come from redeeming gift cards and can be used as a payment method for new orders.

**Key Features:**
1. **Payment Method:** Pay entire order using points
2. **Balance Validation:** System validates sufficient points before processing
3. **Instant Deduction:** Points deducted immediately upon successful payment
4. **Transaction History:** All point usage tracked with order references
5. **Staff Control:** Only staff/admin can process point payments with membership card verification

---

## Part 1: System Architecture

### 1.1 Balance System

**Table: balance_tbl**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| points | DECIMAL(10,2) | Current balance in points |
| user_id | UUID | Foreign key to users |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

**Key Point:** Each user has ONE balance record (1:1 relationship with User)

### 1.2 Payment Types

**Payment Methods Available:**
| Method | Code | Who Can Use | When |
|--------|------|-------------|------|
| Bank Transfer | `bank-transfer` | Customer, Staff | Regular payment |
| Cash | `cash` | Staff only | Physical payment |
| Credit Card | `credit-card` | Customer | Online payment |
| **Point** | `point` | Staff with membership card | When customer has points |

### 1.3 User Eligibility for Point Payment

**Who can use point payment:**
- ✅ Customers (role = 'CUSTOMER')
- ✅ With active membership card
- ✅ With sufficient balance
- ✅ Not default customer

**Staff Requirement for Point Payment:**
- Must scan/provide valid membership card code
- Card must be linked to the order owner
- Card must be active and not expired

---

## Part 2: Payment Initiation Flow

### 2.1 Customer Payment (via Mobile/Web)

**Flow:**
```
Customer views order
        ↓
Selects "Pay with Points" from payment methods
        ↓
System validates:
  - Order is PENDING
  - User has sufficient points
  - User is customer
  - User has active membership card
        ↓
API Call: POST /payment/initiate
  Body: {
    orderSlug: "order-123",
    paymentMethod: "point"
  }
        ↓
Backend validates and processes
        ↓
Payment created (status: COMPLETED)
        ↓
PAYMENT_PAID event triggered
        ↓
Order status → PAID
        ↓
Job service deducts points from balance
```

**Endpoint:** `POST /payment/initiate`

**Auth Required:** Bearer token (user must be logged in)

**Request:**
```json
{
  "orderSlug": "order-abc123",
  "paymentMethod": "point"
}
```

**Validation in Backend:**
1. ✓ Order exists and is PENDING
2. ✓ User is customer
3. ✓ User has sufficient points ≥ order.subtotal
4. ✓ User has membership card
5. ✓ User is active
6. ✓ User has no pending requirements

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Payment has been initiated successfully",
  "timestamp": "2026-04-03T10:45:30.123Z",
  "result": {
    "slug": "payment-123",
    "paymentMethod": "point",
    "amount": 500000,
    "statusCode": "completed",
    "statusMessage": "completed",
    "transactionId": "uuid-xxx",
    "createdAt": "2026-04-03T10:45:30.123Z"
  }
}
```

### 2.2 Staff Payment (via POS)

**Flow:**
```
Staff creates order for customer
        ↓
Customer wants to pay with points (xu)
        ↓
Staff selects "Payment by Point" method
        ↓
Staff enters/scans membership card code
        ↓
System validates:
  - Membership card exists
  - Card user = order owner
  - Card is active and not expired
  - Card user has sufficient points
        ↓
API Call: POST /payment/initiate
  Body: {
    orderSlug: "order-123",
    paymentMethod: "point",
    membershipCard: "CARD_CODE_123"
  }
        ↓
Backend validates all conditions
        ↓
PointStrategy.process() called
        ↓
Payment created (status: COMPLETED)
        ↓
PAYMENT_PAID event triggered
        ↓
Job deducts points from balance
```

**Endpoint:** `POST /payment/initiate` (same as customer)

**Auth Required:** Bearer token with STAFF/MANAGER/ADMIN/SUPERADMIN role

**Request:**
```json
{
  "orderSlug": "order-abc123",
  "paymentMethod": "point",
  "membershipCard": "CARD_CODE_123"
}
```

**Staff-Specific Validations:**
1. ✓ Membership card code provided
2. ✓ Membership card exists in database
3. ✓ Membership card user = order owner (security check)
4. ✓ Membership card is active
5. ✓ Membership card not expired
6. ✓ Order owner is customer
7. ✓ Order owner has sufficient points

---

## Part 3: Backend Processing

### 3.1 PointStrategy.process()

**File:** `payment/strategy/point.strategy.ts`

```typescript
async process(order: Order): Promise<Payment> {
  // Step 1: Validate balance
  const isBalanceSufficient = await this.sharedBalanceService.validate({
    userSlug: order.owner.slug,
    points: order.subtotal
  })

  if (!isBalanceSufficient) {
    throw new BalanceException(INSUFFICIENT_BALANCE)
  }

  // Step 2: Create payment record
  const payment = {
    paymentMethod: PaymentMethod.POINT,
    amount: order.subtotal,
    loss: order.loss,
    message: 'hoa don thanh toan',
    userId: order.owner.id,
    transactionId: uuid.v4(),
    statusCode: PaymentStatus.COMPLETED,
    statusMessage: PaymentStatus.COMPLETED
  }

  // Step 3: Save to database
  await this.paymentRepository.save(payment)

  // Step 4: Return created payment
  return payment
}
```

**Key Points:**
- Balance validation only (no actual deduction yet)
- Points deducted AFTER payment completion
- Payment status immediately set to COMPLETED
- Returns payment object to controller

### 3.2 Balance Validation

**Service:** `SharedBalanceService.validate()`

```typescript
async validate(payload: { userSlug: string; points: number }) {
  // Find user's balance
  let balance = await this.balanceRepository.findOne({
    where: { user: { slug: userSlug } }
  })

  // Create balance if doesn't exist
  if (!balance) {
    balance = await this.create({ userSlug })
  }

  // Check sufficient points
  const newPointsValue = balance.points - payload.points
  if (newPointsValue < 0) {
    throw new BalanceException(INSUFFICIENT_BALANCE)
  }

  return true
}
```

**Returns:**
- `true`: Balance sufficient
- `throws BalanceException`: Insufficient balance

### 3.3 Payment Event

**Event:** `PAYMENT_PAID`

**Triggered in:** `payment.service.ts` after successful payment creation

```typescript
if (
  payment.paymentMethod === PaymentMethod.CASH ||
  payment.paymentMethod === PaymentMethod.POINT ||
  payment.paymentMethod === PaymentMethod.CREDIT_CARD
) {
  // Emit event to update order status
  this.eventEmitter.emit(PaymentAction.PAYMENT_PAID, { orderId: order.id })
}
```

**Listener:** `order.listener.ts`

```typescript
@OnEvent(PaymentAction.PAYMENT_PAID)
async handleUpdateOrderStatus(requestData: { orderId: string }) {
  // Create job to update order status and process payment
  await this.jobProducer.createJob({
    type: JobType.UPDATE_STATUS_ORDER_AFTER_PAID,
    data: requestData.orderId
  })
}
```

---

## Part 4: Post-Payment Processing (Job Service)

### 4.1 Balance Deduction

**When:** Order is marked as PAID by job service

**Process:**
```
Job finds paid order
        ↓
Check payment.paymentMethod === POINT
        ↓
Call sharedBalanceService.calcBalance({
  userSlug: order.owner.slug,
  points: order.payment.amount,
  type: 'out'  // Deduction
})
        ↓
Balance.points -= order.payment.amount
        ↓
Save to database
        ↓
Get updated balance
```

**Code:**
```typescript
if (order.payment?.paymentMethod === PaymentMethod.POINT) {
  // Deduct points from balance
  await this.sharedBalanceService.calcBalance({
    userSlug: order.owner?.slug,
    points: order.payment.amount,
    type: 'out'  // ← Deduction
  })

  // Get current balance after deduction
  const currentBalance = await this.sharedBalanceService.findOneByField({
    userSlug: order.owner?.slug
  })

  // Create point transaction record
  await this.sharedPointTransactionService.create({
    type: PointTransactionTypeEnum.OUT,
    desc: `Sử dụng ${formatCurrency(order.subtotal)} xu thanh toán đơn hàng`,
    objectType: PointTransactionObjectTypeEnum.ORDER,
    objectSlug: order.slug,
    beforeBalance: currentBalance.points + order.payment.amount,
    afterBalance: currentBalance.points,
    point: order.payment.amount
  })
}
```

### 4.2 Transaction History

**Purpose:** Track all point usage for auditing

**Record Created:**
- Type: 'OUT'
- Description: Usage of {amount} points to pay for order
- Object Type: 'ORDER'
- Object Slug: order slug
- Before/After Balance: Balance before and after deduction
- Points: Amount deducted

---

## Part 5: Data Structures

### 5.1 Frontend Types

```typescript
enum PaymentMethod {
  BANK_TRANSFER = 'bank-transfer',
  CASH = 'cash',
  POINT = 'point',
  CREDIT_CARD = 'credit-card'
}

enum paymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

interface IPayment {
  slug: string
  paymentMethod: PaymentMethod
  amount: number           // Total payment amount
  loss: number            // Loss/uncollected amount
  statusCode: paymentStatus
  statusMessage: string
  transactionId: string
  createdAt: string
}
```

### 5.2 Backend DTOs

**CreatePaymentDto:**
```typescript
export class CreatePaymentDto {
  @IsEnum(PaymentMethod)
  paymentMethod: string      // Must be 'point'

  @IsNotEmpty()
  orderSlug: string          // Order to pay for

  @Optional()
  membershipCard?: string    // Card code (required for staff)

  transactionId?: string     // For credit card only
}
```

---

## Part 6: Complete Flow Examples

### 6.1 Scenario: Customer Pays Entire Order with Points

**Setup:**
- Order subtotal: 500,000 VND
- Customer's balance: 800,000 points
- Payment method: POINT
- User role: CUSTOMER

**Timeline:**

```
T0: Customer selects "Pay with Points"
──────────────────────────────────────

Frontend displays:
- Current balance: 800,000 points
- Order total: 500,000 points
- Can proceed: YES


T1: Customer confirms payment
──────────────────────────────

POST /payment/initiate
Authorization: Bearer {token}
Body: {
  orderSlug: "order-abc123",
  paymentMethod: "point"
}


T2: Backend validation (PointStrategy.process)
─────────────────────────────────────────────

1. Validate balance sufficient:
   - Required: 500,000
   - Available: 800,000
   - ✓ PASS

2. Create payment record:
   - paymentMethod: 'point'
   - amount: 500,000
   - statusCode: 'completed'
   - transactionId: uuid

3. Save to database:
   - Payment.slug: payment-xyz
   - Order.payment: payment-xyz
   - Order.status: still PENDING (will be updated by job)


T3: Response to frontend
────────────────────────

200 OK
{
  "statusCode": 200,
  "message": "Payment has been initiated successfully",
  "result": {
    "slug": "payment-xyz",
    "paymentMethod": "point",
    "amount": 500000,
    "statusCode": "completed",
    "transactionId": "uuid-123"
  }
}

Frontend shows: "Payment processing..."


T4: PAYMENT_PAID event triggered
──────────────────────────────────

Event listener creates job:
- Job type: UPDATE_STATUS_ORDER_AFTER_PAID
- Order ID: order-abc123


T5: Job service processes payment
───────────────────────────────────

1. Update order status: PENDING → PAID

2. Deduct points from balance:
   - Before: 800,000 points
   - Amount: 500,000 points
   - After: 300,000 points

   Call: sharedBalanceService.calcBalance({
     userSlug: 'customer-slug',
     points: 500000,
     type: 'out'
   })

3. Create point transaction record:
   - Type: 'OUT'
   - Points: 500,000
   - Description: "Sử dụng 500,000đ xu thanh toán đơn hàng"
   - Object: order-abc123
   - Balance after: 300,000


T6: Order processing continues
───────────────────────────────

- Order printed/prepared
- Customer notified
- Balance updated everywhere


T7: Customer checks balance
───────────────────────────

API: GET /accumulated-point/user/{slug}/points
or balance endpoint

Response:
{
  "balance": 300000  // Updated after deduction
}
```

### 6.2 Scenario: Staff Pays with Customer's Membership Card

**Setup:**
- Order subtotal: 200,000 VND
- Customer's balance: 250,000 points
- Membership card code: "CARD_CODE_ABC"
- Staff role: STAFF

**Timeline:**

```
T0: Staff in POS system
──────────────────────

Customer: "Thanh toán bằng xu"
Staff selects: Payment Method = POINT
Staff enters: Card Code = "CARD_CODE_ABC"


T1: Validation Phase
────────────────────

Backend checks:
1. ✓ Card "CARD_CODE_ABC" exists
2. ✓ Card.user = Order.owner (same person)
3. ✓ Card.isActive = true
4. ✓ Card not expired
5. ✓ Order.owner is CUSTOMER
6. ✓ Order.owner balance ≥ 200,000


T2: Payment Initiation
──────────────────────

POST /payment/initiate
Authorization: Bearer {staff-token}
Body: {
  orderSlug: "order-xyz",
  paymentMethod: "point",
  membershipCard: "CARD_CODE_ABC"
}


T3: PointStrategy.process()
───────────────────────────

1. Validate balance (not deducted yet):
   - Check: 250,000 - 200,000 = 50,000 ✓

2. Create payment:
   - amount: 200,000
   - paymentMethod: 'point'
   - status: 'completed'


T4: Job Service Processes
──────────────────────────

1. Deduct points:
   - Before: 250,000
   - Deduct: 200,000
   - After: 50,000

2. Create transaction:
   - Type: OUT
   - Amount: 200,000
   - Description: "Sử dụng 200,000đ xu thanh toán đơn hàng"
   - Order: order-xyz


Result: Order PAID, points deducted from customer's balance
```

---

## Part 7: Error Handling

### 7.1 Common Errors

| Error | Cause | When |
|-------|-------|------|
| INSUFFICIENT_BALANCE | Points < order total | During validation |
| USER_NOT_FOUND | User doesn't exist | Payment initiation |
| ORDER_NOT_FOUND | Order doesn't exist | Payment initiation |
| ORDER_ALREADY_HAS_PAYMENT | Order has valid payment | Re-initiating |
| ORDER_STATUS_INVALID | Order not PENDING | Non-pending order |
| MEMBERSHIP_CARD_REQUIRED | Staff didn't provide card | Staff payment |
| MEMBERSHIP_CARD_NOT_FOUND | Card code invalid | Staff payment |
| MEMBERSHIP_CARD_USER_NOT_FOUND | Card linked to wrong user | Card mismatch |
| MEMBERSHIP_CARD_EXPIRED | Card expired | Expired card |
| OWNER_NOT_A_CUSTOMER | Order owner not customer | Non-customer |

### 7.2 Insufficient Balance Response

**Status:** 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "Insufficient balance",
  "timestamp": "2026-04-03T10:45:30.123Z"
}
```

### 7.3 Invalid Membership Card (Staff)

**Status:** 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Membership card not found",
  "timestamp": "2026-04-03T10:45:30.123Z"
}
```

---

## Part 8: UI Components

### 8.1 Payment Method Selection

**File:** `components/app/radio/payment-method-radio-group.tsx`

**For Customer:**
```
Available Methods:
- ○ Bank Transfer
- ○ Credit Card
- ● Point (if balance sufficient)
  └─ Display: "Your balance: 800,000 points"
```

**For Staff:**
```
Available Methods:
- ○ Bank Transfer
- ○ Credit Card
- ○ Cash
- ○ Point (if points allowed)
  └─ Input: Membership Card Code
```

### 8.2 Balance Display

**Where Shown:**
1. Payment screen (before selecting POINT)
2. Order summary
3. Customer profile/dashboard
4. Transaction history

**Format:**
```
💳 Available Points: 800,000 points
   (equivalent to ~800,000 VND)
```

---

## Part 9: Transaction History Integration

### 9.1 Point Transaction Record

**Service:** `PointTransactionService`

**Records Created After Point Payment:**
```
{
  type: 'OUT',
  description: 'Sử dụng 500,000đ xu thanh toán đơn hàng',
  objectType: 'ORDER',
  objectSlug: 'order-abc123',
  beforeBalance: 800000,
  afterBalance: 300000,
  point: 500000,
  createdAt: '2026-04-03T10:45:30.123Z'
}
```

**Visible In:**
- Customer's point history
- Admin's audit trail
- Order payment details

---

## Part 10: Security Considerations

### 10.1 Balance Validation
- **Pessimistic:** System validates BEFORE payment
- **No Race Condition:** Transaction manager ensures atomic operation
- **Rollback:** If deduction fails, order payment marked as failed

### 10.2 Staff Verification (Membership Card)
- **Two-Factor Check:**
  1. Card exists in system
  2. Card.user = Order.owner (prevents staff from using wrong card)
- **Card Validity:**
  - Must be active (isActive: true)
  - Must not be expired (expiredAt > now)

### 10.3 User Validation
- User must be customer (not staff/admin)
- User must be active
- User must have no pending requirements

---

## Part 11: Complete API Reference

### Endpoint: Initiate Payment with Points

**URL:** `POST /payment/initiate`

**Auth:** Bearer token (required)

**Request (Customer):**
```json
{
  "orderSlug": "order-abc123",
  "paymentMethod": "point"
}
```

**Request (Staff):**
```json
{
  "orderSlug": "order-abc123",
  "paymentMethod": "point",
  "membershipCard": "CARD_CODE_123"
}
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Payment has been initiated successfully",
  "timestamp": "2026-04-03T10:45:30.123Z",
  "result": {
    "slug": "payment-xyz",
    "paymentMethod": "point",
    "amount": 500000,
    "loss": 0,
    "statusCode": "completed",
    "statusMessage": "completed",
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2026-04-03T10:45:30.123Z",
    "updatedAt": "2026-04-03T10:45:30.123Z"
  }
}
```

**Error Responses:**

**400 - Insufficient Balance:**
```json
{
  "statusCode": 400,
  "message": "Insufficient balance"
}
```

**400 - Order Not Pending:**
```json
{
  "statusCode": 400,
  "message": "Order is not pending"
}
```

**404 - Membership Card Not Found (Staff):**
```json
{
  "statusCode": 404,
  "message": "Membership card not found"
}
```

**403 - Card User Mismatch (Staff):**
```json
{
  "statusCode": 403,
  "message": "Membership card user is not the order owner"
}
```

---

## Summary

**Point Payment Flow in 3 Steps:**

1. **Initiation (T0-T2):**
   - User selects POINT payment method
   - API validates balance and card (if staff)
   - PointStrategy creates payment record (status: COMPLETED)

2. **Order Update (T3-T5):**
   - PAYMENT_PAID event triggers
   - Job service receives event
   - Order status changed to PAID

3. **Balance Deduction (T6-T7):**
   - Points deducted from balance
   - Point transaction record created
   - Customer's balance updated immediately

**Key Differences from Other Payment Methods:**
- ✓ Instant payment (no callback waiting)
- ✓ Atomic operation (validate + deduct in one process)
- ✓ No external gateway (no bank/payment processor)
- ✓ Staff requires membership card verification
- ✓ Customer requires sufficient balance validation

**Audit Trail:**
- Payment record with transaction ID
- Point transaction with before/after balance
- Order marked with payment method
- Customer can see in transaction history
