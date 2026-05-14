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
