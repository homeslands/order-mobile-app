/**
 * Update Order Flow Store — standalone store for the updating phase.
 * Extracted from order-flow.store.ts to reduce monolith complexity.
 */
import { IOrder, IOrderToUpdate, OrderStatus } from '@/types'
import { createSafeStorage } from '@/utils/storage'
import dayjs from 'dayjs'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { createUpdatingCustomerMethods } from './slices/updating-customer.slice'
import { createUpdatingDeliveryMethods } from './slices/updating-delivery.slice'
import { createUpdatingItemsMethods } from './slices/updating-items.slice'
import { createUpdatingTableMethods } from './slices/updating-table.slice'
import { createUpdatingVoucherMethods } from './slices/updating-voucher.slice'
import {
  convertOrderDetailToOrderItem,
  generateOrderId,
  generateOrderItemId,
  type IUpdateOrderFlowStore,
} from './update-order-flow.types'

// Re-export IUpdatingData — consumed by order-flow.types.ts at this exact path
export type { IUpdatingData } from './update-order-flow.types'

export const useUpdateOrderFlowStore = create<IUpdateOrderFlowStore>()(
  persist(
    (set, get) => ({
      updatingData: null,
      isHydrated: false,
      lastModified: 0,

      initializeUpdating: (originalOrder: IOrder) => {
        const orderItemsWithIds = originalOrder.orderItems.map((item) => ({
          ...item,
          id: item.slug || generateOrderItemId(),
        }))

        const updatedOriginalOrder: IOrder = {
          ...originalOrder,
          orderItems: orderItemsWithIds,
          deliveryAddress: originalOrder.deliveryTo?.formattedAddress || '',
          deliveryDistance: originalOrder.deliveryDistance,
          deliveryDuration: originalOrder.deliveryDuration,
          deliveryPhone: originalOrder.deliveryPhone,
          deliveryTo: originalOrder.deliveryTo,
          deliveryFee: originalOrder.deliveryFee,
          voucher: originalOrder.voucher || null,
        }

        const updateDraft: IOrderToUpdate = {
          id: generateOrderId(),
          slug: updatedOriginalOrder.slug,
          productSlug:
            updatedOriginalOrder.orderItems[0]?.variant.product.slug || '',
          status: updatedOriginalOrder.status || OrderStatus.PENDING,
          owner: updatedOriginalOrder.owner?.slug || '',
          ownerFullName:
            updatedOriginalOrder.owner?.firstName +
              ' ' +
              updatedOriginalOrder.owner?.lastName || '',
          ownerPhoneNumber: updatedOriginalOrder.owner?.phonenumber || '',
          ownerRole: updatedOriginalOrder.owner?.role.name || '',
          paymentMethod: updatedOriginalOrder.payment?.paymentMethod || '',
          type: updatedOriginalOrder.type,
          timeLeftTakeOut: updatedOriginalOrder.timeLeftTakeOut,
          table: updatedOriginalOrder.table?.slug || '',
          tableName: updatedOriginalOrder.table?.name || '',
          orderItems: orderItemsWithIds.map((item) => ({
            ...convertOrderDetailToOrderItem(item),
            id: item.id,
          })),
          deliveryAddress:
            updatedOriginalOrder.deliveryTo?.formattedAddress || '',
          deliveryDistance: updatedOriginalOrder.deliveryDistance,
          deliveryDuration: updatedOriginalOrder.deliveryDuration,
          deliveryPhone: updatedOriginalOrder.deliveryPhone,
          voucher: updatedOriginalOrder.voucher,
          description: updatedOriginalOrder.description || '',
          approvalBy: updatedOriginalOrder.approvalBy?.slug || '',
          deliveryTo: updatedOriginalOrder.deliveryTo,
          deliveryFee: updatedOriginalOrder.deliveryFee,
        }

        set({
          updatingData: {
            originalOrder: updatedOriginalOrder,
            updateDraft,
            hasChanges: false,
          },
          lastModified: dayjs().valueOf(),
        })
      },

      setUpdateDraft: (draft: IOrderToUpdate) => {
        const { updatingData } = get()
        if (!updatingData) return

        // Reference equality O(1) thay vì JSON.stringify O(n)
        const hasChanges = draft !== updatingData.updateDraft

        set({
          updatingData: { ...updatingData, updateDraft: draft, hasChanges },
          lastModified: dayjs().valueOf(),
        })
      },

      ...createUpdatingItemsMethods(set, get),
      ...createUpdatingCustomerMethods(set, get),
      ...createUpdatingTableMethods(set, get),
      ...createUpdatingVoucherMethods(set, get),
      ...createUpdatingDeliveryMethods(set, get),

      resetDraftToOriginal: () => {
        const { updatingData } = get()
        if (!updatingData) return

        const resetDraft: IOrderToUpdate = {
          id: generateOrderId(),
          slug: updatingData.originalOrder.slug,
          productSlug:
            updatingData.originalOrder.orderItems[0].variant.product.slug || '',
          status: updatingData.originalOrder.status || OrderStatus.PENDING,
          owner: updatingData.originalOrder.owner?.slug || '',
          ownerFullName: updatingData.originalOrder.owner?.firstName || '',
          ownerPhoneNumber:
            updatingData.originalOrder.owner?.phonenumber || '',
          paymentMethod:
            updatingData.originalOrder.payment?.paymentMethod || '',
          type: updatingData.originalOrder.type,
          table: updatingData.originalOrder.table?.slug || '',
          tableName: updatingData.originalOrder.table?.name || '',
          orderItems: updatingData.originalOrder.orderItems.map(
            convertOrderDetailToOrderItem,
          ),
          voucher: updatingData.originalOrder.voucher,
          description: updatingData.originalOrder.description || '',
          approvalBy: updatingData.originalOrder.approvalBy?.slug || '',
        }

        set({
          updatingData: { ...updatingData, updateDraft: resetDraft, hasChanges: false },
          lastModified: dayjs().valueOf(),
        })
      },

      clearUpdatingData: () => {
        set({ updatingData: null, lastModified: dayjs().valueOf() })
      },
    }),
    {
      name: 'update-order-flow-store',
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: (state) => ({
        updatingData: state.updatingData,
        lastModified: state.lastModified,
      }),
      onRehydrateStorage: () => () => {
        setTimeout(() => {
          useUpdateOrderFlowStore.setState({ isHydrated: true })
        }, 0)
      },
    },
  ),
)
