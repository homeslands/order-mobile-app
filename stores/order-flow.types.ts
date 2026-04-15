/**
 * Types and pure helper functions for order-flow.store.
 * Extracted to a separate file so slices can import without circular deps.
 */
import { PaymentMethod } from '@/constants'
import {
  ICartItem,
  IOrder,
  IOrderItem,
  IOrderPayment,
  IOrderToUpdate,
  IProductVariant,
  ITable,
  IUserInfo,
  IVoucher,
  OrderTypeEnum,
} from '@/types'
import dayjs from 'dayjs'

import type { IPaymentData } from './payment-flow.store'
import type { IUpdatingData } from './update-order-flow.store'

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum OrderFlowStep {
  ORDERING = 'ordering',
  PAYMENT = 'payment',
  UPDATING = 'updating',
}

// ─── Data Interfaces ─────────────────────────────────────────────────────────

export interface IOrderingData {
  id: string
  slug: string
  orderItems: IOrderItem[]
  owner: string
  ownerFullName: string
  ownerPhoneNumber: string
  ownerRole?: string
  type: OrderTypeEnum
  timeLeftTakeOut?: number
  table?: string
  tableName?: string
  voucher: IVoucher | null
  description?: string
  approvalBy: string
  paymentMethod?: string
  payment?: IOrderPayment
  // Delivery info
  deliveryAddress?: string
  deliveryDistance?: number
  deliveryDuration?: number
  deliveryPhone?: string
  deliveryLat?: number
  deliveryLng?: number
  deliveryPlaceId?: string
}

// ─── Store Interface ──────────────────────────────────────────────────────────

export interface IOrderFlowStore {
  currentStep: OrderFlowStep
  isHydrated: boolean
  lastModified: number
  orderItemTotalQuantity: number
  minOrderValue: number

  orderingData: IOrderingData | null
  paymentData: IPaymentData | null
  updatingData: IUpdatingData | null

  setCurrentStep: (step: OrderFlowStep) => void
  initializeOrdering: () => void
  setOrderingData: (data: IOrderingData) => void

  // Items
  addOrderingItem: (item: IOrderItem) => void
  addOrderingProductVariant: (id: string) => void
  updateOrderingItemVariant: (itemId: string, variant: IProductVariant) => void
  updateOrderingItemQuantity: (itemId: string, quantity: number) => void
  removeOrderingItem: (itemId: string) => void
  addPickupTime: (time: number) => void
  removePickupTime: () => void
  addOrderingNote: (itemId: string, note: string) => void
  clearOrderingData: () => void

  // Customer / order meta
  updateOrderingCustomer: (customer: IUserInfo) => void
  removeOrderingCustomer: () => void
  setOrderingTable: (table: ITable) => void
  removeOrderingTable: () => void
  setOrderingVoucher: (voucher: IVoucher | null) => void
  removeOrderingVoucher: () => void
  setOrderingType: (type: OrderTypeEnum) => void
  setOrderingDescription: (description: string) => void
  setOrderingApprovalBy: (approvalBy: string) => void

  // Delivery
  setDeliveryAddress: (address: string) => void
  setDeliveryDistanceDuration: (distance: number, duration: number) => void
  setDeliveryCoords: (lat: number, lng: number, placeId?: string) => void
  setDeliveryPlaceId: (placeId: string) => void
  setDeliveryPhone: (phone: string) => void
  clearDeliveryInfo: () => void

  // Payment (delegated)
  initializePayment: (orderSlug: string, paymentMethod: PaymentMethod) => void
  setPaymentData: (data: Partial<IPaymentData>) => void
  updatePaymentMethod: (method: PaymentMethod, transactionId?: string) => void
  updateQrCode: (qrCode: string) => void
  setOrderFromAPI: (order: IOrder) => void
  setPaymentSlug: (slug: string) => void
  clearPaymentData: () => void

  // Updating (delegated)
  initializeUpdating: (originalOrder: IOrder) => void
  setUpdateDraft: (draft: IOrderToUpdate) => void
  updateDraftItem: (itemId: string, changes: Partial<IOrderItem>) => void
  updateDraftItemQuantity: (itemId: string, quantity: number) => void
  addDraftPickupTime: (time: number) => void
  removeDraftPickupTime: () => void
  addDraftItem: (item: IOrderItem) => void
  removeDraftItem: (itemId: string) => void
  addDraftNote: (itemId: string, note: string) => void
  updateDraftCustomer: (customer: IUserInfo) => void
  removeDraftCustomer: () => void
  setDraftTable: (table: ITable) => void
  removeDraftTable: () => void
  setDraftVoucher: (voucher: IVoucher | null) => void
  removeDraftVoucher: () => void
  setDraftType: (type: OrderTypeEnum) => void
  setDraftDescription: (description: string) => void
  setDraftApprovalBy: (approvalBy: string) => void
  setDraftPaymentMethod: (method: string) => void
  resetDraftToOriginal: () => void
  setDraftDeliveryAddress: (address: string) => void
  setDraftDeliveryDistanceDuration: (distance: number, duration: number) => void
  setDraftDeliveryCoords: (lat: number, lng: number, placeId?: string) => void
  setDraftDeliveryPlaceId: (placeId: string) => void
  setDraftDeliveryPhone: (phone: string) => void
  clearDraftDeliveryInfo: () => void
  clearUpdatingData: () => void

  // Transitions
  transitionToPayment: (orderSlug: string) => void
  transitionToUpdating: (originalOrder: IOrder) => void
  transitionBackToOrdering: () => void

  // Utilities
  clearAllData: () => void
  getActiveData: () => IOrderingData | IPaymentData | IUpdatingData | null

  // Compatibility
  getCartItems: () => IOrderingData | null
  getCartItemCount: () => number
  getOrderItems: () => IUpdatingData | null
  clearCart: () => void
  clearStore: () => void
  addCartItem: (item: ICartItem) => void
  updateCartItemQuantity: (id: string, quantity: number) => void
  addNote: (id: string, note: string) => void
  addCustomerInfo: (owner: IUserInfo) => void
  removeCustomerInfo: () => void
  addTable: (table: ITable) => void
  removeTable: () => void
  addVoucher: (voucher: IVoucher) => void
  removeVoucher: () => void
  addApprovalBy: (approvalBy: string) => void
  addOrderType: (orderType: OrderTypeEnum) => void
  addOrderNote: (note: string) => void
  setPaymentMethod: (method: PaymentMethod | string, transactionId?: string) => void
  setQrCode: (qrCode: string) => void
  setOrderSlug: (slug: string) => void
  removeCartItem: (itemId: string) => void
}

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

export const generateOrderId = () =>
  `order_${dayjs().valueOf()}_${Math.random().toString(36).substr(2, 9)}`

export const generateOrderItemId = () =>
  `item_${dayjs().valueOf()}_${Math.random().toString(36).substr(2, 9)}`

/** Tong quantity — dung cho selector, tranh reduce trong component */
export const calcOrderItemTotalQuantity = (
  items: IOrderItem[] | undefined,
): number => items?.reduce((t, i) => t + (i.quantity || 0), 0) ?? 0

/** Tong tien truoc voucher (cho minOrderValue) */
export const calcMinOrderValue = (items: IOrderItem[] | undefined): number =>
  items?.reduce((acc, item) => {
    const original = item.originalPrice ?? 0
    const promotionDiscount = item.promotionDiscount ?? 0
    return acc + (original - promotionDiscount) * (item.quantity || 0)
  }, 0) ?? 0

/** Raw subtotal — dung loop JS nhe, tranh serialize + native bridge tren moi update */
export const calcRawSubTotal = (items: IOrderItem[] | undefined): number =>
  items?.reduce(
    (sum, item) => sum + (item.originalPrice ?? 0) * (item.quantity || 0),
    0,
  ) ?? 0
