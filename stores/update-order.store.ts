import dayjs from 'dayjs'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { PaymentMethod } from '@/constants'
import { requestClearStoresExcept } from '@/lib/store-sync'
import {
  IOrder,
  IOrderToUpdate,
  IOriginalOrderStore,
  IUpdateOrderStore,
  OrderStatus,
} from '@/types'

import { createOriginalOrderCustomerMethods, createUpdateOrderCustomerMethods } from './slices/update-order-customer.slice'
import { createOriginalOrderItemsMethods, createUpdateOrderItemsMethods } from './slices/update-order-items.slice'
import { createOriginalOrderPaymentMethods, createUpdateOrderPaymentMethods } from './slices/update-order-payment.slice'
import { createOriginalOrderTableMethods, createUpdateOrderTableMethods } from './slices/update-order-table.slice'
import { createOriginalOrderVoucherMethods, createUpdateOrderVoucherMethods } from './slices/update-order-voucher.slice'

// ─── ID generators (local — used only in setOrderItems / setOriginalOrderItems) ─

const generateShortId = () => Math.random().toString(36).substring(2, 9)
const generateOrderId = () => `order_${Date.now()}_${generateShortId()}`

// ─── Draft store ──────────────────────────────────────────────────────────────

export const useUpdateOrderStore = create<IUpdateOrderStore>()(
  persist(
    (set, get) => ({
      orderItems: null,
      isHydrated: false,

      getOrderItems: () => get().orderItems,

      clearStore: () => { set({ orderItems: null }) },

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

      ...createUpdateOrderCustomerMethods(set, get),
      ...createUpdateOrderItemsMethods(set, get),
      ...createUpdateOrderTableMethods(set, get),
      ...createUpdateOrderPaymentMethods(set, get),
      ...createUpdateOrderVoucherMethods(set, get),
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

// ─── Original snapshot store ──────────────────────────────────────────────────

export const useOriginalOrderStore = create<IOriginalOrderStore>()(
  persist(
    (set, get) => ({
      originalOrderItems: null,

      getOriginalOrderItems: () => get().originalOrderItems,

      clearOriginalStore: () => { set({ originalOrderItems: null }) },

      setOriginalOrderItems: (order: IOrder) => {
        const { originalOrderItems } = get()
        const originalOrderStatus = originalOrderItems
          ? originalOrderItems.status
          : OrderStatus.PENDING
        const timestamp = dayjs().valueOf()

        const newOriginalOrderItems: IOrderToUpdate = {
          id: generateOrderId(),
          slug: order.slug,
          productSlug: '',
          owner: order.owner?.slug || '',
          status: originalOrderStatus,
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

        set({ originalOrderItems: newOriginalOrderItems })
      },

      ...createOriginalOrderCustomerMethods(set, get),
      ...createOriginalOrderItemsMethods(set, get),
      ...createOriginalOrderTableMethods(set, get),
      ...createOriginalOrderPaymentMethods(set, get),
      ...createOriginalOrderVoucherMethods(set, get),
    }),
    {
      name: 'original-order-store',
    },
  ),
)
