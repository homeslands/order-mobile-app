/**
 * Ordering Items Slice — add/update/remove order items and notes.
 * Extracted from order-flow.store.ts to reduce file size.
 */
import { OrderTypeEnum, type IOrderItem, type IProductVariant } from '@/types'
import dayjs from 'dayjs'

import { useCartDisplayStore } from '../cart-display.store'
import {
  calcMinOrderValue,
  calcOrderItemTotalQuantity,
  calcRawSubTotal,
  generateOrderId,
  generateOrderItemId,
  OrderFlowStep,
  type IOrderFlowStore,
  type IOrderingData,
} from '../order-flow.types'

type SetFn = (partial: Partial<IOrderFlowStore>) => void
type GetFn = () => IOrderFlowStore

export function createOrderingItemsMethods(set: SetFn, get: GetFn) {
  return {
    addOrderingItem: (item: IOrderItem) => {
      const { orderingData } = get()
      if (!orderingData) {
        const newOrderingData: IOrderingData = {
          id: generateOrderId(),
          slug: generateOrderId(),
          orderItems: [
            {
              ...item,
              id: generateOrderItemId(),
              note: item.note || '',
            },
          ],
          owner: '',
          ownerFullName: '',
          ownerPhoneNumber: '',
          type: OrderTypeEnum.AT_TABLE,
          timeLeftTakeOut: undefined,
          table: '',
          tableName: '',
          voucher: null,
          description: '',
          approvalBy: '',
        }
        set({
          currentStep: OrderFlowStep.ORDERING,
          orderItemTotalQuantity: calcOrderItemTotalQuantity(
            newOrderingData.orderItems,
          ),
          minOrderValue: calcMinOrderValue(newOrderingData.orderItems),
          orderingData: newOrderingData,
          paymentData: null,
          updatingData: null,
          lastModified: dayjs().valueOf(),
        })
        return
      }

      const updatedItems = [
        ...orderingData.orderItems,
        {
          ...item,
          id: generateOrderItemId(),
          note: item.note || '',
        },
      ]

      set({
        currentStep: OrderFlowStep.ORDERING,
        orderItemTotalQuantity: calcOrderItemTotalQuantity(updatedItems),
        minOrderValue: calcMinOrderValue(updatedItems),
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        paymentData: null,
        updatingData: null,
        lastModified: dayjs().valueOf(),
      })
      useCartDisplayStore
        .getState()
        .resetAfterCartChange(calcRawSubTotal(updatedItems))
    },

    addOrderingProductVariant: (id: string) => {
      const { orderingData } = get()
      if (!orderingData) return

      const updatedItems = orderingData.orderItems.map((item) =>
        item.id === id ? { ...item, variant: item.variant || [] } : item,
      )

      set({
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    updateOrderingItemVariant: (itemId: string, variant: IProductVariant) => {
      const { orderingData } = get()
      if (!orderingData) return

      const updatedItems = orderingData.orderItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              variant,
              size: variant.size?.name ?? item.size,
              originalPrice: variant.price,
            }
          : item,
      )

      set({
        minOrderValue: calcMinOrderValue(updatedItems),
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        lastModified: dayjs().valueOf(),
      })
      useCartDisplayStore
        .getState()
        .resetAfterCartChange(calcRawSubTotal(updatedItems))
    },

    updateOrderingItemQuantity: (itemId: string, quantity: number) => {
      const { orderingData } = get()
      if (!orderingData) return

      const updatedItems = orderingData.orderItems.map((item) =>
        item.id === itemId ? { ...item, quantity } : item,
      )

      set({
        orderItemTotalQuantity: calcOrderItemTotalQuantity(updatedItems),
        minOrderValue: calcMinOrderValue(updatedItems),
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        lastModified: dayjs().valueOf(),
      })
      useCartDisplayStore
        .getState()
        .resetAfterCartChange(calcRawSubTotal(updatedItems))
    },

    removeOrderingItem: (itemId: string) => {
      const { orderingData } = get()
      if (!orderingData) return

      const updatedItems = orderingData.orderItems.filter(
        (item) => item.id !== itemId,
      )

      set({
        orderItemTotalQuantity: calcOrderItemTotalQuantity(updatedItems),
        minOrderValue: calcMinOrderValue(updatedItems),
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        lastModified: dayjs().valueOf(),
      })
      useCartDisplayStore
        .getState()
        .resetAfterCartChange(calcRawSubTotal(updatedItems))
    },

    addPickupTime: (time: number) => {
      const { orderingData } = get()
      if (!orderingData) return

      set({
        orderingData: {
          ...orderingData,
          timeLeftTakeOut: time,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    removePickupTime: () => {
      const { orderingData } = get()
      if (!orderingData) return

      set({
        orderingData: { ...orderingData, timeLeftTakeOut: undefined },
        lastModified: dayjs().valueOf(),
      })
    },

    addOrderingNote: (itemId: string, note: string) => {
      const { orderingData } = get()
      if (!orderingData) return

      const updatedItems = orderingData.orderItems.map((item) =>
        item.id === itemId ? { ...item, note } : item,
      )

      set({
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    clearOrderingData: () => {
      set({
        orderItemTotalQuantity: 0,
        minOrderValue: 0,
        orderingData: null,
        lastModified: dayjs().valueOf(),
      })
      useCartDisplayStore.getState().resetAfterCartChange(0)
    },
  }
}
