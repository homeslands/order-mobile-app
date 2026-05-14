/**
 * Ordering Items Slice — add/update/remove order items and notes.
 * Extracted from order-flow.store.ts to reduce file size.
 */
import { OrderTypeEnum, type IOrderItem, type IProductVariant } from '@/types'
import dayjs from 'dayjs'

import { useCartDisplayStore } from '../cart-display.store'
import {
  aggregateOrderItems,
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
        const newAgg = aggregateOrderItems(newOrderingData.orderItems)
        set({
          currentStep: OrderFlowStep.ORDERING,
          orderItemTotalQuantity: newAgg.orderItemTotalQuantity,
          minOrderValue: newAgg.minOrderValue,
          orderItemsById: newAgg.orderItemsById,
          orderingData: newOrderingData,
          paymentData: null,
          updatingData: null,
          lastModified: dayjs().valueOf(),
        })
        useCartDisplayStore.getState().resetAfterCartChange(newAgg.rawSubTotal)
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

      const agg = aggregateOrderItems(updatedItems)
      set({
        currentStep: OrderFlowStep.ORDERING,
        orderItemTotalQuantity: agg.orderItemTotalQuantity,
        minOrderValue: agg.minOrderValue,
        orderItemsById: agg.orderItemsById,
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        paymentData: null,
        updatingData: null,
        lastModified: dayjs().valueOf(),
      })
      useCartDisplayStore.getState().resetAfterCartChange(agg.rawSubTotal)
    },

    addOrderingProductVariant: (id: string) => {
      const { orderingData } = get()
      if (!orderingData) return

      const updatedItems = orderingData.orderItems.map((item) =>
        item.id === id ? { ...item, variant: item.variant || [] } : item,
      )

      set({
        orderItemsById: aggregateOrderItems(updatedItems).orderItemsById,
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

      const agg = aggregateOrderItems(updatedItems)
      set({
        minOrderValue: agg.minOrderValue,
        orderItemsById: agg.orderItemsById,
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        lastModified: dayjs().valueOf(),
      })
      useCartDisplayStore.getState().resetAfterCartChange(agg.rawSubTotal)
    },

    updateOrderingItemQuantity: (itemId: string, quantity: number) => {
      const { orderingData } = get()
      if (!orderingData) return

      const updatedItems = orderingData.orderItems.map((item) =>
        item.id === itemId ? { ...item, quantity } : item,
      )

      const agg = aggregateOrderItems(updatedItems)
      set({
        orderItemTotalQuantity: agg.orderItemTotalQuantity,
        minOrderValue: agg.minOrderValue,
        orderItemsById: agg.orderItemsById,
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        lastModified: dayjs().valueOf(),
      })
      useCartDisplayStore.getState().resetAfterCartChange(agg.rawSubTotal)
    },

    removeOrderingItem: (itemId: string) => {
      const { orderingData } = get()
      if (!orderingData) return

      const updatedItems = orderingData.orderItems.filter(
        (item) => item.id !== itemId,
      )

      const agg = aggregateOrderItems(updatedItems)
      set({
        orderItemTotalQuantity: agg.orderItemTotalQuantity,
        minOrderValue: agg.minOrderValue,
        orderItemsById: agg.orderItemsById,
        orderingData: {
          ...orderingData,
          orderItems: updatedItems,
        },
        lastModified: dayjs().valueOf(),
      })
      useCartDisplayStore.getState().resetAfterCartChange(agg.rawSubTotal)
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
        orderItemsById: aggregateOrderItems(updatedItems).orderItemsById,
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
        orderItemsById: {},
        orderingData: null,
        lastModified: dayjs().valueOf(),
      })
      useCartDisplayStore.getState().resetAfterCartChange(0)
    },
  }
}
