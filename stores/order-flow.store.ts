import { PaymentMethod } from '@/constants'
import {
  ICartItem,
  IOrder,
  IOrderItem,
  IOrderPayment,
  IOrderToUpdate,
  ITable,
  IUserInfo,
  IVoucher,
  OrderTypeEnum,
} from '@/types'
import { createSafeStorage } from '@/utils/storage'
import dayjs from 'dayjs'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { useCartDisplayStore } from './cart-display.store'
import {
  calcMinOrderValue,
  calcOrderItemTotalQuantity,
  calcRawSubTotal,
  generateOrderId,
  generateOrderItemId,
  OrderFlowStep,
  type IOrderFlowStore,
  type IOrderingData,
} from './order-flow.types'
import { usePaymentFlowStore } from './payment-flow.store'
import { createOrderingDeliveryMethods } from './slices/ordering-delivery.slice'
import { createOrderingItemsMethods } from './slices/ordering-items.slice'
import { useUpdateOrderFlowStore } from './update-order-flow.store'
import { useUserStore } from './user.store'

// Re-export for backward compatibility
export type { IPaymentData } from './payment-flow.store'
export type { IUpdatingData } from './update-order-flow.store'
export {
  OrderFlowStep,
  type IOrderFlowStore,
  type IOrderingData,
} from './order-flow.types'

import type { IPaymentData } from './payment-flow.store'

// Helper function to convert ICartItem to IOrderItem[]
const convertCartItemToOrderItems = (cartItem: ICartItem): IOrderItem[] => {
  return cartItem.orderItems.map((item) => ({
    ...item,
    isGift: false,
    id: item.id || generateOrderItemId(),
  }))
}

/** Helper: sync paymentData from standalone store into order-flow store */
const syncPaymentData = (set: (state: Partial<IOrderFlowStore>) => void) => {
  set({
    paymentData: usePaymentFlowStore.getState().paymentData,
    lastModified: dayjs().valueOf(),
  })
}

/** Helper: sync updatingData from standalone store into order-flow store */
const syncUpdatingData = (set: (state: Partial<IOrderFlowStore>) => void) => {
  set({
    updatingData: useUpdateOrderFlowStore.getState().updatingData,
    lastModified: dayjs().valueOf(),
  })
}

export const useOrderFlowStore = create<IOrderFlowStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStep: OrderFlowStep.ORDERING,
      isHydrated: false,
      lastModified: dayjs().valueOf(),
      orderItemTotalQuantity: 0,
      minOrderValue: 0,
      orderingData: null,
      paymentData: null,
      updatingData: null,

      // Flow management
      setCurrentStep: (step: OrderFlowStep) => {
        set({
          currentStep: step,
          lastModified: dayjs().valueOf(),
        })
      },

      // ===================
      // ORDERING PHASE
      // ===================
      initializeOrdering: () => {
        const timestamp = dayjs().valueOf()
        const userInfo = useUserStore.getState().getUserInfo()
        const phone = userInfo?.phonenumber || ''
        const newOrderingData: IOrderingData = {
          id: generateOrderId(),
          slug: generateOrderId(),
          orderItems: [],
          owner: userInfo?.slug || '',
          ownerFullName:
            `${userInfo?.firstName || ''} ${userInfo?.lastName || ''}`.trim(),
          ownerPhoneNumber: phone,
          ownerRole: userInfo?.role?.name || '',
          type: OrderTypeEnum.AT_TABLE,
          timeLeftTakeOut: undefined,
          table: '',
          tableName: '',
          voucher: null,
          description: '',
          approvalBy: '',
          deliveryAddress: '',
          deliveryDistance: 0,
          deliveryDuration: 0,
          deliveryPhone: phone,
          deliveryLat: undefined,
          deliveryLng: undefined,
          deliveryPlaceId: '',
        }
        set({
          currentStep: OrderFlowStep.ORDERING,
          orderItemTotalQuantity: 0,
          minOrderValue: 0,
          orderingData: newOrderingData,
          paymentData: null,
          updatingData: null,
          lastModified: timestamp,
        })
      },

      setOrderingData: (data: IOrderingData) => {
        set({
          orderingData: data,
          orderItemTotalQuantity: calcOrderItemTotalQuantity(data.orderItems),
          minOrderValue: calcMinOrderValue(data.orderItems),
          lastModified: dayjs().valueOf(),
        })
      },

      // Ordering items methods — extracted to slice
      ...createOrderingItemsMethods(set, get),

      updateOrderingCustomer: (customer: IUserInfo) => {
        const { orderingData } = get()
        if (!orderingData) return

        const fullName =
          `${customer.firstName || ''} ${customer.lastName || ''}`.trim()

        set({
          orderingData: {
            ...orderingData,
            owner: customer.slug,
            ownerFullName: fullName,
            ownerPhoneNumber: customer.phonenumber,
            ownerRole: customer.role.name,
            approvalBy: customer.slug,
          },
          lastModified: dayjs().valueOf(),
        })
      },

      removeOrderingCustomer: () => {
        const { orderingData } = get()
        if (!orderingData) return

        // Check if current voucher requires verification
        const requiresVerification =
          orderingData.voucher?.isVerificationIdentity === true

        set({
          orderingData: {
            ...orderingData,
            owner: '',
            ownerFullName: '',
            ownerPhoneNumber: '',
            ownerRole: '',
            // Remove voucher if it requires verification
            voucher: requiresVerification ? null : orderingData.voucher,
            // Clear delivery info when removing customer
            deliveryAddress: '',
            deliveryDistance: 0,
            deliveryDuration: 0,
            deliveryPhone: '',
          },
          lastModified: dayjs().valueOf(),
        })
      },

      setOrderingTable: (table: ITable) => {
        const { orderingData } = get()
        if (!orderingData) return

        set({
          orderingData: {
            ...orderingData,
            table: table.slug,
            tableName: table.name,
            type: OrderTypeEnum.AT_TABLE,
          },
          lastModified: dayjs().valueOf(),
        })
      },

      removeOrderingTable: () => {
        const { orderingData } = get()
        if (!orderingData) return

        set({
          orderingData: {
            ...orderingData,
            table: '',
            tableName: '',
            // Clear delivery info when removing table
            deliveryAddress: '',
            deliveryDistance: 0,
            deliveryDuration: 0,
          },
          lastModified: dayjs().valueOf(),
        })
      },

      setOrderingVoucher: (voucher: IVoucher | null) => {
        const { orderingData } = get()
        if (!orderingData) return

        set({
          orderingData: {
            ...orderingData,
            voucher,
          },
          lastModified: dayjs().valueOf(),
        })
        useCartDisplayStore.getState().clearDisplay()
      },

      removeOrderingVoucher: () => {
        const { orderingData } = get()
        if (!orderingData) return

        set({
          orderingData: {
            ...orderingData,
            voucher: null,
          },
          lastModified: dayjs().valueOf(),
        })
        useCartDisplayStore.getState().clearDisplay()
      },

      setOrderingType: (type: OrderTypeEnum) => {
        const { orderingData } = get()

        // If orderingData is null, initialize it first
        if (!orderingData) {
          get().initializeOrdering()
          // Get orderingData after initialization
          const { orderingData: newOrderingData } = get()
          if (!newOrderingData) {
            return
          }

          const updatedData = {
            ...newOrderingData,
            type,
            ...(type === OrderTypeEnum.TAKE_OUT
              ? { table: '', tableName: '' }
              : { timeLeftTakeOut: undefined }),
          }

          set({
            orderingData: updatedData,
            lastModified: dayjs().valueOf(),
          })
        } else {
          const updatedData = {
            ...orderingData,
            type,
            ...(type === OrderTypeEnum.TAKE_OUT
              ? { table: '', tableName: '' }
              : { timeLeftTakeOut: undefined }),
          }

          set({
            orderingData: updatedData,
            lastModified: dayjs().valueOf(),
          })
        }
      },

      setOrderingDescription: (description: string) => {
        const { orderingData } = get()
        if (!orderingData) return

        set({
          orderingData: {
            ...orderingData,
            description,
          },
          lastModified: dayjs().valueOf(),
        })
      },

      setOrderingApprovalBy: (approvalBy: string) => {
        const { orderingData } = get()
        if (!orderingData) return

        set({
          orderingData: {
            ...orderingData,
            approvalBy,
          },
          lastModified: dayjs().valueOf(),
        })
      },

      // Delivery info methods — extracted to slice
      ...createOrderingDeliveryMethods(set, get),

      // ===================
      // PAYMENT PHASE (delegated to usePaymentFlowStore)
      // ===================
      initializePayment: (orderSlug: string, paymentMethod?: PaymentMethod) => {
        usePaymentFlowStore
          .getState()
          .initializePayment(orderSlug, paymentMethod)
        set({
          currentStep: OrderFlowStep.PAYMENT,
          paymentData: usePaymentFlowStore.getState().paymentData,
          orderingData: null,
          lastModified: dayjs().valueOf(),
        })
      },

      setPaymentData: (data: Partial<IPaymentData>) => {
        usePaymentFlowStore.getState().setPaymentData(data)
        syncPaymentData(set)
      },

      updatePaymentMethod: (method: PaymentMethod, transactionId?: string) => {
        usePaymentFlowStore
          .getState()
          .updatePaymentMethod(method, transactionId)
        syncPaymentData(set)
      },

      updateQrCode: (qrCode: string) => {
        usePaymentFlowStore.getState().updateQrCode(qrCode)
        syncPaymentData(set)
      },

      setOrderFromAPI: (order: IOrder) => {
        usePaymentFlowStore.getState().setOrderFromAPI(order)
        syncPaymentData(set)
      },

      setPaymentSlug: (slug: string) => {
        usePaymentFlowStore.getState().setPaymentSlug(slug)
        syncPaymentData(set)
      },

      clearPaymentData: () => {
        usePaymentFlowStore.getState().clearPaymentData()
        set({
          paymentData: null,
          lastModified: dayjs().valueOf(),
        })
      },

      // ===================
      // UPDATING PHASE (delegated to useUpdateOrderFlowStore)
      // ===================
      initializeUpdating: (originalOrder: IOrder) => {
        useUpdateOrderFlowStore.getState().initializeUpdating(originalOrder)
        set({
          currentStep: OrderFlowStep.UPDATING,
          updatingData: useUpdateOrderFlowStore.getState().updatingData,
          paymentData: null,
          lastModified: dayjs().valueOf(),
        })
      },

      setUpdateDraft: (draft: IOrderToUpdate) => {
        useUpdateOrderFlowStore.getState().setUpdateDraft(draft)
        syncUpdatingData(set)
      },

      updateDraftItem: (itemId: string, changes: Partial<IOrderItem>) => {
        useUpdateOrderFlowStore.getState().updateDraftItem(itemId, changes)
        syncUpdatingData(set)
      },

      updateDraftItemQuantity: (itemId: string, quantity: number) => {
        useUpdateOrderFlowStore
          .getState()
          .updateDraftItemQuantity(itemId, quantity)
        syncUpdatingData(set)
      },

      addDraftItem: (item: IOrderItem) => {
        useUpdateOrderFlowStore.getState().addDraftItem(item)
        syncUpdatingData(set)
      },

      removeDraftItem: (itemId: string) => {
        useUpdateOrderFlowStore.getState().removeDraftItem(itemId)
        syncUpdatingData(set)
      },

      addDraftPickupTime: (time: number) => {
        useUpdateOrderFlowStore.getState().addDraftPickupTime(time)
        syncUpdatingData(set)
      },

      removeDraftPickupTime: () => {
        useUpdateOrderFlowStore.getState().removeDraftPickupTime()
        syncUpdatingData(set)
      },

      addDraftNote: (itemId: string, note: string) => {
        useUpdateOrderFlowStore.getState().addDraftNote(itemId, note)
        syncUpdatingData(set)
      },

      updateDraftCustomer: (customer: IUserInfo) => {
        useUpdateOrderFlowStore.getState().updateDraftCustomer(customer)
        syncUpdatingData(set)
      },

      removeDraftCustomer: () => {
        useUpdateOrderFlowStore.getState().removeDraftCustomer()
        syncUpdatingData(set)
      },

      setDraftTable: (table: ITable) => {
        useUpdateOrderFlowStore.getState().setDraftTable(table)
        syncUpdatingData(set)
      },

      removeDraftTable: () => {
        useUpdateOrderFlowStore.getState().removeDraftTable()
        syncUpdatingData(set)
      },

      setDraftVoucher: (voucher: IVoucher | null) => {
        useUpdateOrderFlowStore.getState().setDraftVoucher(voucher)
        syncUpdatingData(set)
      },

      removeDraftVoucher: () => {
        useUpdateOrderFlowStore.getState().removeDraftVoucher()
        syncUpdatingData(set)
      },

      setDraftType: (type: OrderTypeEnum) => {
        useUpdateOrderFlowStore.getState().setDraftType(type)
        syncUpdatingData(set)
      },

      setDraftDescription: (description: string) => {
        useUpdateOrderFlowStore.getState().setDraftDescription(description)
        syncUpdatingData(set)
      },

      setDraftApprovalBy: (approvalBy: string) => {
        useUpdateOrderFlowStore.getState().setDraftApprovalBy(approvalBy)
        syncUpdatingData(set)
      },

      setDraftPaymentMethod: (method: string) => {
        useUpdateOrderFlowStore.getState().setDraftPaymentMethod(method)
        syncUpdatingData(set)
      },

      resetDraftToOriginal: () => {
        useUpdateOrderFlowStore.getState().resetDraftToOriginal()
        syncUpdatingData(set)
      },

      setDraftDeliveryAddress: (address: string) => {
        useUpdateOrderFlowStore.getState().setDraftDeliveryAddress(address)
        syncUpdatingData(set)
      },

      setDraftDeliveryDistanceDuration: (
        distance: number,
        duration: number,
      ) => {
        useUpdateOrderFlowStore
          .getState()
          .setDraftDeliveryDistanceDuration(distance, duration)
        syncUpdatingData(set)
      },

      setDraftDeliveryCoords: (lat: number, lng: number, placeId?: string) => {
        useUpdateOrderFlowStore
          .getState()
          .setDraftDeliveryCoords(lat, lng, placeId)
        syncUpdatingData(set)
      },

      setDraftDeliveryPlaceId: (placeId: string) => {
        useUpdateOrderFlowStore.getState().setDraftDeliveryPlaceId(placeId)
        syncUpdatingData(set)
      },

      setDraftDeliveryPhone: (phone: string) => {
        useUpdateOrderFlowStore.getState().setDraftDeliveryPhone(phone)
        syncUpdatingData(set)
      },

      clearDraftDeliveryInfo: () => {
        useUpdateOrderFlowStore.getState().clearDraftDeliveryInfo()
        syncUpdatingData(set)
      },

      clearUpdatingData: () => {
        useUpdateOrderFlowStore.getState().clearUpdatingData()
        set({
          updatingData: null,
          lastModified: dayjs().valueOf(),
        })
      },

      // ===================
      // FLOW TRANSITIONS
      // ===================
      transitionToPayment: (orderSlug: string) => {
        // Mobile: giữ orderingData (cart) để user quay lại nếu cần
        usePaymentFlowStore
          .getState()
          .initializePayment(orderSlug, PaymentMethod.BANK_TRANSFER)
        set({
          currentStep: OrderFlowStep.PAYMENT,
          paymentData: usePaymentFlowStore.getState().paymentData,
          lastModified: dayjs().valueOf(),
        })
      },

      transitionToUpdating: (originalOrder: IOrder) => {
        usePaymentFlowStore.getState().clearPaymentData()
        useUpdateOrderFlowStore.getState().initializeUpdating(originalOrder)
        set({
          currentStep: OrderFlowStep.UPDATING,
          paymentData: null,
          updatingData: useUpdateOrderFlowStore.getState().updatingData,
          lastModified: dayjs().valueOf(),
        })
      },

      transitionBackToOrdering: () => {
        usePaymentFlowStore.getState().clearPaymentData()
        useUpdateOrderFlowStore.getState().clearUpdatingData()
        set({ paymentData: null, updatingData: null })
        get().initializeOrdering()
      },

      // ===================
      // UTILITIES
      // ===================
      clearAllData: () => {
        usePaymentFlowStore.getState().clearPaymentData()
        useUpdateOrderFlowStore.getState().clearUpdatingData()
        set({
          currentStep: OrderFlowStep.ORDERING,
          orderItemTotalQuantity: 0,
          minOrderValue: 0,
          orderingData: null,
          paymentData: null,
          updatingData: null,
          lastModified: dayjs().valueOf(),
        })
      },

      getActiveData: () => {
        const { currentStep, orderingData, paymentData, updatingData } = get()

        switch (currentStep) {
          case OrderFlowStep.ORDERING:
            return orderingData
          case OrderFlowStep.PAYMENT:
            return paymentData
          case OrderFlowStep.UPDATING:
            return updatingData
          default:
            return null
        }
      },

      // ===================
      // COMPATIBILITY METHODS
      // ===================
      getCartItems: () => {
        const { currentStep, orderingData } = get()
        return currentStep === OrderFlowStep.ORDERING ? orderingData : null
      },

      getCartItemCount: () => get().orderItemTotalQuantity ?? 0,

      getOrderItems: () => {
        const { currentStep } = get()
        if (currentStep === OrderFlowStep.UPDATING) {
          return useUpdateOrderFlowStore.getState().updatingData
        }
        return null
      },

      clearCart: () => {
        get().clearOrderingData()
      },

      clearStore: () => {
        get().clearAllData()
      },

      addCartItem: (item: ICartItem) => {
        const { orderingData } = get()

        if (!orderingData) {
          get().initializeOrdering()
        }

        const orderItems = convertCartItemToOrderItems(item)
        orderItems.forEach((orderItem) => {
          get().addOrderingItem(orderItem)
        })

        // Update other cart info
        if (item.owner) {
          const { orderingData: updatedOrderingData } = get()
          if (updatedOrderingData) {
            set({
              orderingData: {
                ...updatedOrderingData,
                owner: item.owner,
                ownerFullName: item.ownerFullName || '',
                ownerPhoneNumber: item.ownerPhoneNumber || '',
                ownerRole: item.ownerRole || '',
                type: item.type as OrderTypeEnum,
                table: item.table || '',
                tableName: item.tableName || '',
                voucher: item.voucher || null,
                description: item.description || '',
                approvalBy: item.approvalBy || '',
                paymentMethod: item.paymentMethod || '',
                payment: item.payment,
              },
              lastModified: dayjs().valueOf(),
            })
          }
        }
      },

      updateCartItemQuantity: (id: string, quantity: number) => {
        get().updateOrderingItemQuantity(id, quantity)
      },

      addNote: (id: string, note: string) => {
        get().addOrderingNote(id, note)
      },

      // Tam thoi chua expose ham doi variant qua compatibility layer; Cart dung truc tiep updateOrderingItemVariant

      addCustomerInfo: (owner: IUserInfo) => {
        get().updateOrderingCustomer(owner)
      },

      removeCustomerInfo: () => {
        get().removeOrderingCustomer()
      },

      addTable: (table: ITable) => {
        get().setOrderingTable(table)
      },

      removeTable: () => {
        get().removeOrderingTable()
      },

      addVoucher: (voucher: IVoucher) => {
        get().setOrderingVoucher(voucher)
      },

      removeVoucher: () => {
        get().removeOrderingVoucher()
      },

      addApprovalBy: (approvalBy: string) => {
        get().setOrderingApprovalBy(approvalBy)
      },

      addOrderType: (orderType: OrderTypeEnum) => {
        get().setOrderingType(orderType)
      },

      addOrderNote: (note: string) => {
        get().setOrderingDescription(note)
      },

      setPaymentMethod: (
        method: PaymentMethod | string,
        transactionId?: string,
      ) => {
        const { currentStep, orderingData } = get()

        if (currentStep === OrderFlowStep.ORDERING && orderingData) {
          set({
            orderingData: {
              ...orderingData,
              paymentMethod: method as string,
            },
            lastModified: dayjs().valueOf(),
          })
        } else if (currentStep === OrderFlowStep.PAYMENT) {
          usePaymentFlowStore
            .getState()
            .updatePaymentMethod(method as PaymentMethod, transactionId)
          syncPaymentData(set)
        }
      },

      setQrCode: (qrCode: string) => {
        usePaymentFlowStore.getState().updateQrCode(qrCode)
        syncPaymentData(set)
      },

      setOrderSlug: (slug: string) => {
        const { currentStep, orderingData } = get()

        if (currentStep === OrderFlowStep.ORDERING && orderingData) {
          set({
            orderingData: {
              ...orderingData,
              payment: {
                ...orderingData.payment,
                orderSlug: slug,
              } as IOrderPayment,
            },
            lastModified: dayjs().valueOf(),
          })
        } else if (currentStep === OrderFlowStep.PAYMENT) {
          usePaymentFlowStore.getState().setPaymentData({ orderSlug: slug })
          syncPaymentData(set)
        }
      },

      removeCartItem: (itemId: string) => {
        get().removeOrderingItem(itemId)
      },
    }),
    {
      name: 'order-flow-store',
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: (state) => ({
        currentStep: state.currentStep,
        orderingData: state.orderingData,
        lastModified: state.lastModified,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Set hydrated flag + derive orderItemTotalQuantity, minOrderValue (khong persist)
          const items = state.orderingData?.orderItems
          const total = calcOrderItemTotalQuantity(items)
          const minVal = calcMinOrderValue(items)
          setTimeout(() => {
            // Sync paymentData and updatingData from standalone stores after hydration
            const paymentData = usePaymentFlowStore.getState().paymentData
            const updatingData = useUpdateOrderFlowStore.getState().updatingData
            useOrderFlowStore.setState({
              isHydrated: true,
              orderItemTotalQuantity: total,
              minOrderValue: minVal,
              paymentData,
              updatingData,
            })
            useCartDisplayStore
              .getState()
              .setRawSubTotal(calcRawSubTotal(items ?? []))
          }, 0)
        }
      },
    },
  ),
)
