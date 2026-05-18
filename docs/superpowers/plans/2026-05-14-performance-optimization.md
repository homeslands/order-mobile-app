# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead stores/utilities, migrate stragglers to the unified order-flow store, fix memory leaks in notification/FCM/back-handler hooks, consolidate spring configs, and cache heavy display-totals computations.
**Architecture:** Five sequenced groups in increasing risk order — (1) pure deletions, (2) consumer migration + deletions, (3) hook leak fixes, (4) spring config consolidation, (5) display-totals memo/cache optimizations. Every group ends with `typecheck`, `lint`, and a Conventional Commit.
**Tech Stack:** Zustand, React Native + Expo, Reanimated, Firebase Messaging, expo-av, Zustand persist middleware.

---

## Task 1: NHÓM 1 — Xóa dead code

**Files:**
- Delete: `stores/current-order.store.ts`
- Delete: `stores/selected-order.store.ts`
- Delete: `stores/menu.store.ts`
- Delete: `stores/menu-item.store.ts`
- Delete: `utils/order-comparison.ts`
- Delete: `stores/slices/update-order-customer.slice.ts`
- Delete: `stores/slices/update-order-items.slice.ts`
- Delete: `stores/slices/update-order-payment.slice.ts`
- Delete: `stores/slices/update-order-table.slice.ts`
- Delete: `stores/slices/update-order-voucher.slice.ts`
- Modify: `stores/index.ts` — remove dead re-exports
- Modify: `utils/index.ts:16` — remove `order-comparison` re-export

> **Note:** `stores/update-order.store.ts` is NOT deleted here — Group 2 migrates its 3 callsites before deletion. The `IOriginalOrderStore` block + slice imports live there and stay through Group 1 to keep typecheck green.

- [ ] **Step 1: Verify the targets really have zero consumers (outside themselves)**
```bash
cd /Users/phanquyetthang/mobile-movie-app
grep -rn "useCurrentOrderStore\|useSelectedOrderStore\|useMenuItemStore\|menuItemStore" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v "stores/current-order.store.ts" | grep -v "stores/selected-order.store.ts" | grep -v "stores/menu.store.ts" | grep -v "stores/menu-item.store.ts"
```
Expected output: empty (no consumers).

```bash
grep -rn "order-comparison\|getChangesSummary\|IOrderComparison" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v "utils/order-comparison.ts" | grep -v "utils/index.ts"
```
Expected output: empty.

- [ ] **Step 2: Delete the five dead stores**
```bash
rm /Users/phanquyetthang/mobile-movie-app/stores/current-order.store.ts
rm /Users/phanquyetthang/mobile-movie-app/stores/selected-order.store.ts
rm /Users/phanquyetthang/mobile-movie-app/stores/menu.store.ts
rm /Users/phanquyetthang/mobile-movie-app/stores/menu-item.store.ts
```

- [ ] **Step 3: Delete the dead 673-line utility**
```bash
rm /Users/phanquyetthang/mobile-movie-app/utils/order-comparison.ts
```

- [ ] **Step 4: Delete five orphan slice files for `IUpdateOrderStore`/`IOriginalOrderStore`**

These slices are imported only by `stores/update-order.store.ts` (which Group 2 will delete). After this step `stores/update-order.store.ts` will not typecheck — that's expected; Group 2 finishes the migration. To keep this group green, we patch `stores/update-order.store.ts` to inline noop methods first.

```bash
rm /Users/phanquyetthang/mobile-movie-app/stores/slices/update-order-customer.slice.ts
rm /Users/phanquyetthang/mobile-movie-app/stores/slices/update-order-items.slice.ts
rm /Users/phanquyetthang/mobile-movie-app/stores/slices/update-order-payment.slice.ts
rm /Users/phanquyetthang/mobile-movie-app/stores/slices/update-order-table.slice.ts
rm /Users/phanquyetthang/mobile-movie-app/stores/slices/update-order-voucher.slice.ts
```

- [ ] **Step 5: Rewrite `stores/update-order.store.ts` to a minimal shim (kept alive only for Group 2 to migrate)**

Replace the entire file `stores/update-order.store.ts` contents with this minimal version that compiles, exposes `clearStore` + `setOrderItems` for the 3 remaining callsites, and drops slices + `useOriginalOrderStore`:

```ts
import dayjs from 'dayjs'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { PaymentMethod } from '@/constants'
import { requestClearStoresExcept } from '@/lib/store-sync'
import {
  IOrder,
  IOrderToUpdate,
  IUpdateOrderStore,
  OrderStatus,
} from '@/types'

// ─── ID generators ────────────────────────────────────────────────────────────

const generateShortId = () => Math.random().toString(36).substring(2, 9)
const generateOrderId = () => `order_${Date.now()}_${generateShortId()}`

// ─── Stub slice noop factory ──────────────────────────────────────────────────

// Slices were deleted in Group 1 — provide inline noops so the shape of
// IUpdateOrderStore still compiles. This store is removed entirely in Group 2.
const noop = () => {}

// ─── Draft store (shim — will be deleted in Group 2) ──────────────────────────

export const useUpdateOrderStore = create<IUpdateOrderStore>()(
  persist(
    (set, get) => ({
      orderItems: null,
      isHydrated: false,

      getOrderItems: () => get().orderItems,

      clearStore: () => {
        set({ orderItems: null })
      },

      setOrderItems: (order: IOrder) => {
        requestClearStoresExcept('update-order')

        const { orderItems } = get()
        const orderStatus = orderItems ? orderItems.status : OrderStatus.PENDING
        const timestamp = dayjs().valueOf()

        const newOrderItems: IOrderToUpdate = {
          id: generateOrderId(),
          slug: order.slug,
          status: orderStatus,
          productSlug: '',
          owner: order.owner?.slug || '',
          paymentMethod: order?.payment?.paymentMethod || '',
          ownerFullName: order.owner?.firstName,
          ownerPhoneNumber: order.owner?.phonenumber,
          type: order.type,
          orderItems: order.orderItems.map((item) => ({
            id: `orderItem_${timestamp}_${item.variant.slug}`,
            slug: item.variant.product.slug,
            image: item.variant.product.image,
            name: item.variant.product.name,
            allVariants: item.variant.product.variants,
            variant: item.variant,
            size: item.variant.size.name,
            quantity: item.quantity,
            originalPrice: item.variant.price,
            promotion: item?.promotion ? item?.promotion : null,
            promotionValue: item?.promotion ? item?.promotion?.value : 0,
            description: item.variant.product.description,
            isLimit: item.variant.product.isLimit,
            isGift: item.variant?.product?.isGift || false,
            note: item.note,
          })),
          table: order.table?.slug,
          tableName: order.table?.name,
          note: order.description || '',
          approvalBy: order.approvalBy?.slug || '',
          voucher: order.voucher || null,
          payment: {
            orderSlug: order.slug,
            paymentMethod: order?.payment?.paymentMethod as PaymentMethod,
            qrCode: order?.payment?.qrCode,
            paymentSlug: order?.payment?.slug,
          },
        }

        set({ orderItems: newOrderItems })
      },

      // Stubs — slices removed in Group 1, real consumers removed in Group 2
      addCustomerInfo: noop,
      addStatus: noop,
      removeStatus: noop,
      removeCustomerInfo: noop,
      addApprovalBy: noop,
      addOrderItem: noop,
      addProductVariant: noop,
      updateOrderItemQuantity: noop,
      addNote: noop,
      addOrderType: noop,
      addOrderNote: noop,
      addTable: noop,
      removeTable: noop,
      addPaymentMethod: noop,
      removeOrderItem: noop,
      addVoucher: noop,
      removeVoucher: noop,
      setPaymentMethod: noop,
      setOrderSlug: noop,
      setQrCode: noop,
      setPaymentSlug: noop,
    }),
    {
      name: 'update-order-store',
      onRehydrateStorage: () => (error) => {
        if (error) {
          // Handle hydration error silently
        }
        setTimeout(() => {
          useUpdateOrderStore.setState({ isHydrated: true })
        }, 0)
      },
    },
  ),
)
```

- [ ] **Step 6: Remove `IOriginalOrderStore` from `types/update-order.type.ts`**

Edit `/Users/phanquyetthang/mobile-movie-app/types/update-order.type.ts` — delete lines 42-69 (the entire `IOriginalOrderStore` interface). Keep `IUpdateOrderStore` for the shim — Group 2 deletes both.

Replace the file contents entirely with:

```ts
import {
  ICartItem,
  IOrder,
  IOrderToUpdate,
  OrderTypeEnum,
  ITable,
  IVoucher,
  IOrderOwner,
  OrderStatus,
} from '@/types'

export interface IUpdateOrderStore {
  orderItems: IOrderToUpdate | null
  isHydrated: boolean
  getOrderItems: () => IOrderToUpdate | null
  clearStore: () => void
  setOrderItems: (order: IOrder) => void
  addCustomerInfo: (owner: IOrderOwner) => void
  addStatus: (status: OrderStatus) => void
  removeStatus: () => void
  removeCustomerInfo: () => void
  addApprovalBy: (approvalBy: string) => void
  addOrderItem: (item: ICartItem) => void
  addProductVariant: (id: string) => void
  updateOrderItemQuantity: (id: string, quantity: number) => void
  addNote: (id: string, note: string) => void
  addOrderType: (orderType: OrderTypeEnum) => void
  addOrderNote: (note: string) => void
  addTable: (table: ITable) => void
  removeTable: () => void
  addPaymentMethod: (paymentMethod: string) => void
  removeOrderItem: (cartItemId: string) => void
  addVoucher: (voucher: IVoucher) => void
  removeVoucher: () => void
  setPaymentMethod: (paymentMethod: string) => void
  setOrderSlug: (orderSlug: string) => void
  setQrCode: (qrCode: string) => void
  setPaymentSlug: (paymentSlug: string) => void
}
```

- [ ] **Step 7: Update `stores/index.ts` — drop dead re-exports**

Replace the file with:

```ts
export * from './auth.store'
export * from './branch.store'
export * from './cart-display.store'
export * from './cart.store'
export * from './catalog.store'
export * from './current-url.store'
export * from './download.store'
export * from './expanded-cart-notes.store'
export * from './forgot-password.store'
export * from './gift-card.store'
export * from './loading.store'
export * from './logout-sheet.store'
export * from './menu-filter.store'
export * from './notification.store'
export * from './order-flow.store'
export * from './payment-flow.store'
export * from './update-order-flow.store'
export * from './product-detail-selection.store'
export * from './order.store'
export * from './overview-filter.store'
export * from './payment-method.store'
export * from './payment.store'
export * from './price-range.store'
export * from './product-name.store'
export * from './request.store'
export * from './selected-chef-order.store'
export * from './scroll-position.store'
export * from './theme.store'
export * from './ui.store'
export * from './update-order.store'
export * from './user.store'
```

(Removed: `menu-item.store`, `menu.store`, `selected-order.store`.)

- [ ] **Step 8: Update `utils/index.ts` — drop `order-comparison` re-export**

Edit `/Users/phanquyetthang/mobile-movie-app/utils/index.ts:16` — delete the line `export * from './order-comparison'`. File becomes:

```ts
export * from './auth-helpers'
export * from './capitalizeFirstLetter'
export * from './cart'
export * from './current-url-manager'
export * from './date'
export * from './enum-labels'
export * from './format'
export * from './getNativeFcmToken'
export * from './getWebFcmToken'
export * from './google-map'
export * from './http'
export * from './loyalty-point'
// export * from './map-icons'
// export * from './notification-navigation'
export * from './order-api-diff'
export * from './payment-resolver'
// export * from './pdf-font'
// Export download-image functions (excluding duplicates)
export {
  downloadAndSaveImage,
  downloadQRCodeImage,
  useDownloadImage,
} from './download-image'

// Export download-pdf functions (excluding duplicates)
export { downloadAndSavePDF } from './download-pdf'

// Export permission functions from download-image (shared)
export {
  checkMediaLibraryPermission,
  requestMediaLibraryPermission,
} from './download-image'
export * from './permission'
export { computeProductDetailTotal } from './product-detail-calc'
export * from './priceRange'
// export * from './printer'
export * from './toast'
export * from './voucher'
export * from './voucher-validation-helper'
export * from './mask-identity'
export * from './decode-polyline'
```

- [ ] **Step 9: Verify the project compiles and lints clean**
```bash
cd /Users/phanquyetthang/mobile-movie-app
npm run typecheck
```
Expected: exit code 0.

```bash
npm run lint
```
Expected: exit code 0.

- [ ] **Step 10: Commit**
```bash
cd /Users/phanquyetthang/mobile-movie-app
git add stores/index.ts utils/index.ts types/update-order.type.ts stores/update-order.store.ts
git add -u stores/current-order.store.ts stores/selected-order.store.ts stores/menu.store.ts stores/menu-item.store.ts utils/order-comparison.ts stores/slices/update-order-customer.slice.ts stores/slices/update-order-items.slice.ts stores/slices/update-order-payment.slice.ts stores/slices/update-order-table.slice.ts stores/slices/update-order-voucher.slice.ts
git commit -m "$(cat <<'EOF'
chore(stores): delete dead stores, slices, and order-comparison util

Removes five zero-consumer stores (current-order, selected-order, menu,
menu-item) and five orphan slice files. Drops the 673-line
order-comparison util that has no callers. Reduces store/index.ts and
utils/index.ts surface area. Trims update-order.store.ts to a shim that
keeps the 3 remaining callsites compiling until Group 2 migrates them.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git status
```

---

## Task 2: NHÓM 2 — Migrate `useUpdateOrderStore` + `useCartItemStore` consumers

**Files:**
- Modify: `app/order/[id].tsx:35,139,166`
- Modify: `components/dialog/create-order-dialog.tsx:24,62,193,218`
- Modify: `components/cart/cart-confirm-order-sheet.tsx:13,68,160`
- Modify: `lib/store-sync-setup.ts`
- Modify: `stores/index.ts` — drop `update-order.store` re-export
- Modify: `types/update-order.type.ts` — drop `IUpdateOrderStore` once consumers gone
- Modify: `types/cart.type.ts` — drop `ICartItemStore` once consumers gone
- Delete: `stores/update-order.store.ts`
- Delete: `stores/cart-legacy.store.ts`

- [ ] **Step 1: Migrate `app/order/[id].tsx` — drop `setOrderItems` call (redundant)**

`app/update-order/[slug].tsx:86` already calls `initializeUpdating(order)` on the order-flow store when the update-order screen mounts. The legacy `setOrderItems(order)` in the handler is dead.

Edit `/Users/phanquyetthang/mobile-movie-app/app/order/[id].tsx`:

Replace lines 33-37:
```ts
import {
  useNotificationStore,
  useUpdateOrderStore,
  useUserStore,
} from '@/stores'
```
with:
```ts
import { useNotificationStore, useUserStore } from '@/stores'
```

Replace line 139:
```ts
  const setOrderItems = useUpdateOrderStore((s) => s.setOrderItems)
```
with: (delete the line entirely — no replacement)

Replace lines 155-172:
```ts
  const handleUpdateOrder = useCallback(() => {
    if (!getUserInfo()?.slug) {
      showErrorToast(1042)
      navigateNative.push(ROUTE.LOGIN)
      return
    }
    if (!order?.slug) return
    queryClient.prefetchQuery({
      queryKey: ['order', order.slug],
      queryFn: () => getOrderBySlug(order.slug),
    })
    setOrderItems(order)
    navigateNative.push(
      `${ROUTE.CLIENT_UPDATE_ORDER.replace('[slug]', order.slug)}` as Parameters<
        typeof navigateNative.push
      >[0],
    )
  }, [order, queryClient, setOrderItems, getUserInfo])
```
with:
```ts
  const handleUpdateOrder = useCallback(() => {
    if (!getUserInfo()?.slug) {
      showErrorToast(1042)
      navigateNative.push(ROUTE.LOGIN)
      return
    }
    if (!order?.slug) return
    queryClient.prefetchQuery({
      queryKey: ['order', order.slug],
      queryFn: () => getOrderBySlug(order.slug),
    })
    navigateNative.push(
      `${ROUTE.CLIENT_UPDATE_ORDER.replace('[slug]', order.slug)}` as Parameters<
        typeof navigateNative.push
      >[0],
    )
  }, [order, queryClient, getUserInfo])
```

- [ ] **Step 2: Migrate `components/dialog/create-order-dialog.tsx`**

Edit `/Users/phanquyetthang/mobile-movie-app/components/dialog/create-order-dialog.tsx`:

Replace lines 20-26:
```ts
import {
  IOrderingData,
  useBranchStore,
  useOrderFlowStore,
  useUpdateOrderStore,
  useUserStore,
} from '@/stores'
```
with:
```ts
import {
  IOrderingData,
  useBranchStore,
  useOrderFlowStore,
  useUserStore,
} from '@/stores'
```

Replace line 62:
```ts
  const clearUpdateOrderStore = useUpdateOrderStore((s) => s.clearStore)
```
with:
```ts
  const clearUpdateOrderStore = useOrderFlowStore((s) => s.clearUpdatingData)
```

(Lines 193 and 218 already call `clearUpdateOrderStore()` — local name kept, no further edits needed at those lines.)

- [ ] **Step 3: Migrate `components/cart/cart-confirm-order-sheet.tsx`**

Edit `/Users/phanquyetthang/mobile-movie-app/components/cart/cart-confirm-order-sheet.tsx`:

Replace lines 10-15:
```ts
import {
  useBranchStore,
  useOrderFlowStore,
  useUpdateOrderStore,
  useUserStore,
} from '@/stores'
```
with:
```ts
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
```

Replace line 68:
```ts
  const clearUpdateOrderStore = useUpdateOrderStore((s) => s.clearStore)
```
with:
```ts
  const clearUpdateOrderStore = useOrderFlowStore((s) => s.clearUpdatingData)
```

(Line 160 inside `onSuccess` already calls `clearUpdateOrderStore()` — no changes.)

- [ ] **Step 4: Rewrite `lib/store-sync-setup.ts` — drop `useUpdateOrderStore` + `useCartItemStore`**

Replace `/Users/phanquyetthang/mobile-movie-app/lib/store-sync-setup.ts` entirely with:

```ts
/**
 * Bootstrap — đăng ký store clear callbacks cho mediator.
 * Gọi ngay khi app khởi động, sau khi stores đã load.
 */
import { initStoreSync } from './store-sync'
import { useOrderFlowStore } from '@/stores/order-flow.store'
import { usePaymentFlowStore } from '@/stores/payment-flow.store'
import { useUpdateOrderFlowStore } from '@/stores/update-order-flow.store'
import { usePaymentMethodStore } from '@/stores/payment-method.store'

initStoreSync({
  cart: () => useOrderFlowStore.getState().clearOrderingData(),
  payment: () => {
    usePaymentMethodStore.getState().clearStore()
    usePaymentFlowStore.getState().clearPaymentData()
  },
  'update-order': () => {
    useUpdateOrderFlowStore.getState().clearUpdatingData()
  },
  'order-flow': () => useOrderFlowStore.getState().clearOrderingData(),
})
```

- [ ] **Step 5: Verify no remaining consumers of `useUpdateOrderStore` / `useCartItemStore` / `IUpdateOrderStore` / `ICartItemStore`**
```bash
cd /Users/phanquyetthang/mobile-movie-app
grep -rn "useUpdateOrderStore\|useCartItemStore\|IUpdateOrderStore\|ICartItemStore" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```
Expected output: only matches inside `stores/update-order.store.ts`, `stores/cart-legacy.store.ts`, `types/update-order.type.ts`, and `types/cart.type.ts` (the files we're about to delete or trim).

- [ ] **Step 6: Delete the two now-orphan stores**
```bash
rm /Users/phanquyetthang/mobile-movie-app/stores/update-order.store.ts
rm /Users/phanquyetthang/mobile-movie-app/stores/cart-legacy.store.ts
```

- [ ] **Step 7: Drop their exports from `stores/index.ts`**

Replace `/Users/phanquyetthang/mobile-movie-app/stores/index.ts` with (`update-order.store` line removed):

```ts
export * from './auth.store'
export * from './branch.store'
export * from './cart-display.store'
export * from './cart.store'
export * from './catalog.store'
export * from './current-url.store'
export * from './download.store'
export * from './expanded-cart-notes.store'
export * from './forgot-password.store'
export * from './gift-card.store'
export * from './loading.store'
export * from './logout-sheet.store'
export * from './menu-filter.store'
export * from './notification.store'
export * from './order-flow.store'
export * from './payment-flow.store'
export * from './update-order-flow.store'
export * from './product-detail-selection.store'
export * from './order.store'
export * from './overview-filter.store'
export * from './payment-method.store'
export * from './payment.store'
export * from './price-range.store'
export * from './product-name.store'
export * from './request.store'
export * from './selected-chef-order.store'
export * from './scroll-position.store'
export * from './theme.store'
export * from './ui.store'
export * from './user.store'
```

- [ ] **Step 8: Trim `types/update-order.type.ts` — drop `IUpdateOrderStore`**

Replace `/Users/phanquyetthang/mobile-movie-app/types/update-order.type.ts` with an empty stub (kept so any wildcard `export * from './update-order.type'` in `types/index.ts` keeps working):

```ts
// Intentionally empty — IUpdateOrderStore + IOriginalOrderStore removed
// after migrating to the unified order-flow store (Group 2).
export {}
```

- [ ] **Step 9: Trim `types/cart.type.ts` — drop `ICartItemStore`**

Read first to find the interface block:
```bash
grep -n "ICartItemStore" /Users/phanquyetthang/mobile-movie-app/types/cart.type.ts
```

Delete the entire `export interface ICartItemStore { ... }` block from `/Users/phanquyetthang/mobile-movie-app/types/cart.type.ts`. (Use Edit tool with the exact block contents pulled from a fresh Read; the rest of the file stays unchanged.)

- [ ] **Step 10: Run final checks**
```bash
cd /Users/phanquyetthang/mobile-movie-app
npm run typecheck
```
Expected: exit code 0.

```bash
npm run lint
```
Expected: exit code 0.

```bash
grep -rn "useUpdateOrderStore\|useCartItemStore" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```
Expected: empty.

- [ ] **Step 11: Commit**
```bash
cd /Users/phanquyetthang/mobile-movie-app
git add app/order/\[id\].tsx components/dialog/create-order-dialog.tsx components/cart/cart-confirm-order-sheet.tsx lib/store-sync-setup.ts stores/index.ts types/update-order.type.ts types/cart.type.ts
git add -u stores/update-order.store.ts stores/cart-legacy.store.ts
git commit -m "$(cat <<'EOF'
refactor(stores): migrate update-order + cart legacy stores to order-flow

Removes useUpdateOrderStore (3 consumers) and useCartItemStore (1
consumer in store-sync-setup) in favour of the unified order-flow store:
- create-order-dialog + cart-confirm-order-sheet now call
  useOrderFlowStore.clearUpdatingData
- store-sync-setup wires cart/update-order callbacks to the order-flow +
  update-order-flow stores
- order/[id] drops setOrderItems (redundant — update-order screen
  already calls initializeUpdating)

Deletes stores/update-order.store.ts, stores/cart-legacy.store.ts,
IUpdateOrderStore, ICartItemStore.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git status
```

---

## Task 3: NHÓM 3 — Memory-leak hook fixes

**Files:**
- Modify: `hooks/use-notification-listener.ts`
- Modify: `hooks/use-firebase-token.ts`
- Modify: `hooks/use-back-handler-for-exit.ts`

- [ ] **Step 1: Fix `use-notification-listener.ts` — guard double load + unload on unmount**

Replace `/Users/phanquyetthang/mobile-movie-app/hooks/use-notification-listener.ts` entirely with:

```ts
/**
 * useNotificationListener — listen foreground notifications → store + toast + sound.
 *
 * - Subscribes to Firebase onMessage (foreground only)
 * - Parses FCM payload → adds to notification store
 * - Shows toast with title + body
 * - Plays notification sound (volume 0.5)
 *
 * Cleanup:
 * - Single in-flight loadPromise prevents 2× createAsync when notifications
 *   arrive in parallel (otherwise the first Sound instance leaks).
 * - disposeSound() is called in the effect cleanup so the cached Audio.Sound
 *   does not survive logout / unmount.
 */
import { Audio, type AVPlaybackSource } from 'expo-av'
import { useEffect } from 'react'
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging'

import {
  useNotificationStore,
  type NotificationPayload,
} from '@/stores/notification.store'
import { showToastInternal } from '@/providers/toast-provider'

const SOUND_VOLUME = 0.5

// Preloaded sound instance — reuse across notifications, avoid re-loading file
let cachedSound: Audio.Sound | null = null
let loadPromise: Promise<Audio.Sound> | null = null

async function getSound(): Promise<Audio.Sound> {
  if (cachedSound) return cachedSound
  if (!loadPromise) {
    loadPromise = Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/assets/sound/notification.mp3') as AVPlaybackSource,
    )
      .then(({ sound }) => {
        cachedSound = sound
        return sound
      })
      .finally(() => {
        loadPromise = null
      })
  }
  return loadPromise
}

async function disposeSound(): Promise<void> {
  const s = cachedSound
  cachedSound = null
  if (s) {
    await s.unloadAsync().catch(() => {})
  }
}

async function playNotificationSound(): Promise<void> {
  try {
    const sound = await getSound()
    await sound.setPositionAsync(0)
    await sound.setVolumeAsync(SOUND_VOLUME)
    await sound.playAsync()
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Audio] Notification sound playback failed:', e)
    // Unload to keep the native Audio engine clean before we lose the ref
    await disposeSound()
  }
}

function firebaseToPayload(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): NotificationPayload {
  const data = (remoteMessage.data ?? {}) as Record<string, string>
  return {
    notification: {
      title: remoteMessage.notification?.title ?? undefined,
      body: remoteMessage.notification?.body ?? undefined,
    },
    data,
    messageId: remoteMessage.messageId ?? undefined,
  }
}

export function useNotificationListener(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = messaging().onMessage((remoteMessage) => {
      const payload = firebaseToPayload(remoteMessage)

      useNotificationStore
        .getState()
        .addNotification(payload, { markAsRead: false })

      const title = payload.notification?.title || 'Thông báo'
      const body = payload.notification?.body || ''
      if (body) showToastInternal(title, body, 'info')

      playNotificationSound().catch(() => {})
    })

    return () => {
      unsubscribe()
      void disposeSound()
    }
  }, [enabled])
}
```

- [ ] **Step 2: Fix `use-firebase-token.ts` — replace `hasRunRef` with cancellable token**

Replace `/Users/phanquyetthang/mobile-movie-app/hooks/use-firebase-token.ts` entirely with:

```ts
/**
 * useFirebaseToken — request notification permission + get FCM device token.
 *
 * - Only runs on physical device (simulator returns null)
 * - iOS: uses @react-native-firebase/messaging to get FCM token (not raw APNs token)
 * - Android: same Firebase SDK, already worked before
 * - Returns { token, permissionDenied } for upstream consumers
 *
 * Cancellation:
 * - Each effect run owns a CancelToken. Cleanup flips `cancelled = true` so any
 *   pending await boundary bails out cleanly. When `enabled` flips false→true
 *   the next run gets a fresh token and re-fetches (no stale `hasRunRef` lock).
 */
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import messaging from '@react-native-firebase/messaging'

import { useUserStore } from '@/stores'

interface CancelToken {
  cancelled: boolean
}

async function requestPermissionAndGetToken(
  cancelToken: CancelToken,
): Promise<{ token: string | null; permissionDenied: boolean }> {
  // Only real devices can receive push notifications
  if (!Device.isDevice) {
    return { token: null, permissionDenied: false }
  }

  if (Platform.OS === 'android') {
    // Android 13+ (API 33+): must request POST_NOTIFICATIONS at runtime.
    // messaging().requestPermission() does NOT trigger the system dialog on Android.
    const { status } = await Notifications.requestPermissionsAsync()
    if (cancelToken.cancelled) return { token: null, permissionDenied: false }
    if (status !== 'granted') {
      return { token: null, permissionDenied: true }
    }
  } else {
    // iOS: Firebase handles the permission dialog + APNs registration
    const authStatus = await messaging().requestPermission()
    if (cancelToken.cancelled) return { token: null, permissionDenied: false }
    const granted =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    if (!granted) {
      return { token: null, permissionDenied: true }
    }
    try {
      await messaging().registerDeviceForRemoteMessages()
    } catch (e) {
      // APNs registration failure will cause getToken() to fail in the loop below
      // eslint-disable-next-line no-console
      console.error('[FCM] registerDeviceForRemoteMessages failed (iOS):', e)
    }
    if (cancelToken.cancelled) return { token: null, permissionDenied: false }
  }

  // Get FCM token — retry up to 5x with backoff (APNs token may arrive async on iOS)
  let lastError: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    if (cancelToken.cancelled) return { token: null, permissionDenied: false }
    try {
      const fcmToken = await messaging().getToken()
      if (cancelToken.cancelled) return { token: null, permissionDenied: false }
      return { token: fcmToken ?? null, permissionDenied: false }
    } catch (e) {
      lastError = e
      if (attempt < 4) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1)),
        )
        if (cancelToken.cancelled)
          return { token: null, permissionDenied: false }
      }
    }
  }
  // eslint-disable-next-line no-console
  console.error('[FCM] getToken failed after 5 attempts:', lastError)
  return { token: null, permissionDenied: false }
}

export function useFirebaseToken(enabled = true) {
  const [token, setToken] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const storedToken = useUserStore((s) => s.deviceToken)

  useEffect(() => {
    if (!enabled) return

    const cancelToken: CancelToken = { cancelled: false }

    requestPermissionAndGetToken(cancelToken)
      .then(({ token: newToken, permissionDenied: denied }) => {
        if (cancelToken.cancelled) return
        setPermissionDenied(denied)
        if (denied || !newToken) return
        setToken(newToken)
        // NOTE: Don't save to store here — only save AFTER server confirms registration
        // (handled in use-register-device-token.ts)
      })
      .catch((e) => {
        if (cancelToken.cancelled) return
        // eslint-disable-next-line no-console
        console.error('[FCM] requestPermissionAndGetToken rejected:', e)
      })

    return () => {
      cancelToken.cancelled = true
    }
  }, [enabled])

  // Listen for FCM token rotation (e.g. token invalidated while app is open)
  useEffect(() => {
    if (!enabled) return

    const unsubscribe = messaging().onTokenRefresh((newToken: string) => {
      if (!newToken) return
      setToken(newToken)
    })

    return unsubscribe
  }, [enabled])

  // Avoid unused-var lint if useRef was previously expected by callers
  void useRef

  return { token, permissionDenied, storedToken }
}
```

> **Note on `void useRef`:** Remove the trailing `void useRef` and the `useRef` import if lint complains about unused imports. The cleanest version drops the import entirely. After writing the file, run:
> ```bash
> npm run lint -- hooks/use-firebase-token.ts
> ```
> If `useRef` is flagged as unused, edit the file to remove `useRef` from the import on line 9 and delete the `void useRef` line near the end.

- [ ] **Step 3: Fix `use-back-handler-for-exit.ts` — stable deps with refs**

Replace `/Users/phanquyetthang/mobile-movie-app/hooks/use-back-handler-for-exit.ts` entirely with:

```ts
/**
 * Double-back-to-exit cho Android.
 * Khi ở root (tabs), lần back đầu hiện toast, lần thứ 2 trong 2s → exit.
 * Tránh thoát app nhầm trên low-end Android.
 *
 * Effect chỉ subscribe BackHandler đúng một lần (deps: []). t/router thay đổi
 * theo language hoặc navigation — đọc từ refs để tránh re-subscribe.
 */
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler, Platform } from 'react-native'

import { showToast } from '@/utils'

const EXIT_DELAY_MS = 2000

export function useBackHandlerForExit() {
  const router = useRouter()
  const { t: tToast } = useTranslation('toast')

  const lastBackPress = useRef(0)
  const tToastRef = useRef(tToast)
  const routerRef = useRef(router)

  tToastRef.current = tToast
  routerRef.current = router

  useEffect(() => {
    if (Platform.OS !== 'android') return

    const onBackPress = () => {
      if (routerRef.current.canGoBack()) {
        return false // Let default (pop) happen
      }

      const now = Date.now()
      if (now - lastBackPress.current < EXIT_DELAY_MS) {
        lastBackPress.current = 0
        BackHandler.exitApp()
        return true
      }

      lastBackPress.current = now
      showToast(tToastRef.current('toast.pressBackToExit'), 'info')
      return true
    }

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return () => sub.remove()
  }, [])
}
```

- [ ] **Step 4: Verify**
```bash
cd /Users/phanquyetthang/mobile-movie-app
npm run typecheck
```
Expected: exit code 0.

```bash
npm run lint
```
Expected: exit code 0. If `useRef` in `use-firebase-token.ts` is flagged as unused, remove the import + the `void useRef` line and re-run.

- [ ] **Step 5: Commit**
```bash
cd /Users/phanquyetthang/mobile-movie-app
git add hooks/use-notification-listener.ts hooks/use-firebase-token.ts hooks/use-back-handler-for-exit.ts
git commit -m "$(cat <<'EOF'
fix(hooks): plug memory leaks in notification, FCM token, and back-handler

- use-notification-listener: singleton loadPromise prevents 2x createAsync
  when notifications race in foreground; disposeSound() runs on cleanup so
  cachedSound does not survive logout.
- use-firebase-token: replace hasRunRef lock with CancelToken so re-enable
  flips trigger a fresh token fetch; cancel is checked at every await
  boundary instead of leaking pending setTimeout retries.
- use-back-handler-for-exit: deps now [], translation/router read via
  refs so BackHandler does not re-subscribe on every language change.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git status
```

---

## Task 4: NHÓM 4 — Spring config consolidation

**Files:**
- Modify: `constants/motion.ts` — add 6 new presets to `SPRING_CONFIGS`
- Modify: `app/(tabs)/profile/profile-item.tsx:18-25,55,56`
- Modify: `app/(tabs)/profile/transition-config.ts`
- Modify: `components/navigation/animated-tab-bar.tsx:28-33,99`
- Modify: `components/navigation/tab-button.tsx:16-20,27`
- Modify: `lib/shared-element/shared-element-provider.tsx:42-49,128,134,146`
- Modify: `lib/navigation/interactive-transition.ts:35-54,85`

- [ ] **Step 1: Add 6 new presets to `constants/motion.ts`**

Edit `/Users/phanquyetthang/mobile-movie-app/constants/motion.ts` — inside the existing `SPRING_CONFIGS` block, append after the `swipe` entry (line 76), before the closing `} as const` on line 77:

Replace:
```ts
  /**
   * Swipeable row snap — gesture-driven pan snap to open/closed position.
   * Moderate damping keeps the snap feel snappy without jarring overshoot.
   */
  swipe: {
    damping: 25,
    stiffness: 180,
  } as const,
} as const
```
with:
```ts
  /**
   * Swipeable row snap — gesture-driven pan snap to open/closed position.
   * Moderate damping keeps the snap feel snappy without jarring overshoot.
   */
  swipe: {
    damping: 25,
    stiffness: 180,
  } as const,

  /** Profile/list item press release — soft return, no overshoot. */
  pressSoft: {
    damping: 25,
    stiffness: 200,
    mass: 0.5,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  } as const,

  /** Profile parallax snap "brake" — fast settle on gesture release. */
  snapBrake: {
    damping: 24,
    stiffness: 400,
    mass: 0.45,
    overshootClamping: true,
    energyThreshold: 0.1,
  } as const,

  /** Tab bar sliding indicator — snappy, ~100ms settle. */
  tabIndicator: {
    stiffness: 500,
    damping: 32,
    mass: 0.25,
    overshootClamping: true,
  } as const,

  /** Tab button scale/translate active — mild lift, gentle settle. */
  tabButton: {
    stiffness: 180,
    damping: 25,
    mass: 0.6,
  } as const,

  /** Shared element fly transition — bounce nhẹ khi đáp cánh. */
  sharedElement: {
    stiffness: 150,
    damping: 20,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  } as const,

  /** Native stack close gesture spring — underdamped, velocity-aware. */
  navClose: {
    damping: 26,
    stiffness: 190,
    mass: 0.7,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  } as const,
} as const
```

- [ ] **Step 2: Migrate `app/(tabs)/profile/profile-item.tsx`**

Edit `/Users/phanquyetthang/mobile-movie-app/app/(tabs)/profile/profile-item.tsx`:

Replace lines 9-25:
```ts
import { colors } from '@/constants'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

const PRESS_SCALE = 0.96
const SPRING_PRESS_OUT = {
  damping: 25,
  stiffness: 200,
  mass: 0.5,
  overshootClamping: true,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
}
```
with:
```ts
import { colors, SPRING_CONFIGS } from '@/constants'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

const PRESS_SCALE = 0.96
```

Replace lines 55-56:
```ts
          scale.value = withSpring(1, SPRING_PRESS_OUT)
          opacity.value = withSpring(1, SPRING_PRESS_OUT)
```
with:
```ts
          scale.value = withSpring(1, SPRING_CONFIGS.pressSoft)
          opacity.value = withSpring(1, SPRING_CONFIGS.pressSoft)
```

> **Note on `SPRING_CONFIGS` export:** verify `SPRING_CONFIGS` is re-exported from `@/constants`:
> ```bash
> grep -n "SPRING_CONFIGS\|motion" /Users/phanquyetthang/mobile-movie-app/constants/index.ts
> ```
> Expected: a re-export of `./motion`. If missing, edit `constants/index.ts` and append `export * from './motion'`.

- [ ] **Step 3: Migrate `app/(tabs)/profile/transition-config.ts`**

Replace `/Users/phanquyetthang/mobile-movie-app/app/(tabs)/profile/transition-config.ts` entirely with:

```ts
import { SPRING_CONFIGS } from '@/constants'

export const SNAP_BRAKE_CONFIG = SPRING_CONFIGS.snapBrake
```

(Consumers still import `SNAP_BRAKE_CONFIG` by name — the alias keeps them working.)

- [ ] **Step 4: Migrate `components/navigation/animated-tab-bar.tsx`**

Edit `/Users/phanquyetthang/mobile-movie-app/components/navigation/animated-tab-bar.tsx`:

Add to the imports block (after the existing `import Animated, ...` block on line 12). Read the existing import block first to find the exact location, then add:
```ts
import { SPRING_CONFIGS } from '@/constants'
```

Replace lines 22-33:
```ts
// Spring config nhanh — settle trong ~100-120ms.
// Trước đây stiffness 280/damping 26/mass 0.4 settle ~200-300ms, lag sau
// content swap (Tabs animation: 'none' → 16-33ms). Khi user tap rapid, indicator
// chase content với visible lag, trông như tab bar và content desync.
// Spring nhanh hơn + overshootClamping giữ cảm giác đàn hồi mà không lag.
const INDICATOR_SPRING = {
  stiffness: 500,
  damping: 32,
  mass: 0.25,
  overshootClamping: true,
}
```
with:
```ts
// Spring config nhanh — settle trong ~100-120ms (SPRING_CONFIGS.tabIndicator).
```

Replace line 99:
```ts
      indicatorX.value = withSpring(targetX, INDICATOR_SPRING)
```
with:
```ts
      indicatorX.value = withSpring(targetX, SPRING_CONFIGS.tabIndicator)
```

- [ ] **Step 5: Migrate `components/navigation/tab-button.tsx`**

Edit `/Users/phanquyetthang/mobile-movie-app/components/navigation/tab-button.tsx`:

Add to imports (after the existing react-native-reanimated import on line 7):
```ts
import { SPRING_CONFIGS } from '@/constants'
```

Replace lines 16-20:
```ts
const SPRING_CONFIG = {
  stiffness: 180,
  damping: 25,
  mass: 0.6,
}
```
with: (delete the block entirely — no replacement)

Replace line 27 (was at line 27 before deletion; will shift up):
```ts
    animValue.value = withSpring(active ? 1 : 0, SPRING_CONFIG)
```
with:
```ts
    animValue.value = withSpring(active ? 1 : 0, SPRING_CONFIGS.tabButton)
```

- [ ] **Step 6: Migrate `lib/shared-element/shared-element-provider.tsx`**

Edit `/Users/phanquyetthang/mobile-movie-app/lib/shared-element/shared-element-provider.tsx`:

Add to imports (after `import Animated, ...` block ending line 27):
```ts
import { SPRING_CONFIGS } from '@/constants'
```

Replace lines 38-49:
```ts
/**
 * Spring physics cho shared element fly animation.
 * stiffness 150 + damping 20 + mass 1 → bounce nhẹ khi "đáp cánh".
 */
const SHARED_SPRING = {
  stiffness: 150,
  damping: 20,
  mass: 1,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
} as const
```
with: (delete the block — replaced by direct usage of `SPRING_CONFIGS.sharedElement`)

Replace `SHARED_SPRING` at lines 128, 134, 146 (3 occurrences):
```bash
cd /Users/phanquyetthang/mobile-movie-app
grep -n "SHARED_SPRING" lib/shared-element/shared-element-provider.tsx
```
Expected: 3 hits at the usage sites. For each, edit:
- `withSpring(1, SHARED_SPRING)` → `withSpring(1, SPRING_CONFIGS.sharedElement)`
- `withSpring(1, SHARED_SPRING, (finished) => {` → `withSpring(1, SPRING_CONFIGS.sharedElement, (finished) => {`
- `withSpring(0, SHARED_SPRING, (finished) => {` → `withSpring(0, SPRING_CONFIGS.sharedElement, (finished) => {`

Use `Edit` with `replace_all: true` and `old_string: "SHARED_SPRING"`, `new_string: "SPRING_CONFIGS.sharedElement"`.

- [ ] **Step 7: Migrate `lib/navigation/interactive-transition.ts`**

Edit `/Users/phanquyetthang/mobile-movie-app/lib/navigation/interactive-transition.ts`:

Add to imports near the top (after the existing `import { Easing } from 'react-native'` on line 16):
```ts
import { SPRING_CONFIGS, MOTION } from '@/constants'
```

Replace lines 29-54:
```ts
/**
 * Close spring — Underdamped, mềm hơn.
 *
 * ζ ≈ 0.82, ω₀ ≈ 12.9 → 95% settle ~280ms, full settle ~350ms.
 * Mass cao hơn → phản ứng "nặng" hơn với velocity, deceleration rõ hơn.
 */
export const CLOSE_SPRING = {
  damping: 26, // Tăng damping để triệt tiêu dao động nhanh hơn
  stiffness: 190, // Tăng stiffness để bám theo tay tốt hơn
  mass: 0.7, // Giảm mass để nhẹ hơn
  overshootClamping: true, // Telegram thường không cho nảy (bounce) khi đóng trang
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
}

/**
 * Reanimated parallax spring — UI thread.
 * Slightly underdamped for organic depth feel.
 */
export const REANIMATED_PARALLAX_SPRING = {
  damping: 18,
  stiffness: 220,
  mass: 0.9,
  overshootClamping: false,
  energyThreshold: 1e-6,
} as const
```
with:
```ts
/**
 * Close spring — Underdamped, mềm hơn (alias of SPRING_CONFIGS.navClose).
 */
export const CLOSE_SPRING = SPRING_CONFIGS.navClose

/**
 * Reanimated parallax spring — UI thread (alias of MOTION.parallaxSpring).
 */
export const REANIMATED_PARALLAX_SPRING = MOTION.parallaxSpring
```

> **Note:** Line 85 already references `CLOSE_SPRING` indirectly via `CLOSE_SPEC.config = CLOSE_SPRING`. The alias preserves the export contract, so consumers of `CLOSE_SPEC` need no changes.

- [ ] **Step 8: Verify all old spring local names are gone**
```bash
cd /Users/phanquyetthang/mobile-movie-app
grep -rn "SPRING_PRESS_OUT\|SNAP_BRAKE_CONFIG\b" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v "transition-config.ts"
grep -rn "INDICATOR_SPRING\|SHARED_SPRING\b" --include="*.ts" --include="*.tsx" . | grep -v node_modules
grep -n "^const SPRING_CONFIG\b" /Users/phanquyetthang/mobile-movie-app/components/navigation/tab-button.tsx
```
Expected:
- First grep: empty (or only the alias in `transition-config.ts`).
- Second grep: empty.
- Third grep: empty.

- [ ] **Step 9: Typecheck + lint**
```bash
cd /Users/phanquyetthang/mobile-movie-app
npm run typecheck
```
Expected: exit code 0.
```bash
npm run lint
```
Expected: exit code 0.

- [ ] **Step 10: Commit**
```bash
cd /Users/phanquyetthang/mobile-movie-app
git add constants/motion.ts app/\(tabs\)/profile/profile-item.tsx app/\(tabs\)/profile/transition-config.ts components/navigation/animated-tab-bar.tsx components/navigation/tab-button.tsx lib/shared-element/shared-element-provider.tsx lib/navigation/interactive-transition.ts
git commit -m "$(cat <<'EOF'
refactor(motion): consolidate spring configs into SPRING_CONFIGS

Adds pressSoft, snapBrake, tabIndicator, tabButton, sharedElement, and
navClose presets to constants/motion.ts. Migrates seven callsites
(profile-item, profile transition-config, animated-tab-bar, tab-button,
shared-element-provider, interactive-transition) to use the single
source of truth. CLOSE_SPRING + REANIMATED_PARALLAX_SPRING become
aliases so downstream specs continue to compile.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git status
```

---

## Task 5: NHÓM 5 — Performance hotspots

**Files:**
- Modify: `app/profile/history.tsx:475-489`
- Create: `hooks/use-update-order-totals.ts`
- Modify: `hooks/index.ts` — re-export the new hook
- Modify: `app/update-order/components/update-order-content-native.tsx`
- Modify: `app/update-order/components/update-order-footer.tsx`
- Modify: `app/update-order/components/confirm-update-order-dialog.tsx`
- Modify: `app/update-order/components/voucher-sheet-in-update-order/index.tsx`

- [ ] **Step 1: Cache `orderDisplayMap` in `app/profile/history.tsx` to avoid re-compute on every FCM refetch**

Edit `/Users/phanquyetthang/mobile-movie-app/app/profile/history.tsx`:

Replace lines 474-489:
```ts
  // Pre-compute display data once when orders change — O(1) lookup in renderItem
  const orderDisplayMap = useMemo(() => {
    const map = new Map<string, OrderDisplayData>()
    for (const order of orders) {
      const items = order.orderItems || []
      const voucher = order.voucher || null
      const { displayItems, cartTotals } = calculateOrderDisplayAndTotals(
        items,
        voucher,
      )
      const diMap = new Map<string, (typeof displayItems)[number]>()
      for (const di of displayItems) diMap.set(di.slug, di)
      map.set(order.slug, { displayItemMap: diMap, cartTotals })
    }
    return map
  }, [orders])
```
with:
```ts
  // Pre-compute display data once when orders change — O(1) lookup in renderItem.
  // Cache keyed by (slug, updatedAt, voucher.slug) so FCM-triggered refetches do
  // not redo work for unchanged orders. Capped at 50 entries (LRU-ish).
  const orderDisplayCacheRef = useRef(new Map<string, OrderDisplayData>())
  const orderDisplayMap = useMemo(() => {
    const next = new Map<string, OrderDisplayData>()
    for (const order of orders) {
      const items = order.orderItems || []
      const voucher = order.voucher || null
      const cacheKey = `${order.slug}:${order.updatedAt}:${voucher?.slug ?? ''}`
      const cached = orderDisplayCacheRef.current.get(cacheKey)
      if (cached) {
        next.set(order.slug, cached)
        continue
      }
      const { displayItems, cartTotals } = calculateOrderDisplayAndTotals(
        items,
        voucher,
      )
      const diMap = new Map<string, (typeof displayItems)[number]>()
      for (const di of displayItems) diMap.set(di.slug, di)
      const data: OrderDisplayData = { displayItemMap: diMap, cartTotals }
      next.set(order.slug, data)
      orderDisplayCacheRef.current.set(cacheKey, data)
    }
    if (orderDisplayCacheRef.current.size > 50) {
      const keys = Array.from(orderDisplayCacheRef.current.keys())
      keys
        .slice(0, keys.length - 50)
        .forEach((k) => orderDisplayCacheRef.current.delete(k))
    }
    return next
  }, [orders])
```

> **Note:** `useRef` is already imported in `history.tsx` (line 18). `OrderDisplayData` is already imported as `type` on line 54. `IOrder` (which has `updatedAt`) is imported on line 48 — verify with:
> ```bash
> grep -n "updatedAt" /Users/phanquyetthang/mobile-movie-app/types/order.type.ts | head -3
> ```
> If `updatedAt` is not on `IOrder`, change the cache key to `${order.slug}:${order.status}:${(order.orderItems?.length ?? 0)}:${voucher?.slug ?? ''}` instead.

- [ ] **Step 2: Create `hooks/use-update-order-totals.ts` to dedupe the 4× duplicate compute**

Create a new file `/Users/phanquyetthang/mobile-movie-app/hooks/use-update-order-totals.ts` with:

```ts
/**
 * useUpdateOrderTotals — single source of truth cho display items + totals của
 * update-order draft.
 *
 * 4 component (content-native, footer, confirm-dialog, voucher-sheet) trước đây
 * tự gọi calculateOrderDisplayAndTotals(transformOrderItemToOrderDetail(...)),
 * mỗi cái re-run mỗi lần draft đổi. Hook này gom lại 1 memo theo `draft` ref
 * — vẫn rẻ về cache miss (Zustand giữ stable reference khi không đổi).
 */
import { useMemo } from 'react'

import { useOrderFlowStore } from '@/stores'
import {
  calculateOrderDisplayAndTotals,
  transformOrderItemToOrderDetail,
} from '@/utils'

export function useUpdateOrderTotals() {
  const draft = useOrderFlowStore((s) => s.updatingData?.updateDraft)

  return useMemo(() => {
    if (!draft) {
      return {
        displayItems: [] as ReturnType<
          typeof calculateOrderDisplayAndTotals
        >['displayItems'],
        cartTotals: null as ReturnType<
          typeof calculateOrderDisplayAndTotals
        >['cartTotals'] | null,
        transformedItems: [] as ReturnType<
          typeof transformOrderItemToOrderDetail
        >,
      }
    }
    const transformedItems = transformOrderItemToOrderDetail(
      draft.orderItems ?? [],
    )
    const { displayItems, cartTotals } = calculateOrderDisplayAndTotals(
      transformedItems,
      draft.voucher ?? null,
    )
    return { displayItems, cartTotals, transformedItems }
  }, [draft])
}
```

- [ ] **Step 3: Re-export the hook from `hooks/index.ts`**

```bash
grep -n "use-update-order\|use-cart-totals" /Users/phanquyetthang/mobile-movie-app/hooks/index.ts
```
Read `/Users/phanquyetthang/mobile-movie-app/hooks/index.ts` and append:
```ts
export * from './use-update-order-totals'
```

If `hooks/index.ts` uses an alphabetical convention, insert it in the right position. The wildcard re-export is what matters.

- [ ] **Step 4: Migrate `update-order-content-native.tsx`**

Edit `/Users/phanquyetthang/mobile-movie-app/app/update-order/components/update-order-content-native.tsx`:

In the imports block (around line 14-22) where `calculateOrderDisplayAndTotals` and `transformOrderItemToOrderDetail` are imported from `@/utils`, remove those two named imports if no other consumer in the file still needs them.

```bash
grep -n "calculateOrderDisplayAndTotals\|transformOrderItemToOrderDetail" /Users/phanquyetthang/mobile-movie-app/app/update-order/components/update-order-content-native.tsx
```

The only usage is in the `useMemo` we are about to delete + a `ReturnType<typeof calculateOrderDisplayAndTotals>['displayItems'][number]` annotation on line 74 of the existing file. Keep `calculateOrderDisplayAndTotals` imported (still needed for the type annotation) and drop `transformOrderItemToOrderDetail` from the named imports.

Add to imports:
```ts
import { useUpdateOrderTotals } from '@/hooks'
```

Replace lines 318-336 (the `voucher`, `orderItems`, and two `useMemo` blocks):
```ts
  const voucher = updatingData?.updateDraft?.voucher ?? null
  const orderItems = useMemo(
    () => updatingData?.updateDraft?.orderItems ?? [],
    [updatingData],
  )

  const { displayItems } = useMemo(
    () =>
      calculateOrderDisplayAndTotals(
        transformOrderItemToOrderDetail(orderItems),
        voucher,
      ),
    [orderItems, voucher],
  )
  const displayItemMap = useMemo(() => {
    const m = new Map<string, (typeof displayItems)[number]>()
    for (const di of displayItems) m.set(di.slug, di)
    return m
  }, [displayItems])
```
with:
```ts
  const voucher = updatingData?.updateDraft?.voucher ?? null
  const orderItems = useMemo(
    () => updatingData?.updateDraft?.orderItems ?? [],
    [updatingData],
  )

  const { displayItems } = useUpdateOrderTotals()
  const displayItemMap = useMemo(() => {
    const m = new Map<string, (typeof displayItems)[number]>()
    for (const di of displayItems) m.set(di.slug, di)
    return m
  }, [displayItems])
```

- [ ] **Step 5: Migrate `update-order-footer.tsx`**

Edit `/Users/phanquyetthang/mobile-movie-app/app/update-order/components/update-order-footer.tsx`:

Replace lines 15-20:
```ts
import {
  calculateOrderDisplayAndTotals,
  parseKm,
  showErrorToastMessage,
  transformOrderItemToOrderDetail,
} from '@/utils'
```
with:
```ts
import { parseKm, showErrorToastMessage } from '@/utils'
import { useUpdateOrderTotals } from '@/hooks'
```

Replace lines 95-102:
```ts
  const { cartTotals } = useMemo(
    () =>
      calculateOrderDisplayAndTotals(
        transformOrderItemToOrderDetail(orderItems),
        voucher,
      ),
    [orderItems, voucher],
  )
```
with:
```ts
  const { cartTotals } = useUpdateOrderTotals()
```

Then verify `orderItems` and `voucher` are still used elsewhere in the file:
```bash
grep -n "\borderItems\b\|\bvoucher\b" /Users/phanquyetthang/mobile-movie-app/app/update-order/components/update-order-footer.tsx
```
They remain used (e.g. `cartItemQuantity` derived from `orderItems`, voucher gates in the useEffect at lines 116-122). Keep their declarations on lines 57-58.

- [ ] **Step 6: Migrate `confirm-update-order-dialog.tsx`**

Edit `/Users/phanquyetthang/mobile-movie-app/app/update-order/components/confirm-update-order-dialog.tsx`:

Replace lines 34-41:
```ts
import {
  calculateOrderDisplayAndTotals,
  computeOrderApiDiff,
  isTempOrderItem,
  showErrorToastMessage,
  showToast,
  transformOrderItemToOrderDetail,
} from '@/utils'
```
with:
```ts
import {
  computeOrderApiDiff,
  isTempOrderItem,
  showErrorToastMessage,
  showToast,
} from '@/utils'
import { useUpdateOrderTotals } from '@/hooks'
```

Replace lines 85-92:
```ts
  const { displayItems, cartTotals } = useMemo(
    () =>
      calculateOrderDisplayAndTotals(
        transformOrderItemToOrderDetail(orderItems),
        voucher,
      ),
    [orderItems, voucher],
  )
```
with:
```ts
  const { displayItems, cartTotals } = useUpdateOrderTotals()
```

After this edit, verify `orderItems`, `voucher`, and the `useMemo` import remain used downstream. `useMemo` is still used at line 80 for `orderItems`. `voucher` is used on line 81. Both stay declared but the redundant compute is gone.

- [ ] **Step 7: Migrate `voucher-sheet-in-update-order/index.tsx`**

Edit `/Users/phanquyetthang/mobile-movie-app/app/update-order/components/voucher-sheet-in-update-order/index.tsx`:

Replace lines 14-18:
```ts
import {
  calculateOrderDisplayAndTotals,
  showToast,
  transformOrderItemToOrderDetail,
} from '@/utils'
```
with:
```ts
import { showToast } from '@/utils'
import { useUpdateOrderTotals } from '@/hooks'
```

Replace lines 61-75:
```ts
    const orderItems = useMemo(
      () => updatingData?.updateDraft?.orderItems ?? [],
      [updatingData],
    )
    const currentVoucher = updatingData?.updateDraft?.voucher ?? null

    const transformedItems = useMemo(
      () => transformOrderItemToOrderDetail(orderItems),
      [orderItems],
    )
    const { cartTotals } = useMemo(
      () => calculateOrderDisplayAndTotals(transformedItems, currentVoucher),
      [transformedItems, currentVoucher],
    )
    const subTotal = cartTotals?.subTotalBeforeDiscount ?? 0
```
with:
```ts
    const orderItems = useMemo(
      () => updatingData?.updateDraft?.orderItems ?? [],
      [updatingData],
    )
    const currentVoucher = updatingData?.updateDraft?.voucher ?? null

    const { cartTotals, transformedItems } = useUpdateOrderTotals()
    const subTotal = cartTotals?.subTotalBeforeDiscount ?? 0
```

Then verify `orderItems`, `currentVoucher`, and `transformedItems` are still referenced downstream in the file:
```bash
grep -n "\borderItems\b\|\bcurrentVoucher\b\|\btransformedItems\b" /Users/phanquyetthang/mobile-movie-app/app/update-order/components/voucher-sheet-in-update-order/index.tsx
```
Each should still appear in later usage (e.g. voucher validation, list rendering). If not, drop the unused locals later — typecheck + lint catches it.

- [ ] **Step 8: Verify**
```bash
cd /Users/phanquyetthang/mobile-movie-app
npm run typecheck
```
Expected: exit code 0.
```bash
npm run lint
```
Expected: exit code 0.

- [ ] **Step 9: Commit**
```bash
cd /Users/phanquyetthang/mobile-movie-app
git add app/profile/history.tsx hooks/use-update-order-totals.ts hooks/index.ts app/update-order/components/update-order-content-native.tsx app/update-order/components/update-order-footer.tsx app/update-order/components/confirm-update-order-dialog.tsx app/update-order/components/voucher-sheet-in-update-order/index.tsx
git commit -m "$(cat <<'EOF'
perf(orders): cache history display totals + dedupe update-order compute

- profile/history: cache orderDisplayMap by (slug, updatedAt, voucher)
  with a 50-entry cap so FCM-triggered refetches reuse work.
- new hooks/use-update-order-totals: single memo for draft display
  items + totals; replaces four duplicate computations across
  update-order-content-native, update-order-footer,
  confirm-update-order-dialog, and voucher-sheet-in-update-order.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git status
```

---

## Final verification

- [ ] **Step 1: Full project check**
```bash
cd /Users/phanquyetthang/mobile-movie-app
npm run check
```
Expected: typecheck + lint both pass.

- [ ] **Step 2: Circular dep sanity**
```bash
npm run check-circular
```
Expected: no new cycles introduced (compare against pre-plan baseline).

- [ ] **Step 3: Git log review**
```bash
git log --oneline -n 6
```
Expected: 5 new commits in this order (newest first):
1. `perf(orders): cache history display totals + dedupe update-order compute`
2. `refactor(motion): consolidate spring configs into SPRING_CONFIGS`
3. `fix(hooks): plug memory leaks in notification, FCM token, and back-handler`
4. `refactor(stores): migrate update-order + cart legacy stores to order-flow`
5. `chore(stores): delete dead stores, slices, and order-comparison util`
