# API Endpoints Reference - Authenticated vs Public

## 1. Tổng Quan

```
┌──────────────────────────────────────────────────────────┐
│ API ENDPOINT TYPES                                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1️⃣  PUBLIC APIs                                        │
│      ├─ No authentication required                      │
│      ├─ Accessible to any user                         │
│      ├─ ~31 endpoints                                   │
│      └─ Typically: Auth flows, Product browsing        │
│                                                          │
│  2️⃣  AUTHENTICATED APIs                                 │
│      ├─ Requires valid Bearer token                    │
│      ├─ Most GET/POST/PATCH/DELETE operations         │
│      ├─ ~270+ endpoints                                │
│      └─ Requires login first                           │
│                                                          │
│  3️⃣  PROTECTED/ADMIN APIs                               │
│      ├─ Requires authentication + specific permissions │
│      ├─ Checked via JWT authorities                    │
│      ├─ CREATE, UPDATE, DELETE operations             │
│      └─ Role-based access control                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Authentication Header Format

```typescript
// Public Request (No Auth)
GET /products HTTP/1.1
Host: api.example.com
Content-Type: application/json

// Authenticated Request
GET /orders HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

// Token Format
Bearer <accessToken>
     ↑ Required prefix
     <accessToken> = JWT from /auth/login response
```

---

## 3. Public APIs (No Authentication)

### 3.1 Authentication & User Endpoints

| Endpoint                                       | Method | Purpose                     | Public |
| ---------------------------------------------- | ------ | --------------------------- | ------ |
| `/auth/login`                                  | POST   | Login with phone + password | ✅     |
| `/auth/register`                               | POST   | Create new account          | ✅     |
| `/auth/refresh`                                | POST   | Refresh token pair          | ✅     |
| `/auth/forgot-password/initiate`               | POST   | Start password reset        | ✅     |
| `/auth/forgot-password/confirm`                | POST   | Verify OTP for password     | ✅     |
| `/auth/forgot-password/resend`                 | POST   | Resend OTP                  | ✅     |
| `/auth/forgot-password/change`                 | POST   | Confirm new password        | ✅     |
| `/auth/initiate-verify-email`                  | POST   | Start email verification    | ✅     |
| `/auth/initiate-verify-phone-number`           | POST   | Send OTP to phone           | ✅     |
| `/auth/confirm-email-verification/code`        | POST   | Verify email with code      | ✅     |
| `/auth/confirm-phone-number-verification/code` | POST   | Verify phone with code      | ✅     |
| `/auth/resend-verify-email`                    | POST   | Resend email verification   | ✅     |
| `/auth/resend-verify-phone-number`             | POST   | Resend phone OTP            | ✅     |

### 3.2 Public Order Endpoints

| Endpoint                                        | Method | Purpose                   | Public |
| ----------------------------------------------- | ------ | ------------------------- | ------ |
| `/orders/public`                                | GET    | Get all public orders     | ✅     |
| `/orders/{slug}`                                | GET    | Get specific order        | ✅     |
| `/orders/public`                                | POST   | Create order (guest)      | ✅     |
| `/orders/{slug}/public`                         | DELETE | Delete public order       | ✅     |
| `/invoice/specific/public`                      | GET    | Get public invoice (blob) | ✅     |
| `/invoice/export/public`                        | POST   | Export public invoice     | ✅     |
| `/orders/delivery/address/suggestion/{address}` | GET    | Get address suggestions   | ✅     |
| `/orders/delivery/location/{placeId}`           | GET    | Get address by place ID   | ✅     |
| `/orders/delivery/direction`                    | GET    | Get delivery directions   | ✅     |
| `/orders/delivery/distance-and-duration`        | GET    | Get distance & duration   | ✅     |
| `/payment/initiate/public`                      | POST   | Initiate guest payment    | ✅     |

### 3.3 Public Voucher Endpoints

| Endpoint                                  | Method | Purpose                  | Public |
| ----------------------------------------- | ------ | ------------------------ | ------ |
| `/voucher/order/public/eligible`          | GET    | Get eligible vouchers    | ✅     |
| `/voucher/specific/public`                | GET    | Get public voucher       | ✅     |
| `/voucher/validate/public`                | POST   | Validate public voucher  | ✅     |
| `/voucher/validate/payment-method/public` | POST   | Validate voucher payment | ✅     |
| `/orders/{slug}/voucher/public`           | PATCH  | Apply voucher to order   | ✅     |

### 3.4 Public Menu & Product Endpoints

| Endpoint                                     | Method | Purpose              | Public |
| -------------------------------------------- | ------ | -------------------- | ------ |
| `/menu/specific/public`                      | GET    | Get public menu      | ✅     |
| `/catalogs`                                  | GET    | Get all catalogs     | ✅     |
| `/products`                                  | GET    | Get all products     | ✅     |
| `/products/{slug}`                           | GET    | Get specific product | ✅     |
| `/menu-item/{slug}`                          | GET    | Get menu item        | ✅     |
| `/product-analysis/top-sell/branch/{branch}` | GET    | Get top products     | ✅     |

### 3.5 Public Branch & Utility Endpoints

| Endpoint             | Method | Purpose          | Public |
| -------------------- | ------ | ---------------- | ------ |
| `/branch`            | GET    | Get all branches | ✅     |
| `/tables`            | GET    | Get all tables   | ✅     |
| `/banner`            | GET    | Get all banners  | ✅     |
| `/static-page/{key}` | GET    | Get static page  | ✅     |

**Total Public APIs: ~31 endpoints**

---

## 4. Authenticated APIs (Bearer Token Required)

### 4.1 User & Profile Endpoints

| Endpoint                             | Method | Purpose                | Auth |
| ------------------------------------ | ------ | ---------------------- | ---- |
| `/auth/profile`                      | GET    | Get user profile       | ✅   |
| `/auth/profile`                      | PATCH  | Update profile         | ✅   |
| `/auth/change-password`              | POST   | Change password        | ✅   |
| `/auth/upload`                       | PATCH  | Upload avatar          | ✅   |
| `/user`                              | GET    | Get all users (admin)  | ✅\* |
| `/user/{slug}`                       | GET    | Get specific user      | ✅\* |
| `/user`                              | POST   | Create user (admin)    | ✅\* |
| `/user/{slug}`                       | PATCH  | Update user (admin)    | ✅\* |
| `/user/{slug}/toggle-active`         | PATCH  | Lock/unlock user       | ✅\* |
| `/user/{slug}/role`                  | POST   | Update user role       | ✅\* |
| `/user/{slug}/reset-password`        | POST   | Reset password (admin) | ✅\* |
| `/user/{slug}/language`              | PATCH  | Update language        | ✅   |
| `/user/{slug}/complete-registration` | PATCH  | Complete registration  | ✅   |

### 4.2 User Group Management

| Endpoint                    | Method | Purpose              | Auth |
| --------------------------- | ------ | -------------------- | ---- |
| `/user-group`               | POST   | Create user group    | ✅\* |
| `/user-group`               | GET    | Get user groups      | ✅\* |
| `/user-group/{slug}`        | GET    | Get specific group   | ✅\* |
| `/user-group/{slug}`        | PATCH  | Update user group    | ✅\* |
| `/user-group/{slug}`        | DELETE | Delete user group    | ✅\* |
| `/user-group-member`        | POST   | Add member to group  | ✅\* |
| `/user-group-member/bulk`   | POST   | Add multiple members | ✅\* |
| `/user-group-member`        | GET    | Get group members    | ✅\* |
| `/user-group-member/{slug}` | GET    | Get specific member  | ✅\* |
| `/user-group-member/{slug}` | DELETE | Remove member        | ✅\* |

### 4.3 Membership Card Management

| Endpoint                                     | Method | Purpose                 | Auth |
| -------------------------------------------- | ------ | ----------------------- | ---- |
| `/membership-card`                           | POST   | Create membership card  | ✅\* |
| `/membership-card/bulk`                      | POST   | Create multiple cards   | ✅\* |
| `/membership-card/user/{slug}/toggle-active` | PATCH  | Toggle card status      | ✅\* |
| `/membership-card/replace`                   | PATCH  | Replace membership card | ✅\* |
| `/membership-card/user/{slug}`               | DELETE | Delete membership card  | ✅\* |

### 4.4 Order Management

| Endpoint                                    | Method | Purpose                 | Auth |
| ------------------------------------------- | ------ | ----------------------- | ---- |
| `/orders`                                   | GET    | Get all orders          | ✅   |
| `/orders`                                   | POST   | Create order (auth)     | ✅   |
| `/orders/{slug}`                            | PATCH  | Update order type       | ✅   |
| `/orders/{slug}`                            | DELETE | Delete order            | ✅   |
| `/orders/{slug}/call-customer-to-get-order` | POST   | Call customer           | ✅   |
| `/order-items`                              | POST   | Add item to order       | ✅   |
| `/order-items/{slug}`                       | DELETE | Delete item             | ✅   |
| `/order-items/{slug}`                       | PATCH  | Update item             | ✅   |
| `/order-items/{slug}/note`                  | PATCH  | Update item note        | ✅   |
| `/orders/{slug}/voucher`                    | PATCH  | Apply voucher           | ✅   |
| `/invoice/specific`                         | GET    | Get invoice             | ✅   |
| `/invoice/export/temporary`                 | POST   | Export provisional bill | ✅   |
| `/invoice/export`                           | POST   | Export invoice          | ✅   |
| `/payment/initiate`                         | POST   | Initiate payment        | ✅   |
| `/payment/{slug}/export`                    | POST   | Export payment QR       | ✅   |
| `/printer/events`                           | GET    | Get printer events      | ✅   |
| `/menu/specific`                            | GET    | Get specific menu       | ✅   |

### 4.5 Product Management (CRUD)

| Endpoint                          | Method | Purpose             | Auth |
| --------------------------------- | ------ | ------------------- | ---- |
| `/products`                       | POST   | Create product      | ✅\* |
| `/products/{slug}`                | PATCH  | Update product      | ✅\* |
| `/products/{slug}`                | DELETE | Delete product      | ✅\* |
| `/products/{slug}/upload`         | PATCH  | Upload image        | ✅\* |
| `/products/{slug}/uploads`        | PATCH  | Upload multiple     | ✅\* |
| `/products/{slug}/images/{image}` | DELETE | Delete image        | ✅\* |
| `/products/export`                | GET    | Export products     | ✅\* |
| `/products/import-template`       | GET    | Get import template | ✅\* |
| `/products/multi`                 | POST   | Import products     | ✅\* |
| `/variants`                       | GET    | Get variants        | ✅\* |
| `/variants`                       | POST   | Create variant      | ✅\* |
| `/variants/{product}`             | PATCH  | Update variant      | ✅\* |
| `/variants/{slug}`                | DELETE | Delete variant      | ✅\* |
| `/product-analysis/top-sell`      | GET    | Get top products    | ✅   |
| `/product-analysis/refresh`       | POST   | Refresh analysis    | ✅\* |

### 4.6 Menu Management

| Endpoint            | Method | Purpose            | Auth |
| ------------------- | ------ | ------------------ | ---- |
| `/menu`             | GET    | Get all menus      | ✅\* |
| `/menu`             | POST   | Create menu        | ✅\* |
| `/menu/{slug}`      | PATCH  | Update menu        | ✅\* |
| `/menu/{slug}`      | DELETE | Delete menu        | ✅\* |
| `/menu-item`        | POST   | Add menu item      | ✅\* |
| `/menu-item/bulk`   | POST   | Add multiple items | ✅\* |
| `/menu-item/{slug}` | PATCH  | Update menu item   | ✅\* |
| `/menu-item/{slug}` | DELETE | Delete menu item   | ✅\* |

### 4.7 Voucher Management

| Endpoint                           | Method | Purpose               | Auth |
| ---------------------------------- | ------ | --------------------- | ---- |
| `/voucher-group`                   | GET    | Get voucher groups    | ✅\* |
| `/voucher-group`                   | POST   | Create voucher group  | ✅\* |
| `/voucher-group/{slug}`            | PATCH  | Update group          | ✅\* |
| `/voucher`                         | GET    | Get all vouchers      | ✅\* |
| `/voucher`                         | POST   | Create voucher        | ✅\* |
| `/voucher/bulk`                    | POST   | Create multiple       | ✅\* |
| `/voucher/{slug}`                  | PATCH  | Update voucher        | ✅\* |
| `/voucher/{slug}`                  | DELETE | Delete voucher        | ✅\* |
| `/voucher/validate`                | POST   | Validate voucher      | ✅   |
| `/voucher/validate/payment-method` | POST   | Validate payment      | ✅   |
| `/voucher/specific`                | GET    | Get voucher details   | ✅   |
| `/voucher/order/eligible`          | POST   | Get eligible vouchers | ✅   |
| `/voucher-product`                 | POST   | Apply to product      | ✅\* |
| `/voucher-product`                 | DELETE | Remove from product   | ✅\* |
| `/voucher/{slug}/payment-method`   | POST   | Set payment method    | ✅\* |
| `/voucher/{slug}/payment-method`   | DELETE | Delete payment method | ✅\* |
| `/voucher-user-group/bulk`         | POST   | Add to user group     | ✅\* |
| `/voucher-user-group/bulk`         | DELETE | Remove from group     | ✅\* |
| `/voucher/bulk/time`               | PATCH  | Update apply time     | ✅\* |

### 4.8 Promotion Management

| Endpoint                      | Method | Purpose          | Auth |
| ----------------------------- | ------ | ---------------- | ---- |
| `/promotion`                  | GET    | Get promotions   | ✅\* |
| `/promotion/{branchSlug}`     | POST   | Create promotion | ✅\* |
| `/promotion/{slug}`           | PATCH  | Update promotion | ✅\* |
| `/promotion/{slug}`           | DELETE | Delete promotion | ✅\* |
| `/applicable-promotion/multi` | POST   | Apply promotion  | ✅\* |
| `/applicable-promotion`       | DELETE | Remove promotion | ✅\* |

### 4.9 Branch & Table Management

| Endpoint                             | Method | Purpose             | Auth |
| ------------------------------------ | ------ | ------------------- | ---- |
| `/branch`                            | POST   | Create branch       | ✅\* |
| `/branch/{slug}`                     | PATCH  | Update branch       | ✅\* |
| `/branch/{slug}`                     | DELETE | Delete branch       | ✅\* |
| `/branch/{slug}/delivery-info`       | GET    | Get delivery info   | ✅\* |
| `/branch-config`                     | POST   | Create config       | ✅\* |
| `/branch-config/{slug}`              | PATCH  | Update config       | ✅\* |
| `/branch-config/{slug}`              | DELETE | Delete config       | ✅\* |
| `/branch-config/{slug}`              | GET    | Get config          | ✅\* |
| `/branch-config/branch/{branchSlug}` | GET    | Get all configs     | ✅\* |
| `/branch-config/specific`            | GET    | Get specific config | ✅\* |
| `/tables`                            | POST   | Create table        | ✅\* |
| `/tables/{slug}`                     | PATCH  | Update table        | ✅\* |
| `/tables/{slug}`                     | DELETE | Delete table        | ✅\* |
| `/tables/{slug}/status`              | PATCH  | Update status       | ✅\* |
| `/tables/bulk`                       | POST   | Create multiple     | ✅\* |
| `/tables/locations`                  | GET    | Get locations       | ✅\* |

### 4.10 System & Configuration

| Endpoint                  | Method | Purpose            | Auth |
| ------------------------- | ------ | ------------------ | ---- |
| `/system-config`          | GET    | Get configs        | ✅\* |
| `/system-config`          | POST   | Create config      | ✅\* |
| `/system-config/{slug}`   | PATCH  | Update config      | ✅\* |
| `/system-config`          | DELETE | Delete config      | ✅\* |
| `/system-config/specific` | GET    | Get by key         | ✅\* |
| `/role`                   | GET    | Get roles          | ✅\* |
| `/role/{slug}`            | GET    | Get specific role  | ✅\* |
| `/role`                   | POST   | Create role        | ✅\* |
| `/role/{slug}`            | PATCH  | Update role        | ✅\* |
| `/role/{slug}`            | DELETE | Delete role        | ✅\* |
| `/authority-group`        | GET    | Get authorities    | ✅\* |
| `/permission/bulk`        | POST   | Create permissions | ✅\* |
| `/permission/{slug}`      | DELETE | Delete permission  | ✅\* |

### 4.11 Loyalty Points & Rewards

| Endpoint                                             | Method | Purpose              | Auth |
| ---------------------------------------------------- | ------ | -------------------- | ---- |
| `/accumulated-point/user/{slug}/points`              | GET    | Get loyalty points   | ✅   |
| `/accumulated-point/order/{slug}/apply-points`       | POST   | Apply points         | ✅   |
| `/accumulated-point/order/{slug}/cancel-reservation` | POST   | Cancel reservation   | ✅   |
| `/accumulated-point/user/{slug}/history`             | GET    | Get points history   | ✅   |
| `/balance`                                           | GET    | Get user balance     | ✅   |
| `/balance/analysis`                                  | GET    | Analyze balance      | ✅   |
| `/point-transaction`                                 | GET    | Get transactions     | ✅\* |
| `/point-transaction/analysis`                        | GET    | Analyze transactions | ✅\* |
| `/point-transaction/export`                          | GET    | Export transactions  | ✅\* |
| `/point-transaction/export/system`                   | GET    | Export system trans  | ✅\* |
| `/point-transaction/{slug}/export`                   | GET    | Export specific      | ✅\* |

### 4.12 Gift Card Management

| Endpoint                             | Method | Purpose           | Auth |
| ------------------------------------ | ------ | ----------------- | ---- |
| `/card`                              | GET    | Get gift cards    | ✅\* |
| `/card/{slug}`                       | GET    | Get specific card | ✅\* |
| `/card`                              | POST   | Create gift card  | ✅\* |
| `/card/{slug}`                       | PATCH  | Update card       | ✅\* |
| `/card/{slug}`                       | DELETE | Delete card       | ✅\* |
| `/gift-card`                         | GET    | Get user cards    | ✅   |
| `/gift-card/{slug}`                  | GET    | Get card details  | ✅   |
| `/gift-card/use`                     | POST   | Use gift card     | ✅   |
| `/card-order`                        | POST   | Create card order | ✅   |
| `/card-order/{slug}`                 | GET    | Get order details | ✅   |
| `/card-order/{slug}/cancel`          | POST   | Cancel order      | ✅   |
| `/card-order/payment/initiate`       | POST   | Initiate payment  | ✅   |
| `/card-order/payment/initiate/admin` | POST   | Admin payment     | ✅\* |

### 4.13 Notifications & Devices

| Endpoint                                                 | Method | Purpose           | Auth |
| -------------------------------------------------------- | ------ | ----------------- | ---- |
| `/notification`                                          | GET    | Get notifications | ✅   |
| `/notification/{slug}/read`                              | PATCH  | Mark as read      | ✅   |
| `/notification/firebase/register-device-token`           | POST   | Register device   | ✅   |
| `/notification/firebase/unregister-device-token/{token}` | DELETE | Unregister device | ✅   |

### 4.14 Chef Area & Printers

| Endpoint                                                     | Method | Purpose           | Auth |
| ------------------------------------------------------------ | ------ | ----------------- | ---- |
| `/chef-area`                                                 | GET    | Get chef areas    | ✅\* |
| `/chef-area`                                                 | POST   | Create chef area  | ✅\* |
| `/chef-area/specific/{slug}`                                 | GET    | Get specific area | ✅\* |
| `/chef-area/{slug}`                                          | PATCH  | Update area       | ✅\* |
| `/chef-area/{slug}`                                          | DELETE | Delete area       | ✅\* |
| `/product-chef-area`                                         | POST   | Add product       | ✅\* |
| `/product-chef-area`                                         | GET    | Get products      | ✅\* |
| `/product-chef-area/specific/{id}`                           | GET    | Get specific      | ✅\* |
| `/product-chef-area/multi`                                   | POST   | Add multiple      | ✅\* |
| `/product-chef-area/{id}`                                    | PATCH  | Update product    | ✅\* |
| `/product-chef-area/{id}`                                    | DELETE | Remove product    | ✅\* |
| `/chef-order`                                                | GET    | Get chef orders   | ✅\* |
| `/chef-order/specific/{slug}`                                | GET    | Get order         | ✅\* |
| `/chef-order`                                                | POST   | Create order      | ✅\* |
| `/chef-order/{slug}`                                         | PATCH  | Update status     | ✅\* |
| `/chef-order-item/{slug}`                                    | PATCH  | Update item       | ✅\* |
| `/chef-order/{slug}/export`                                  | GET    | Export order      | ✅\* |
| `/chef-order/{slug}/export-manual/tickets`                   | GET    | Export manual     | ✅\* |
| `/chef-order/{slug}/export-auto/tickets`                     | GET    | Export auto       | ✅\* |
| `/chef-order/{slug}/test-export/tickets/{maxCount}/{type}`   | POST   | Test export       | ✅\* |
| `/chef-area/{slug}/printers`                                 | GET    | Get printers      | ✅\* |
| `/chef-area/{slug}/printer`                                  | POST   | Add printer       | ✅\* |
| `/chef-area/{slug}/printer/{printerSlug}`                    | PATCH  | Update printer    | ✅\* |
| `/chef-area/{slug}/printer/{printerSlug}`                    | DELETE | Delete printer    | ✅\* |
| `/chef-area/{slug}/printer/{printerSlug}/toggle`             | PATCH  | Toggle printer    | ✅\* |
| `/chef-area/{slug}/printer/{printerSlug}/ping`               | POST   | Test printer      | ✅\* |
| `/orders/{slug}/re-print-failed-invoice-printer-jobs`        | PATCH  | Re-print invoices | ✅\* |
| `/chef-order/{slug}/re-print-failed-chef-order-printer-jobs` | PATCH  | Re-print orders   | ✅\* |
| `/chef-order/{slug}/re-print-failed-label-printer-jobs`      | PATCH  | Re-print labels   | ✅\* |

### 4.15 Analytics & Reporting

| Endpoint                       | Method | Purpose            | Auth |
| ------------------------------ | ------ | ------------------ | ---- |
| `/revenue`                     | GET    | Get revenue        | ✅\* |
| `/revenue/from-branch-revenue` | GET    | Get all branches   | ✅\* |
| `/revenue/branch/{branch}`     | GET    | Get branch revenue | ✅\* |
| `/revenue/date`                | PATCH  | Get by date range  | ✅\* |
| `/revenue/branch/latest`       | PATCH  | Get latest         | ✅\* |
| `/revenue/branch/date`         | PATCH  | Get branch by date | ✅\* |
| `/revenue/branch/export`       | GET    | Export revenue     | ✅\* |
| `/revenue/branch/export-pdf`   | POST   | Export as PDF      | ✅\* |

### 4.16 Other Features

| Endpoint                                 | Method | Purpose            | Auth |
| ---------------------------------------- | ------ | ------------------ | ---- |
| `/banner`                                | POST   | Create banner      | ✅\* |
| `/banner/{slug}`                         | PATCH  | Update banner      | ✅\* |
| `/banner/{slug}`                         | DELETE | Delete banner      | ✅\* |
| `/banner/{slug}`                         | GET    | Get banner         | ✅\* |
| `/banner/{slug}/upload`                  | PATCH  | Upload image       | ✅\* |
| `/catalogs`                              | POST   | Create catalog     | ✅\* |
| `/catalogs/{slug}`                       | PATCH  | Update catalog     | ✅\* |
| `/catalogs/{slug}`                       | DELETE | Delete catalog     | ✅\* |
| `/sizes`                                 | GET    | Get sizes          | ✅\* |
| `/sizes`                                 | POST   | Create size        | ✅\* |
| `/sizes/{slug}`                          | PATCH  | Update size        | ✅\* |
| `/sizes/{slug}`                          | DELETE | Delete size        | ✅\* |
| `/static-page`                           | GET    | Get pages          | ✅\* |
| `/static-page`                           | POST   | Create page        | ✅\* |
| `/static-page/{slug}`                    | PATCH  | Update page        | ✅\* |
| `/static-page/{slug}`                    | DELETE | Delete page        | ✅\* |
| `/coin-policy`                           | GET    | Get policies       | ✅\* |
| `/coin-policy/{slug}`                    | PATCH  | Update policy      | ✅\* |
| `/coin-policy/{slug}/activation`         | PATCH  | Toggle policy      | ✅\* |
| `/feature-flag-system/bulk-toggle`       | PATCH  | Toggle features    | ✅\* |
| `/feature-flag-system/child/bulk-toggle` | PATCH  | Toggle child       | ✅\* |
| `/feature-flag-system/group`             | GET    | Get groups         | ✅\* |
| `/feature-flag-system/group/{groupName}` | GET    | Get by group       | ✅\* |
| `/feature-flag`                          | GET    | Get flags by group | ✅   |
| `/acb-connector`                         | GET    | Get connector      | ✅\* |
| `/acb-connector`                         | POST   | Create connector   | ✅\* |
| `/acb-connector/{slug}`                  | PUT    | Update connector   | ✅\* |
| `/logger`                                | GET    | Get logs           | ✅\* |
| `/card-order`                            | GET    | Get orders         | ✅\* |
| `/card-order/export/excel`               | GET    | Export orders      | ✅\* |

**Total Authenticated APIs: 270+ endpoints** (✅ = requires token, ✅\* = requires token + admin/permissions)

---

## 5. API Request/Response Patterns

### 5.1 Authentication Request/Response

```typescript
// Request
POST /auth/login
Content-Type: application/json

{
  "phoneNumber": "0901234567",
  "password": "securePassword123"
}

// Success Response (200)
{
  "code": 0,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expireTime": "2026-03-31T10:30:00Z",
    "expireTimeRefreshToken": "2026-04-30T10:30:00Z",
    "user": {
      "id": "user-123",
      "slug": "user-abc",
      "phoneNumber": "0901234567",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}

// Error Response (400/401)
{
  "code": 119010,  // invalidCredentials
  "message": "Credentials are invalid",
  "data": null
}
```

### 5.2 Authenticated Request Example

```typescript
// Request with Bearer Token
GET /orders?page=0&limit=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

// Success Response (200)
{
  "code": 0,
  "message": "Get orders successful",
  "data": {
    "items": [
      {
        "id": "order-1",
        "slug": "order-abc",
        "total": 500000,
        "status": "PENDING",
        ...
      }
    ],
    "total": 150,
    "page": 0,
    "limit": 20
  }
}

// Error Response - No Token (401)
{
  "code": 401,
  "message": "Unauthorized",
  "data": null
}

// Error Response - Expired Token (401)
{
  "code": 1017,
  "message": "Token refresh failed",
  "data": null
}
```

### 5.3 Protected Resource (Requires Permissions)

```typescript
// Request
POST /user
Authorization: Bearer <token>
Content-Type: application/json

{
  "phoneNumber": "0902345678",
  "firstName": "Jane",
  "lastName": "Smith"
}

// Success - Admin/Has Permission (200)
{
  "code": 0,
  "message": "User created",
  "data": { ... }
}

// Error - No Permission (403)
{
  "code": 403,
  "message": "Forbidden",
  "data": null
}

// Error - Token Expired (401)
{
  "code": 401,
  "message": "Unauthorized",
  "data": null
  // → Auto-refresh happens in interceptor
  // → Retry request with new token
}
```

---

## 6. HTTP Status Codes

### Standard HTTP Status Codes

| Code  | Meaning                           | Action                           |
| ----- | --------------------------------- | -------------------------------- |
| `200` | OK - Request successful           | Use response data                |
| `201` | Created - Resource created        | Use response data                |
| `204` | No Content - Success, no body     | Success                          |
| `400` | Bad Request - Invalid data        | Show error toast                 |
| `401` | Unauthorized - No/invalid token   | Refresh token or redirect /login |
| `403` | Forbidden - No permission         | Show error toast                 |
| `404` | Not Found - Resource not found    | Show error toast                 |
| `409` | Conflict - Duplicate data         | Show error toast                 |
| `422` | Unprocessable - Validation failed | Show field errors                |
| `429` | Rate Limited - Too many requests  | Show toast, retry later          |
| `500` | Server Error - Backend issue      | Show generic error               |

### API Response Codes (in `data.code`)

See [status-code-toast-handling.md](./status-code-toast-handling.md) for complete list of 320+ codes.

Common ones:

- `0` = Success
- `401` = Unauthorized
- `403` = Forbidden
- `409` = Conflict
- `119010` = Invalid Credentials
- `101001` = Order Not Found
- `143426` = Voucher Expired
- etc.

---

## 7. Request Headers

### Required Headers

```typescript
// All Requests
{
  "Content-Type": "application/json"
}

// Authenticated Requests (REQUIRED)
{
  "Authorization": "Bearer <accessToken>",
  "Content-Type": "application/json"
}

// Optional Headers (some endpoints)
{
  "X-Branch-Slug": "branch-abc",  // Filter by branch
  "X-Store": "store-1",           // Select store/location
}
```

### Example with cURL

```bash
# Public Request (No Auth)
curl -X GET "https://api.example.com/products" \
  -H "Content-Type: application/json"

# Authenticated Request
curl -X GET "https://api.example.com/orders" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json"

# With Branch Filter
curl -X GET "https://api.example.com/orders" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "X-Branch-Slug: branch-123" \
  -H "Content-Type: application/json"
```

---

## 8. Token Refresh Flow

### Automatic Token Refresh

```
1️⃣ Client sends request with accessToken
     ↓
2️⃣ Interceptor checks: Is token expired?
     ├─ NO → Send request normally
     │
     └─ YES → Check refresh token
         ├─ Refresh token expired? → Logout (401)
         │
         └─ Refresh token valid? → Proceed to step 3

3️⃣ POST /auth/refresh
   {
     "accessToken": currentToken,
     "refreshToken": currentRefreshToken
   }
     ↓
4️⃣ Server returns new tokens
   {
     "accessToken": newToken,
     "refreshToken": newRefreshToken,
     "expireTime": newExpireTime,
     "expireTimeRefreshToken": newExpireTimeRefresh
   }
     ↓
5️⃣ Store new tokens in AuthStore
     ↓
6️⃣ Retry original request with new token
     ↓
7️⃣ Return response to client
```

### No Manual Refresh Needed

✅ **DO NOT** manually call `/auth/refresh`
✅ Token refresh is **automatic** and transparent
✅ All failed requests due to expired token are **retried automatically**

---

## 9. Error Handling

### Global Error Handling (Automatic)

```typescript
// All API errors automatically handled:

1. Extract statusCode from response
2. Lookup in errorCodes mapping
3. Show toast with translated message
4. Log error (in development)

// Example
Error 143426 (Voucher Expired)
  ↓
errorCodes[143426] = 'toast.voucherExpired'
  ↓
i18next.t('toast.voucherExpired')
  ↓
Show toast: "Voucher has expired"
```

### Custom Error Handling

```typescript
// For specific errors requiring custom handling:

const { mutate } = useLogin()

mutate(
  { phone, password },
  {
    onError: (error) => {
      if (isAxiosError(error)) {
        const code = error.response?.data?.statusCode

        if (code === 119033) {
          // Account disabled - show special message
          showDialog('Your account has been disabled')
        } else {
          // Default handling
          showErrorToast(code)
        }
      }
    },
  },
)
```

---

## 10. Pagination & Filtering

### Query Parameters

```typescript
// Pagination
GET /orders?page=0&limit=20
  page: 0-based page number
  limit: Items per page

// Filtering
GET /products?category=food&branch=branch-1
  category: Filter by category
  branch: Filter by branch

// Sorting
GET /orders?sort=createdAt&order=DESC
  sort: Field to sort by
  order: ASC or DESC

// Search
GET /users?search=john
  search: Search term
```

### Response Format (Paginated)

```typescript
{
  "code": 0,
  "message": "Success",
  "data": {
    "items": [ ... ],
    "total": 250,      // Total items
    "page": 0,         // Current page
    "limit": 20,       // Items per page
    "totalPage": 13    // Total pages
  }
}
```

---

## 11. File Operations

### Download File (Blob Response)

```typescript
// Request
GET /invoice/export/public?slug=order-123
  responseType: 'blob'

// Response
Blob (binary data)
├─ File type: application/pdf
├─ File name: order-123.pdf (from header)
└─ Download automatically (browser)

// Example Hook Usage
const { mutate: exportInvoice } = useExportInvoice()

exportInvoice(
  { orderSlug: 'order-123' },
  {
    onSuccess: (blob) => {
      // Browser automatically downloads
      // Or handle manually:
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'invoice.pdf'
      link.click()
    }
  }
)
```

---

## 12. Quick Reference Table

### API Categories

| Category           | Endpoints | Auth  | Notes              |
| ------------------ | --------- | ----- | ------------------ |
| **Authentication** | 13        | ❌    | Public auth flows  |
| **Orders**         | 17        | ✅/❌ | Both public & auth |
| **Vouchers**       | 18        | ✅/❌ | Validation public  |
| **Products**       | 14        | ✅\*  | Browsing public    |
| **Users**          | 13        | ✅\*  | Admin only         |
| **Menus**          | 8         | ✅\*  | Admin only         |
| **Payments**       | 3         | ✅/❌ | Both public & auth |
| **Loyalty Points** | 5         | ✅    | Auth only          |
| **Gift Cards**     | 14        | ✅/❌ | Mixed              |
| **Chef/Printers**  | 30        | ✅\*  | Admin only         |
| **System Config**  | 10        | ✅\*  | Admin only         |
| **Analytics**      | 8         | ✅\*  | Admin only         |
| **Notifications**  | 4         | ✅    | Auth only          |
| **Other**          | 20        | ✅\*  | Mixed              |
| **TOTAL**          | **301+**  |       |                    |

---

## 13. Common Scenarios

### Scenario 1: Browse Products (No Login)

```
GET /products
  ↓ (No auth needed)
[Product list returned]
```

### Scenario 2: Create Order (No Login)

```
POST /orders/public
  {
    "items": [...],
    "type": "DELIVERY"
  }
  ↓ (No auth needed)
[Order created, return slug]
```

### Scenario 3: View User Orders (With Login)

```
1. POST /auth/login
   ↓
   [Get token]

2. GET /orders
   Authorization: Bearer <token>
   ↓
   [User's orders returned]
```

### Scenario 4: Admin Create User (With Permissions)

```
1. POST /auth/login (with admin credentials)
   ↓
   [Get token with admin permissions]

2. POST /user
   Authorization: Bearer <token>
   {
     "phoneNumber": "...",
     "firstName": "..."
   }
   ↓
   [Check permissions in JWT]
   ├─ Has "PERMISSION_CREATE_USER"?
   │  ├─ YES → Create user (200)
   │  └─ NO → Forbidden (403)
```

### Scenario 5: Token Expired During Request

```
1. GET /orders
   Authorization: Bearer <expiredToken>
   ↓
   [Interceptor detects expired token]

2. Auto-Refresh:
   POST /auth/refresh
   ↓
   [Get new tokens]

3. Retry Original Request:
   GET /orders
   Authorization: Bearer <newToken>
   ↓
   [Orders returned]
```

---

## 14. Security Best Practices

✅ **DO:**

- Always send Bearer token for authenticated requests
- Use HTTPS for all API calls
- Store tokens in secure localStorage (persisted by Zustand)
- Let interceptor handle token refresh automatically
- Validate response status codes
- Handle error codes with fallback messages

❌ **DON'T:**

- Send token in URL query params
- Store token in cookies (vulnerable to XSS)
- Manually manage token refresh
- Ignore 401 errors (they mean token invalid)
- Log token values in production
- Hardcode API endpoints (use environment variables)

---

## 15. API File Locations

```
src/api/
├── auth.ts               # Authentication endpoints
├── order.ts              # Order management
├── product.ts            # Product CRUD
├── menu.ts               # Menu management
├── voucher.ts            # Voucher management
├── user.ts               # User & group management
├── profile.ts            # User profile
├── payment.ts            # Payment processing
├── branch.ts             # Branch management
├── table.ts              # Table management
├── promotion.ts          # Promotions
├── revenue.ts            # Analytics
├── loyalty-point.ts      # Loyalty points
├── gift-card.ts          # Gift cards
├── notification.ts       # Notifications
├── chef-area.ts          # Chef area & printers
├── banner.ts             # Banners
├── catalog.ts            # Catalogs
├── role.ts               # Roles & permissions
├── system.ts             # System config
├── logger.ts             # System logs
└── ... (more files)

HTTP Interceptors:
utils/
├── http.ts               # Axios instance config
└── http.unified.ts       # Token refresh logic
```

---

## 16. Summary

```
┌──────────────────────────────────────────────────┐
│ API ENDPOINTS SUMMARY                            │
├──────────────────────────────────────────────────┤
│                                                  │
│ 📊 Total Endpoints: 300+                         │
│                                                  │
│ 🔓 Public (No Auth):  31 endpoints               │
│    - Authentication flows                       │
│    - Product browsing                           │
│    - Order creation (guest)                     │
│    - Voucher validation                         │
│    - Branch & menu info                         │
│                                                  │
│ 🔒 Authenticated: 270+ endpoints                 │
│    - User management                            │
│    - Order operations                           │
│    - CRUD for most resources                    │
│    - Admin operations (with permissions)        │
│                                                  │
│ 🛡️  Protected (Admin Only):                     │
│    - System configuration                       │
│    - User management                            │
│    - Revenue & analytics                        │
│    - Chef area & printers                       │
│    - Feature flags & logs                       │
│                                                  │
│ 🔄 Token Refresh:                                │
│    - Automatic (transparent to client)          │
│    - No manual action needed                    │
│    - Failed requests retried                    │
│                                                  │
│ 📝 Error Handling:                               │
│    - Global error interceptor                   │
│    - Auto toast on errors                       │
│    - 320+ error codes mapped                    │
│                                                  │
└──────────────────────────────────────────────────┘
```
