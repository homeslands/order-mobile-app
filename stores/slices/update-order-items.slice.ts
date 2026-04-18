import i18next from 'i18next'
import {
  ICartItem,
  IOriginalOrderStore,
  IOrderToUpdate,
  IUpdateOrderStore,
  OrderStatus,
  OrderTypeEnum,
} from '@/types'
import { showToast } from '@/utils/toast'

type DraftSetFn = (partial: Partial<IUpdateOrderStore>) => void
type DraftGetFn = () => IUpdateOrderStore

type OrigSetFn = (partial: Partial<IOriginalOrderStore>) => void
type OrigGetFn = () => IOriginalOrderStore

const generateOrderId = () => {
  const shortId = Math.random().toString(36).substring(2, 9)
  return `order_${Date.now()}_${shortId}`
}

const generateOrderItemId = () => {
  const shortId = Math.random().toString(36).substring(2, 9)
  return `orderItem_${Date.now()}_${shortId}`
}

function buildNewOrder(
  item: ICartItem,
  orderStatus: OrderStatus,
): IOrderToUpdate {
  return {
    id: generateOrderId(),
    slug: generateOrderId(),
    status: orderStatus,
    productSlug: '',
    owner: item.owner || '',
    ownerFullName: item.ownerFullName || '',
    ownerPhoneNumber: item.ownerPhoneNumber || '',
    ownerRole: item.ownerRole || '',
    type: item.type || OrderTypeEnum.AT_TABLE,
    orderItems: item.orderItems.map((orderItem) => ({
      ...orderItem,
      id: generateOrderItemId(),
    })),
    table: item.table || '',
    tableName: item.tableName || '',
    voucher: item.voucher,
    note: item.note || '',
    approvalBy: item.approvalBy || '',
    paymentMethod: item.paymentMethod || '',
    payment: item.payment,
  }
}

export function createUpdateOrderItemsMethods(
  set: DraftSetFn,
  get: DraftGetFn,
) {
  return {
    addOrderItem: (item: ICartItem) => {
      const { orderItems } = get()
      const orderStatus = orderItems ? orderItems.status : OrderStatus.PENDING
      if (!orderItems) {
        set({ orderItems: buildNewOrder(item, orderStatus) })
      } else {
        set({
          orderItems: {
            ...orderItems,
            orderItems: [
              ...orderItems.orderItems,
              ...item.orderItems.map((orderItem) => ({
                ...orderItem,
                id: generateOrderId(),
              })),
            ],
          },
        })
      }
      showToast(i18next.t('toast.addSuccess'))
    },

    addProductVariant: (id: string) => {
      const { orderItems } = get()
      if (orderItems) {
        set({
          orderItems: {
            ...orderItems,
            orderItems: orderItems.orderItems.map((orderItem) =>
              orderItem.id === id
                ? { ...orderItem, variant: orderItem.variant || [] }
                : orderItem,
            ),
          },
        })
      }
    },

    updateOrderItemQuantity: (id: string, quantity: number) => {
      const { orderItems } = get()
      if (orderItems) {
        set({
          orderItems: {
            ...orderItems,
            orderItems: orderItems.orderItems.map((orderItem) =>
              orderItem.id === id ? { ...orderItem, quantity } : orderItem,
            ),
          },
        })
      }
    },

    addNote: (id: string, note: string) => {
      const { orderItems } = get()
      if (orderItems) {
        set({
          orderItems: {
            ...orderItems,
            orderItems: orderItems.orderItems.map((orderItem) =>
              orderItem.id === id ? { ...orderItem, note } : orderItem,
            ),
          },
        })
      }
    },

    addOrderNote: (note: string) => {
      const { orderItems } = get()
      if (orderItems) {
        set({ orderItems: { ...orderItems, description: note } })
      }
    },

    removeOrderItem: (cartItemId: string) => {
      const { orderItems } = get()
      if (orderItems) {
        const itemToRemove = orderItems.orderItems.find(
          (item) => item.id === cartItemId,
        )
        if (itemToRemove && itemToRemove.quantity > 1) {
          set({
            orderItems: {
              ...orderItems,
              orderItems: orderItems.orderItems.map((orderItem) =>
                orderItem.id === cartItemId
                  ? { ...orderItem, quantity: orderItem.quantity - 1 }
                  : orderItem,
              ),
            },
          })
        } else {
          set({
            orderItems: {
              ...orderItems,
              orderItems: orderItems.orderItems.filter(
                (orderItem) => orderItem.id !== cartItemId,
              ),
            },
          })
        }
        showToast(i18next.t('toast.removeSuccess'))
      }
    },
  }
}

export function createOriginalOrderItemsMethods(
  set: OrigSetFn,
  get: OrigGetFn,
) {
  return {
    addOriginalOrderItem: (item: ICartItem) => {
      const { originalOrderItems } = get()
      const orderStatus = originalOrderItems
        ? originalOrderItems.status
        : OrderStatus.PENDING
      if (!originalOrderItems) {
        set({ originalOrderItems: buildNewOrder(item, orderStatus) })
      } else {
        set({
          originalOrderItems: {
            ...originalOrderItems,
            orderItems: [
              ...originalOrderItems.orderItems,
              ...item.orderItems.map((orderItem) => ({
                ...orderItem,
                id: generateOrderId(),
              })),
            ],
          },
        })
      }
      showToast(i18next.t('toast.addSuccess'))
    },

    addOriginalProductVariant: (id: string) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({
          originalOrderItems: {
            ...originalOrderItems,
            orderItems: originalOrderItems.orderItems.map((orderItem) =>
              orderItem.id === id
                ? { ...orderItem, variant: orderItem.variant || [] }
                : orderItem,
            ),
          },
        })
      }
    },

    updateOriginalOrderItemQuantity: (id: string, quantity: number) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({
          originalOrderItems: {
            ...originalOrderItems,
            orderItems: originalOrderItems.orderItems.map((orderItem) =>
              orderItem.id === id ? { ...orderItem, quantity } : orderItem,
            ),
          },
        })
      }
    },

    addOriginalNote: (id: string, note: string) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({
          originalOrderItems: {
            ...originalOrderItems,
            orderItems: originalOrderItems.orderItems.map((orderItem) =>
              orderItem.id === id ? { ...orderItem, note } : orderItem,
            ),
          },
        })
      }
    },

    addOriginalOrderNote: (note: string) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({
          originalOrderItems: { ...originalOrderItems, description: note },
        })
      }
    },

    removeOriginalOrderItem: (cartItemId: string) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        const itemToRemove = originalOrderItems.orderItems.find(
          (item) => item.id === cartItemId,
        )
        if (itemToRemove && itemToRemove.quantity > 1) {
          set({
            originalOrderItems: {
              ...originalOrderItems,
              orderItems: originalOrderItems.orderItems.map((orderItem) =>
                orderItem.id === cartItemId
                  ? { ...orderItem, quantity: orderItem.quantity - 1 }
                  : orderItem,
              ),
            },
          })
        } else {
          set({
            originalOrderItems: {
              ...originalOrderItems,
              orderItems: originalOrderItems.orderItems.filter(
                (orderItem) => orderItem.id !== cartItemId,
              ),
            },
          })
        }
        showToast(i18next.t('toast.removeSuccess'))
      }
    },
  }
}
