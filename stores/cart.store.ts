/**
 * Cart Store — Clean facade over order-flow.store's ordering phase.
 *
 * Provides perf-cart-style atomic selectors + static action accessors.
 * Zero data duplication: all reads/writes delegate to order-flow.store.
 *
 * Future: when order-flow is split, only this file's internals change —
 * all consumers keep the same API.
 */
import type {
  IOrderItem,
  IProductVariant,
  ITable,
  IUserInfo,
  IVoucher,
  OrderTypeEnum,
} from '@/types'
import { useShallow } from 'zustand/react/shallow'

import { calcItemVoucherDiscount, toDisplayItem } from '@/components/cart/cart-display-item'
import { useOrderFlowStore } from './order-flow.store'

// ─── Types ───────────────────────────────────────────────────────────────────

const EMPTY_ITEMS: IOrderItem[] = []

// ─── Atomic Selectors (subscribe to primitives — no cascading re-renders) ───

/** Cart items array — re-renders only when orderItems ref changes */
export const useCartItems = () =>
  useOrderFlowStore(
    (s) => s.orderingData?.orderItems ?? EMPTY_ITEMS,
  )

/** Total quantity — primitive number, zero re-render on unrelated changes */
export const useCartItemCount = () =>
  useOrderFlowStore((s) => s.orderItemTotalQuantity ?? 0)

/** Computed total price — inline loop, returns primitive */
export const useCartTotal = () =>
  useOrderFlowStore((s) => {
    const items = s.orderingData?.orderItems
    if (!items || items.length === 0) return 0
    let total = 0
    for (const item of items) {
      total += (item.originalPrice ?? 0) * (item.quantity || 0)
    }
    return total
  })

/** Min order value (subtotal after promotion) — for voucher validation */
export const useCartMinOrderValue = () =>
  useOrderFlowStore((s) => s.minOrderValue ?? 0)

/** Current voucher — null when no voucher applied */
export const useCartVoucher = () =>
  useOrderFlowStore((s) => s.orderingData?.voucher ?? null)

/** Per-item voucher discount — primitive number, re-renders only when THIS item's discount changes.
 *  CartItemRow subscribes directly — removes voucherDiscountMap from renderItem deps entirely. */
export const useCartItemVoucherDiscount = (cartKey: string): number =>
  useOrderFlowStore((s) => {
    const voucher = s.orderingData?.voucher
    if (!voucher) return 0
    const item = s.orderingData?.orderItems?.find((i) => i.id === cartKey)
    if (!item) return 0
    return calcItemVoucherDiscount(toDisplayItem(item), voucher)
  })

/** Voucher discount total — primitive number, re-renders only when discount changes.
 *  Replaces useCartItems() + voucherDiscount useMemo in CartFooter to avoid
 *  re-rendering the footer on every note/quantity change when discount is unchanged. */
export const useCartVoucherDiscount = () =>
  useOrderFlowStore((s) => {
    const items = s.orderingData?.orderItems
    const voucher = s.orderingData?.voucher
    if (!voucher || !items || items.length === 0) return 0
    let discount = 0
    for (const item of items) {
      discount += calcItemVoucherDiscount(toDisplayItem(item), voucher) * (item.quantity || 0)
    }
    return discount
  })

/** Hydration flag — true after persisted state is restored */
export const useCartIsHydrated = () =>
  useOrderFlowStore((s) => s.isHydrated)

/** Order type — AT_TABLE | TAKE_OUT | DELIVERY */
export const useCartOrderType = () =>
  useOrderFlowStore((s) => s.orderingData?.type)

/** Table info — shallow compare prevents re-render when items change */
export const useCartTable = () =>
  useOrderFlowStore(
    useShallow((s) => ({
      table: s.orderingData?.table ?? '',
      tableName: s.orderingData?.tableName ?? '',
    })),
  )

/** Owner info — shallow compare */
export const useCartOwner = () =>
  useOrderFlowStore(
    useShallow((s) => ({
      owner: s.orderingData?.owner ?? '',
      ownerFullName: s.orderingData?.ownerFullName ?? '',
      ownerPhoneNumber: s.orderingData?.ownerPhoneNumber ?? '',
    })),
  )

/** Delivery info — shallow compare */
export const useCartDelivery = () =>
  useOrderFlowStore(
    useShallow((s) => ({
      address: s.orderingData?.deliveryAddress ?? '',
      distance: s.orderingData?.deliveryDistance ?? 0,
      duration: s.orderingData?.deliveryDuration ?? 0,
      phone: s.orderingData?.deliveryPhone ?? '',
      lat: s.orderingData?.deliveryLat,
      lng: s.orderingData?.deliveryLng,
      placeId: s.orderingData?.deliveryPlaceId ?? '',
    })),
  )

/** Per-item selector — only re-renders when this specific item changes */
export const useCartItem = (itemId: string) =>
  useOrderFlowStore((s) =>
    s.orderingData?.orderItems?.find((i) => i.id === itemId),
  )

/** Per-item quantity — most atomic, returns primitive */
export const useCartItemQuantity = (itemId: string): number =>
  useOrderFlowStore(
    (s) =>
      s.orderingData?.orderItems?.find((i) => i.id === itemId)?.quantity ?? 0,
  )

/** Description / order note */
export const useCartDescription = () =>
  useOrderFlowStore((s) => s.orderingData?.description ?? '')

const EMPTY_SLUGS: string[] = []

/** Cart product slugs — stable ref via useShallow, only changes when products
 *  added/removed (NOT on qty/note mutations). Used for voucher validation +
 *  eligibility checks where quantity/note changes are irrelevant. */
export const useCartProductSlugs = () =>
  useOrderFlowStore(
    useShallow((s) => {
      const items = s.orderingData?.orderItems
      if (!items || items.length === 0) return EMPTY_SLUGS
      const slugs: string[] = []
      for (const i of items) {
        const slug = i.productSlug || i.slug || ''
        if (slug) slugs.push(slug)
      }
      return slugs
    }),
  )

// ─── Static Action Accessors (not hooks — no re-render on call) ─────────────
//
// Usage: cartActions.addItem(item) — anywhere, no hook rules.
// These are static getState() calls, safe outside React components.

const getStore = () => useOrderFlowStore.getState()

export const cartActions = {
  // ── Item management ──
  addItem: (item: IOrderItem) => getStore().addOrderingItem(item),
  removeItem: (itemId: string) => getStore().removeOrderingItem(itemId),
  updateQuantity: (itemId: string, quantity: number) =>
    getStore().updateOrderingItemQuantity(itemId, quantity),
  updateVariant: (itemId: string, variant: IProductVariant) =>
    getStore().updateOrderingItemVariant(itemId, variant),
  addNote: (itemId: string, note: string) =>
    getStore().addOrderingNote(itemId, note),

  // ── Voucher ──
  setVoucher: (voucher: IVoucher | null) =>
    getStore().setOrderingVoucher(voucher),
  removeVoucher: () => getStore().removeOrderingVoucher(),

  // ── Customer ──
  setCustomer: (customer: IUserInfo) =>
    getStore().updateOrderingCustomer(customer),
  removeCustomer: () => getStore().removeOrderingCustomer(),

  // ── Order type & table ──
  setType: (type: OrderTypeEnum) => getStore().setOrderingType(type),
  setTable: (table: ITable) => getStore().setOrderingTable(table),
  removeTable: () => getStore().removeOrderingTable(),

  // ── Pickup ──
  addPickupTime: (time: number) => getStore().addPickupTime(time),
  removePickupTime: () => getStore().removePickupTime(),

  // ── Delivery ──
  setDeliveryAddress: (address: string) =>
    getStore().setDeliveryAddress(address),
  setDeliveryDistanceDuration: (distance: number, duration: number) =>
    getStore().setDeliveryDistanceDuration(distance, duration),
  setDeliveryCoords: (lat: number, lng: number, placeId?: string) =>
    getStore().setDeliveryCoords(lat, lng, placeId),
  setDeliveryPhone: (phone: string) => getStore().setDeliveryPhone(phone),
  clearDeliveryInfo: () => getStore().clearDeliveryInfo(),

  // ── Metadata ──
  setDescription: (description: string) =>
    getStore().setOrderingDescription(description),
  setApprovalBy: (approvalBy: string) =>
    getStore().setOrderingApprovalBy(approvalBy),

  // ── Lifecycle ──
  initialize: () => getStore().initializeOrdering(),
  clear: () => getStore().clearCart(),
  clearOrderingData: () => getStore().clearOrderingData(),
} as const
