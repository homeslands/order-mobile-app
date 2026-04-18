import {
  IOrder,
  IOrderDetail,
  IOrderItem,
  IOrderToUpdate,
  ITable,
  IUserInfo,
  IVoucher,
  OrderStatus,
  OrderTypeEnum,
} from '@/types'
import dayjs from 'dayjs'

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface IUpdatingData {
  originalOrder: IOrder
  updateDraft: IOrderToUpdate
  hasChanges: boolean
}

export interface IUpdateOrderFlowStore {
  updatingData: IUpdatingData | null
  isHydrated: boolean
  lastModified: number

  initializeUpdating: (originalOrder: IOrder) => void
  setUpdateDraft: (draft: IOrderToUpdate) => void
  updateDraftItem: (itemId: string, changes: Partial<IOrderItem>) => void
  updateDraftItemQuantity: (itemId: string, quantity: number) => void
  addDraftItem: (item: IOrderItem) => void
  removeDraftItem: (itemId: string) => void
  addDraftPickupTime: (time: number) => void
  removeDraftPickupTime: () => void
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
}

// ─── Slice factory types ──────────────────────────────────────────────────────

export type SetFn = (partial: Partial<IUpdateOrderFlowStore>) => void
export type GetFn = () => IUpdateOrderFlowStore

// ─── ID generators ───────────────────────────────────────────────────────────

export const generateOrderId = () =>
  `order_${dayjs().valueOf()}_${Math.random().toString(36).substr(2, 9)}`

export const generateOrderItemId = () =>
  `item_${dayjs().valueOf()}_${Math.random().toString(36).substr(2, 9)}`

// ─── Helper ──────────────────────────────────────────────────────────────────

export const convertOrderDetailToOrderItem = (
  orderDetail: IOrderDetail,
): IOrderItem => ({
  isGift: false,
  id: orderDetail.id || generateOrderItemId(),
  slug: orderDetail.slug,
  image: orderDetail.variant.product.image,
  name: orderDetail.variant.product.name,
  quantity: orderDetail.quantity,
  size: orderDetail.variant.size.name,
  allVariants: orderDetail.variant.product.variants,
  variant: orderDetail.variant,
  originalPrice: orderDetail.variant.price,
  promotion: orderDetail.promotion || null,
  promotionValue: orderDetail.promotion?.value || 0,
  productSlug: orderDetail.variant.product.slug,
  description: orderDetail.variant.product.description,
  isLimit: orderDetail.variant.product.isLimit,
  note: orderDetail.note || '',
})

// Re-export types used by slices for convenience
export type {
  IOrderItem,
  IOrderToUpdate,
  ITable,
  IUserInfo,
  IVoucher,
  OrderTypeEnum,
  OrderStatus,
}
