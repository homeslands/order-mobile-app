# Phân tích Flow nhận thông báo từ Firebase (FCM)

**Các file chính:**

| Nhóm                      | File                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| **Config**                | `order-ui/src/lib/firebase-config.ts`                                 |
| **Service Worker**        | `order-ui/public/firebase-messaging-sw.js`                            |
| **Lấy token (Web)**       | `order-ui/src/utils/getWebFcmToken.ts`                                |
| **Lấy token (Native)**    | `order-ui/src/utils/getNativeFcmToken.ts`                             |
| **Hook lấy token**        | `order-ui/src/hooks/use-firebase-notification.ts`                     |
| **Hook lắng nghe**        | `order-ui/src/hooks/use-notification-listener.ts`                     |
| **Queue đăng ký token**   | `order-ui/src/services/token-registration-queue.ts`                   |
| **Quản lý refresh token** | `order-ui/src/services/fcm-token-manager.ts`                          |
| **Provider**              | `order-ui/src/components/app/notification-provider.tsx`               |
| **Store**                 | `order-ui/src/stores/notification.store.ts`                           |
| **UI (System)**           | `order-ui/src/components/app/popover/system-notification-popover.tsx` |
| **UI (Client)**           | `order-ui/src/components/app/popover/client-notification-popover.tsx` |
| **Navigation**            | `order-ui/src/utils/notification-navigation.ts`                       |
| **Types**                 | `order-ui/src/types/notification.types.ts`                            |
| **Constants**             | `order-ui/src/constants/notification.constants.ts`                    |
| **Backend Service**       | `order-api/src/notification/notification.service.ts`                  |
| **Backend Firebase**      | `order-api/src/notification/firebase/firebase.service.ts`             |
| **Backend Producer**      | `order-api/src/notification/notification.producer.ts`                 |
| **Backend Consumer**      | `order-api/src/notification/notification.consumer.ts`                 |
| **Backend Triggers**      | `order-api/src/notification/notification.utils.ts`                    |

---

## 1. Tổng quan

Hệ thống sử dụng **Firebase Cloud Messaging (FCM)** để gửi thông báo real-time. Hỗ trợ 3 nền tảng: **Web**, **Android**, **iOS**. Flow chính gồm 4 giai đoạn:

1. **Đăng ký token** — Lấy FCM token từ device, gửi lên backend
2. **Backend gửi thông báo** — Tạo notification, gửi qua FCM đến device
3. **Frontend nhận thông báo** — Foreground (trong app) và Background (ngoài app)
4. **Hiển thị & tương tác** — Toast, badge, danh sách, navigation

---

## 2. Firebase Configuration

### Frontend (`firebase-config.ts`)

| Env Variable                        | Mô tả                                        |
| ----------------------------------- | -------------------------------------------- |
| `VITE_FIREBASE_API_KEY`             | API key                                      |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Auth domain                                  |
| `VITE_FIREBASE_PROJECT_ID`          | Project ID                                   |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Storage bucket                               |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID                                    |
| `VITE_FIREBASE_APP_ID_WEB`          | App ID (phải là web, không phải Android/iOS) |
| `VITE_FIREBASE_VAPID_KEY`           | VAPID key cho web push                       |

**Validation:**

- Kiểm tra App ID phải đúng format web (không phải Android/iOS)
- Detect platform (web/android/ios) để chọn App ID phù hợp
- Kiểm tra Project ID không conflict giữa nhiều Firebase app

### Backend

| Env Variable            | Mô tả                 |
| ----------------------- | --------------------- |
| `FIREBASE_PROJECT_ID`   | Project ID            |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY`  | Private key           |

---

## 3. Đăng ký FCM Token

### 3.1. Flow tổng quan

```
[User đăng nhập]
     │
     ▼
[useFirebaseNotification(userId)]
     │
     ▼
[Detect platform: Capacitor.getPlatform()]
     │
     ├── Web ──→ getWebFcmToken()
     │
     └── Native (Android/iOS) ──→ getNativeFcmToken()
     │
     ▼
[So sánh token mới vs token cũ]
     │
     ├── Giống nhau → Không làm gì
     │
     └── Khác nhau
          │
          ├── Unregister token cũ (nếu có)
          │
          └── Register token mới → tokenRegistrationQueue
               │
               ▼
          [POST /notification/firebase/register-device-token]
               │
               ▼
          [Backend lưu vào FirebaseDeviceToken table]
```

### 3.2. Lấy token trên Web (`getWebFcmToken.ts`)

```
1. Notification.requestPermission()
     │
     ├── 'denied' → Trả về null, set permissionDenied = true
     │
     └── 'granted'
          │
          ▼
2. navigator.serviceWorker.register('/firebase-messaging-sw.js')
          │
          ▼
3. postMessage Firebase config đến Service Worker
          │
          ▼
4. initializeApp(firebaseConfig) + validate Project ID
          │
          ▼
5. getMessaging(app)
          │
          ▼
6. getToken(messaging, { vapidKey, serviceWorkerRegistration })
          │
          ▼
7. Trả về FCM token string
```

### 3.3. Lấy token trên Native (`getNativeFcmToken.ts`)

```
1. PushNotifications.requestPermissions()
     │
     ├── 'denied' → Trả về null
     │
     └── 'granted'
          │
          ▼
2. PushNotifications.register()
          │
          ▼
3. Listen event 'registration' (timeout 10 giây)
          │
          ├── Thành công → Trả về token
          │
          └── Timeout / registrationError → Trả về null
```

### 3.4. Token Registration Queue (`token-registration-queue.ts`)

Hàng đợi đăng ký token với cơ chế retry:

| Thuộc tính     | Giá trị                         |
| -------------- | ------------------------------- |
| Max retry      | **3 lần**                       |
| Backoff delays | 1s → 5s → 15s (exponential)     |
| Auto-retry khi | Mạng reconnect (`online` event) |
| Toast debounce | 5 giây                          |

**Phân loại lỗi:**

| Loại lỗi                      | HTTP Status | Retry?           |
| ----------------------------- | ----------- | ---------------- |
| Network (timeout, connection) | —           | ✅               |
| Validation                    | 400         | ❌               |
| Auth                          | 401, 403    | ❌               |
| Server                        | 500+        | ✅               |
| Rate limit                    | 429         | ✅ (delay riêng) |

**Sau khi đăng ký thành công:**

- Lưu token vào `userStore` (persisted)
- Lưu timestamp vào `localStorage`

### 3.5. Token Refresh Manager (`fcm-token-manager.ts`)

| Thuộc tính          | Giá trị                                  |
| ------------------- | ---------------------------------------- |
| Kiểm tra mỗi        | **24 giờ** (`TOKEN_CHECK_INTERVAL`)      |
| Refresh nếu token > | **48 giờ** (`TOKEN_REFRESH_THRESHOLD`)   |
| Re-check khi        | Tab trở lại visible (`visibilitychange`) |
| Bắt đầu khi         | User đăng nhập                           |
| Dừng khi            | User đăng xuất                           |

---

## 4. Backend gửi thông báo

### 4.1. Triggers (Khi nào gửi thông báo?)

| Event                    | Message Code                         | Người nhận                |
| ------------------------ | ------------------------------------ | ------------------------- |
| Đơn hàng thanh toán      | `ORDER_NEEDS_PROCESSED`              | Tất cả chef trong branch  |
| Đơn hàng đã xử lý        | `ORDER_NEEDS_DELIVERED`              | Tất cả staff trong branch |
| Đơn hàng sẵn sàng lấy    | `ORDER_NEEDS_READY_TO_GET`           | Khách hàng                |
| In hóa đơn thất bại      | `ORDER_BILL_FAILED_PRINTING`         | Staff                     |
| In chef order thất bại   | `ORDER_CHEF_ORDER_FAILED_PRINTING`   | Staff                     |
| In label ticket thất bại | `ORDER_LABEL_TICKET_FAILED_PRINTING` | Staff                     |

### 4.2. Flow gửi (Producer → Consumer → FCM)

```
[Event xảy ra (VD: đơn hàng thanh toán)]
     │
     ▼
[notification.utils.ts] → Xác định người nhận + message code
     │
     ▼
[NotificationProducer.createNotification()]
     │  Thêm job vào BullMQ queue: 'create-notification'
     │
     ▼
[NotificationConsumer] → Xử lý job từ queue
     │
     ▼
[NotificationService.create()]
     │
     ├── 1. Tạo Notification entity trong database
     │
     ├── 2. Fetch tất cả device tokens của receiver
     │      từ bảng FirebaseDeviceToken
     │
     ├── 3. Build FCM message theo platform
     │      │
     │      ├── Web:     webpush config (icon, badge, link)
     │      ├── Android: android config (high priority, sound, clickAction)
     │      └── iOS:     apns config (sound, badge, content-available)
     │
     ├── 4. FirebaseService.sendToAllPlatforms()
     │      → firebase-admin SDK gửi đến FCM server
     │
     └── 5. Cleanup: Xóa invalid tokens nếu gửi thất bại
```

### 4.3. FCM Message structure

```ts
{
  notification: {
    title: string,     // Tiêu đề thông báo
    body: string,      // Nội dung thông báo
  },
  data: {
    slug: string,              // Notification slug
    message: string,           // Message code (VD: 'order-needs-processed')
    type: string,              // Notification type
    payload: JSON.stringify({  // Metadata serialized
      order: string,
      orderType: string,
      tableName: string,
      table: string,
      branchName: string,
      branch: string,
      referenceNumber?: string,
      createdAt: string,
    })
  },
  // Platform-specific configs...
  webpush: { ... },
  android: { ... },
  apns: { ... },
}
```

---

## 5. Frontend nhận thông báo

### 5.1. Foreground (App đang mở)

#### Web

```
[Firebase SDK onMessage() listener]
     │  (setup trong setupWebMessageListener)
     │
     ▼
[useNotificationListener hook nhận payload]
     │
     ▼
[Convert → NotificationPayload]
     │
     ▼
[notificationStore.addNotification({ markAsRead: false })]
     │
     ▼
[NotificationProvider xử lý:]
     ├── Extract message code từ data
     ├── Hiển thị toast notification (6 giây)
     ├── Phát âm thanh notification.mp3 (volume 0.5)
     └── Đặc biệt: printer fail → refetch printer events + volume 0.8
```

#### Native (Android/iOS)

```
[PushNotifications 'pushNotificationReceived' event]
     │
     ▼
[useNotificationListener hook nhận payload]
     │
     ▼
[Tạo local notification: LocalNotifications.schedule()]
     │  (Hiển thị notification bar trên device)
     │
     ▼
[notificationStore.addNotification({ markAsRead: false })]
     │
     ▼
[NotificationProvider → toast + sound (giống web)]
```

### 5.2. Background (App không mở / tab không active)

#### Web (Service Worker)

```
[firebase-messaging-sw.js]
     │
     ▼
[onBackgroundMessage(messaging, payload)]
     │
     ▼
[self.registration.showNotification(title, options)]
     │  → System notification hiển thị trên OS
     │
     ▼
[User click notification]
     │
     ▼
[Event 'notificationclick' trong SW]
     │
     ├── Extract URL từ notification.data.url hoặc data.route
     │
     ├── Có window đang mở?
     │   ├── Có → Focus window + postMessage('NOTIFICATION_NAVIGATION')
     │   └── Không → clients.openWindow(url)
     │
     ▼
[Main thread nhận message từ SW]
     │
     ▼
[notification-navigation.ts → React Router navigate()]
```

#### Native (Android/iOS)

```
[OS hiển thị push notification trên notification bar]
     │
     ▼
[User tap notification]
     │
     ▼
[PushNotifications 'pushNotificationActionPerformed' event]
     │
     ▼
[NotificationListenerService xử lý:]
     │
     ├── App đang chạy?
     │   ├── Có → Navigate ngay
     │   └── Không → Lưu pending URL, đợi React mount (500ms delay)
     │
     ▼
[deepLinkHandler.navigate() → điều hướng đến trang liên quan]
```

---

## 6. Notification Store (Zustand)

### State

| Field           | Type              | Mô tả                                  |
| --------------- | ----------------- | -------------------------------------- |
| `notifications` | `INotification[]` | Danh sách in-memory (max **50** items) |

### Actions

| Action                     | Mô tả                                                 |
| -------------------------- | ----------------------------------------------------- |
| `addNotification(payload)` | Thêm/cập nhật notification, parse `data.payload` JSON |
| `markAsRead(slug)`         | Đánh dấu đã đọc (local)                               |
| `markAllAsRead()`          | Đánh dấu tất cả đã đọc                                |
| `getUnreadCount()`         | Trả về số notification chưa đọc                       |
| `getUnreadPrinterFails()`  | Trả về số lỗi in chưa đọc                             |
| `hydrateFromApi(apiData)`  | Merge notification từ API vào local store             |

### Payload Parsing Logic

```
1. Kiểm tra data.payload (JSON string) → parse
2. Fallback: kiểm tra data.message, data.type, data.notificationType
3. Merge parsed payload với raw data (parsed ưu tiên hơn)
```

---

## 7. Notification Provider (`notification-provider.tsx`)

Component wrapper quản lý toàn bộ notification lifecycle:

### Trách nhiệm

| #   | Trách nhiệm                                                           |
| --- | --------------------------------------------------------------------- |
| 1   | Lấy FCM token qua `useFirebaseNotification()`                         |
| 2   | Lắng nghe notification qua `useNotificationListener()`                |
| 3   | Extract message code từ nhiều nguồn trong payload                     |
| 4   | Hiển thị toast notification (custom styling)                          |
| 5   | Phát âm thanh notification                                            |
| 6   | Xử lý đặc biệt cho printer fail (sound khác + refetch printer events) |
| 7   | Hiện dialog xin quyền nếu notification bị denied                      |
| 8   | Quản lý FCM token refresh scheduler                                   |

### Toast Notification

| Thuộc tính   | Giá trị                                              |
| ------------ | ---------------------------------------------------- |
| Duration     | **6 giây**                                           |
| Position     | Top-right                                            |
| Styling      | Custom Tailwind, icon + title + body + action button |
| Auto-dismiss | ✅                                                   |
| Library      | `react-hot-toast`                                    |

### Sound

| Case                    | Volume                  | File               |
| ----------------------- | ----------------------- | ------------------ |
| Notification thường     | **0.5**                 | `notification.mp3` |
| Printer failure         | **0.8**                 | `notification.mp3` |
| `ORDER_NEEDS_PROCESSED` | **Bỏ qua** (tránh spam) | —                  |

---

## 8. Hiển thị UI

### 8.1. System Notification Popover

**Component:** `system-notification-popover.tsx`

| Tính năng    | Mô tả                                                 |
| ------------ | ----------------------------------------------------- |
| Bell icon    | Hiển thị badge đếm số chưa đọc                        |
| Tab "Tất cả" | Notification không phải printer fail                  |
| Tab "Lỗi"    | Notification printer failure                          |
| Fetch API    | Khi mở popover, fetch từ API                          |
| Auto-fetch   | Nếu page hiện tại toàn printer fail → fetch page tiếp |
| Click item   | Mark as read + navigate đến order liên quan           |

### 8.2. Printer Failure Dialog

| Tính năng    | Mô tả                                                |
| ------------ | ---------------------------------------------------- |
| Hiển thị     | Danh sách đơn hàng in thất bại                       |
| Phân loại    | Theo message code (bill / chef order / label ticket) |
| Dedup        | Track slug đã hiển thị, tránh trùng lặp              |
| Grace period | Chỉ hiển thị unread + 30 giây sau retry              |
| Update       | Cập nhật khi printer events thay đổi                 |

### 8.3. Client Notification Popover

Tương tự System nhưng cho giao diện khách hàng.

---

## 9. Đánh dấu đã đọc (Mark as Read)

### Local (In-App)

```ts
notificationStore.markAsRead(slug) // Cập nhật store ngay lập tức (optimistic)
```

### Backend Sync

```
PATCH /notification/{slug}/read
→ useUpdateNotificationStatus() mutation
→ Backend cập nhật isRead = true trong database
```

### Tự động đánh dấu

| Case                                                   | Hành vi                    |
| ------------------------------------------------------ | -------------------------- |
| Foreground: Click notification trong app               | Mark as read               |
| Background (Native): Tap notification                  | Mark as read               |
| Background (Web): Click system notification → navigate | Mark khi user quay lại app |

---

## 10. Permission Handling

### Dialog xin quyền (`notification-permission-dialog.tsx`)

**Hiển thị khi:** `useFirebaseNotification` detect `permissionDenied = true`

| Platform | Hướng dẫn                              |
| -------- | -------------------------------------- |
| Web      | Thanh địa chỉ → Notifications → Allow  |
| Native   | Settings → App → Notifications → Allow |

**Hành vi:**

- User có thể dismiss dialog
- Không tự mở lại nếu đã dismiss
- Track trạng thái dismiss để tránh hiện lại liên tục

---

## 11. Notification Types & Message Codes

### `NotificationPayload`

```ts
{
  notification?: {
    title?: string
    body?: string
    icon?: string
    image?: string
  }
  data?: Record<string, string>
  messageId?: string
}
```

### `INotification` (Store)

```ts
{
  slug: string
  createdAt: string
  message: NotificationMessageCode
  senderId: string
  receiverId: string
  type: string
  isRead: boolean
  metadata: {
    order: string
    orderType: string
    tableName: string
    table: string
    branchName: string
    branch: string
    referenceNumber?: string
    createdAt: string
  }
}
```

### Message Codes

| Code                                 | Mô tả                            |
| ------------------------------------ | -------------------------------- |
| `order-needs-processed`              | Đơn cần xử lý (gửi cho chef)     |
| `order-needs-delivered`              | Đơn cần giao (gửi cho staff)     |
| `order-needs-cancelled`              | Đơn bị hủy                       |
| `order-needs-ready-to-get`           | Đơn sẵn sàng lấy (gửi cho khách) |
| `order-bill-failed-printing`         | In hóa đơn thất bại              |
| `order-chef-order-failed-printing`   | In chef order thất bại           |
| `order-label-ticket-failed-printing` | In label ticket thất bại         |

---

## 12. API Endpoints

| Endpoint                                       | Method | Mô tả                                   |
| ---------------------------------------------- | ------ | --------------------------------------- |
| `/notification/firebase/register-device-token` | POST   | Đăng ký FCM token                       |
| `/notification`                                | GET    | Lấy danh sách notification (phân trang) |
| `/notification/{slug}/read`                    | PATCH  | Đánh dấu đã đọc                         |

### Request đăng ký token

```ts
POST /notification/firebase/register-device-token
{
  token: string,        // FCM token
  platform: 'web' | 'android' | 'ios',
  userAgent: string     // navigator.userAgent
}
```

**Backend xử lý:**

- Token đã tồn tại → Cập nhật `userId`, `platform`, `userAgent`
- Token mới → Tạo `FirebaseDeviceToken` entity mới

---

## 13. Error Handling & Cleanup

### Invalid Token Cleanup (Backend)

```
[Gửi FCM thất bại cho 1 token]
     │
     ▼
[FirebaseService trả về failedTokens]
     │
     ▼
[Xóa token khỏi bảng firebase_device_token_tbl]
     │  → Tránh tích lũy token rác
```

### Firebase Initialization Errors (Frontend)

| Lỗi                                         | Xử lý                                |
| ------------------------------------------- | ------------------------------------ |
| Config thiếu                                | Validate trước khi init, log warning |
| Project ID conflict                         | Log chi tiết, cảnh báo               |
| App ID sai format (Android/iOS thay vì Web) | Reject, log error                    |
| Init thất bại                               | Fallback gracefully, không crash app |

---

## 14. Sơ đồ flow tổng quan

```
┌─────────────────────────────────────────────────────────────────┐
│                        ĐĂNG KÝ TOKEN                            │
│                                                                 │
│  [User login] → [Detect platform] → [Request permission]       │
│       → [Get FCM token] → [Register queue (retry 3x)]          │
│       → [POST /register-device-token] → [DB: FirebaseDeviceToken]│
│                                                                 │
│  [Token Refresh Manager: check mỗi 24h, refresh nếu > 48h]    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND GỬI THÔNG BÁO                       │
│                                                                 │
│  [Event xảy ra] → [NotificationProducer → BullMQ queue]        │
│       → [NotificationConsumer xử lý job]                        │
│       → [Tạo Notification entity trong DB]                      │
│       → [Fetch device tokens của receiver]                      │
│       → [Build FCM message (web/android/ios)]                   │
│       → [FirebaseService.sendToAllPlatforms()]                  │
│       → [Cleanup invalid tokens]                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND NHẬN THÔNG BÁO                      │
│                                                                 │
│  ┌── Foreground ──────────────────────────────────────────┐     │
│  │  Web:    onMessage() → store → toast + sound           │     │
│  │  Native: pushNotificationReceived → local notif        │     │
│  │          → store → toast + sound                       │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌── Background ──────────────────────────────────────────┐     │
│  │  Web:    SW onBackgroundMessage → showNotification()   │     │
│  │          → click → postMessage → navigate              │     │
│  │  Native: OS notification → tap → actionPerformed       │     │
│  │          → deepLinkHandler.navigate()                  │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      HIỂN THỊ & TƯƠNG TÁC                       │
│                                                                 │
│  [Bell icon + badge count]                                      │
│  [Popover: Tab "Tất cả" | Tab "Lỗi"]                          │
│  [Click → markAsRead + navigate đến order]                      │
│  [Printer fail → Dialog riêng + refetch printer events]         │
│  [PATCH /notification/{slug}/read → sync backend]               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15. Cấu trúc thư mục

```
order-ui/src/
├── lib/
│   └── firebase-config.ts                      # Config + validation
├── services/
│   ├── fcm-token-manager.ts                    # Token refresh scheduler
│   ├── token-registration-queue.ts             # Queue đăng ký token (retry)
│   └── notification-listener-service.ts        # Singleton lắng nghe (early setup)
├── hooks/
│   ├── use-firebase-notification.ts            # Lấy + đăng ký token
│   ├── use-notification.ts                     # API hooks (CRUD notification)
│   └── use-notification-listener.ts            # Lắng nghe foreground/background
├── utils/
│   ├── getWebFcmToken.ts                       # Web: token + listener
│   ├── getNativeFcmToken.ts                    # Native: token
│   └── notification-navigation.ts              # Điều hướng khi click
├── stores/
│   └── notification.store.ts                   # Zustand store (max 50 items)
├── types/
│   └── notification.types.ts                   # TypeScript interfaces
├── constants/
│   └── notification.constants.ts               # Message codes
├── components/app/
│   ├── notification-provider.tsx               # Provider chính
│   ├── dialog/notification-permission-dialog.tsx
│   └── popover/
│       ├── system-notification-popover.tsx      # UI system
│       └── client-notification-popover.tsx      # UI client
└── assets/sound/
    └── notification.mp3                        # Âm thanh thông báo

order-ui/public/
└── firebase-messaging-sw.js                    # Service Worker background

order-api/src/notification/
├── firebase/
│   ├── firebase.service.ts                     # Gửi qua FCM Admin SDK
│   ├── firebase.dto.ts
│   └── firebase-device-token.entity.ts         # Entity lưu token
├── notification.service.ts                     # Service chính
├── notification.producer.ts                    # BullMQ producer
├── notification.consumer.ts                    # BullMQ consumer
├── notification.utils.ts                       # Trigger functions
├── notification.controller.ts                  # API endpoints
├── notification.entity.ts                      # Notification model
└── notification.constants.ts
```
