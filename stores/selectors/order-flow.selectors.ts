/**
 * Order Flow selectors — chuẩn hóa selector hooks cho order-flow.store.
 * Dùng thay vì useOrderFlowStore() trực tiếp để giảm re-render.
 */
import type { IOrderItem } from '@/types'
import { useShallow } from 'zustand/react/shallow'

import { OrderFlowStep, useOrderFlowStore } from '../order-flow.store'

const EMPTY_ORDER_ITEMS: IOrderItem[] = []

/**
 * @deprecated P3-T1: Dùng selector granular thay vì full orderingData.
 * VD: useOrderFlowCreateOrderDialog, useOrderFlowCartList, useOrderFlowVoucherDrawerData.
 */
export const useOrderingData = () => useOrderFlowStore((s) => s.orderingData)

/** CartContentPhase1 — chỉ subscribe orderItems.length (primitive), không lấy array */
export const useOrderItemsLength = () =>
  useOrderFlowStore((s) => s.orderingData?.orderItems?.length ?? 0)

/**
 * @deprecated P3-T1: Subscribe to specific fields of updatingData instead of the whole object.
 * Use direct store selectors: `useOrderFlowStore(s => s.updatingData?.specificField)`.
 * This selector returns the full updatingData object, causing re-renders on any field change.
 */
export const useUpdatingData = () => useOrderFlowStore((s) => s.updatingData)

/** Actions dùng chung — stable refs, dùng useShallow */
export const useOrderFlowActions = () =>
  useOrderFlowStore(
    useShallow((s) => ({
      addOrderingItem: s.addOrderingItem,
      setCurrentStep: s.setCurrentStep,
      initializeOrdering: s.initializeOrdering,
      transitionToPayment: s.transitionToPayment,
      clearUpdatingData: s.clearUpdatingData,
    })),
  )

/**
 * @deprecated P3-T1: Dùng useOrderFlowCreateOrderDialog — subscribe granular thay vì full orderingData.
 */
export const useOrderFlowCreateOrder = () =>
  useOrderFlowStore(
    useShallow((s) => ({
      orderingData: s.orderingData,
      transitionToPayment: s.transitionToPayment,
    })),
  )

/** T5: CreateOrderDialog — subscribe chỉ các field cần thiết, tránh re-render khi paymentData/updatingData đổi */
export const useOrderFlowCreateOrderDialog = () =>
  useOrderFlowStore(
    useShallow((s) => {
      const od = s.orderingData
      return {
        orderItems: od?.orderItems ?? [],
        voucher: od?.voucher ?? null,
        type: od?.type,
        table: od?.table,
        tableName: od?.tableName,
        timeLeftTakeOut: od?.timeLeftTakeOut,
        deliveryAddress: od?.deliveryAddress,
        deliveryPhone: od?.deliveryPhone,
        deliveryDistance: od?.deliveryDistance,
        deliveryPlaceId: od?.deliveryPlaceId,
        owner: od?.owner,
        ownerFullName: od?.ownerFullName,
        ownerPhoneNumber: od?.ownerPhoneNumber,
        description: od?.description,
        transitionToPayment: s.transitionToPayment,
      }
    }),
  )

/** Selectors cho Voucher List Drawer — cartItems subscribe riêng qua orderingData */
export const useOrderFlowVoucherDrawer = () =>
  useOrderFlowStore(
    useShallow((s) => ({
      addVoucher: s.addVoucher,
      removeVoucher: s.removeVoucher,
      isHydrated: s.isHydrated,
    })),
  )

/** Selectors cho Delete Cart Item Dialog — 1 subscription thay vì 3 */
export const useOrderFlowDeleteCartItem = () =>
  useOrderFlowStore(
    useShallow((s) => ({
      removeOrderingItem: s.removeOrderingItem,
      getCartItems: s.getCartItems,
      removeVoucher: s.removeVoucher,
    })),
  )

/** Cart item count — subscribe primitive orderItemTotalQuantity, không reduce trong component */
export const useOrderFlowCartItemCount = (): number =>
  useOrderFlowStore((s) =>
    s.currentStep === OrderFlowStep.ORDERING ? (s.orderItemTotalQuantity ?? 0) : 0,
  )

/** Min order value — VoucherListDrawer subscribe, chỉ re-render khi giá trị đổi */
export const useOrderFlowMinOrderValue = (): number =>
  useOrderFlowStore((s) =>
    s.currentStep === OrderFlowStep.ORDERING ? (s.minOrderValue ?? 0) : 0,
  )

/** T6/P2-T1: VoucherListDrawer — subscribe minOrderValue + voucher + paymentMethod + orderItemsLength (primitive) */
export const useOrderFlowVoucherDrawerData = () =>
  useOrderFlowStore(
    useShallow((s) => ({
      minOrderValue:
        s.currentStep === OrderFlowStep.ORDERING ? (s.minOrderValue ?? 0) : 0,
      voucher: s.orderingData?.voucher ?? null,
      paymentMethod: s.orderingData?.paymentMethod,
      orderItemsLength: s.orderingData?.orderItems?.length ?? 0,
    })),
  )

/** MenuItemDetailContent — tách state (primitives) vs actions để tránh re-render khi cart thay đổi */
export const useOrderFlowMenuItemDetailState = () =>
  useOrderFlowStore(
    useShallow((s) => ({
      isHydrated: s.isHydrated,
      currentStep: s.currentStep,
      hasOrderingData: !!s.orderingData,
      hasOrderingOwner: !!(s.orderingData?.owner?.trim()),
    })),
  )

/** Actions cho Product Detail — stable refs, không gây re-render khi cart đổi */
export const useOrderFlowMenuItemDetailActions = () =>
  useOrderFlowStore(
    useShallow((s) => ({
      initializeOrdering: s.initializeOrdering,
      setCurrentStep: s.setCurrentStep,
      addOrderingItem: s.addOrderingItem,
    })),
  )

/** CartList — chỉ subscribe orderItems + voucher, không re-render khi order.type/table/description thay đổi */
export const useOrderFlowCartList = () =>
  useOrderFlowStore(
    useShallow((s) => ({
      orderItems: s.orderingData?.orderItems ?? EMPTY_ORDER_ITEMS,
      voucher: s.orderingData?.voucher ?? null,
    })),
  )

/** Chỉ subscribe orderType — cho delivery fee effect trong CartContentFull */
export const useOrderFlowOrderType = () =>
  useOrderFlowStore((s) => s.orderingData?.type)

/** Chỉ subscribe tableName — cart footer chỉ re-render khi tableName đổi */
export const useOrderFlowTableName = () =>
  useOrderFlowStore((s) => s.orderingData?.tableName)

/** Chỉ subscribe deliveryDistance — cho useCalculateDeliveryFee */
export const useOrderFlowDeliveryDistance = () =>
  useOrderFlowStore((s) => s.orderingData?.deliveryDistance)

/**
 * Per-item selector — chỉ re-render khi đúng item đó đổi.
 * Dùng khi cần atomic update (VD: CartItemRow dùng liveItem).
 * Lưu ý: Cần item.id. Unchanged items giữ ref (map: ... : item).
 */
export const useOrderItem = (itemId: string) =>
  useOrderFlowStore((s) =>
    s.orderingData?.orderItems?.find((i) => i.id === itemId),
  )

/** Chỉ subscribe quantity của 1 item — atomic nhất. */
export const useOrderItemQuantity = (itemId: string): number =>
  useOrderFlowStore(
    (s) =>
      s.orderingData?.orderItems?.find((i) => i.id === itemId)?.quantity ?? 0,
  )

/**
 * CartFooter — chỉ subscribe type/table/delivery*, không re-render khi orderItems thay đổi.
 * Dùng khi tách Footer riêng — Footer nhận finalTotal từ parent (tính từ orderItems).
 */
export const useOrderFlowCartFooterData = () =>
  useOrderFlowStore(
    useShallow((s) => {
      const d = s.orderingData
      return {
        type: d?.type,
        table: d?.table,
        tableName: d?.tableName,
        deliveryAddress: d?.deliveryAddress,
        deliveryPhone: d?.deliveryPhone,
        deliveryDistance: d?.deliveryDistance,
        deliveryPlaceId: d?.deliveryPlaceId,
        orderItemsLength: d?.orderItems?.length ?? 0,
      }
    }),
  )

/** MenuItemQuantityControl — chỉ re-render khi hasOrderingData/orderingOwner/isHydrated/currentStep/userSlug thay đổi, không khi cart items thay đổi */
export const useOrderFlowMenuItemControl = () =>
  useOrderFlowStore(
    useShallow((s) => ({
      hasOrderingData: !!s.orderingData,
      orderingOwner: s.orderingData?.owner ?? '',
      isHydrated: s.isHydrated,
      currentStep: s.currentStep,
      initializeOrdering: s.initializeOrdering,
      setCurrentStep: s.setCurrentStep,
      addOrderingItem: s.addOrderingItem,
    })),
  )
