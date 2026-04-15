import { IOriginalOrderStore, IUpdateOrderStore } from '@/types'

type DraftSetFn = (partial: Partial<IUpdateOrderStore>) => void
type DraftGetFn = () => IUpdateOrderStore

type OrigSetFn = (partial: Partial<IOriginalOrderStore>) => void
type OrigGetFn = () => IOriginalOrderStore

export function createUpdateOrderPaymentMethods(
  set: DraftSetFn,
  get: DraftGetFn,
) {
  return {
    addPaymentMethod: (paymentMethod: string) => {
      const { orderItems } = get()
      if (orderItems) {
        set({ orderItems: { ...orderItems, paymentMethod } })
      }
    },

    setPaymentMethod: (paymentMethod: string) => {
      const { orderItems } = get()
      if (orderItems) {
        set({ orderItems: { ...orderItems, paymentMethod } })
      }
    },

    setOrderSlug: (orderSlug: string) => {
      const { orderItems } = get()
      if (orderItems) {
        set({
          orderItems: {
            ...orderItems,
            payment: { ...orderItems.payment, orderSlug },
          },
        })
      }
    },

    setQrCode: (qrCode: string) => {
      const { orderItems } = get()
      if (orderItems) {
        set({
          orderItems: {
            ...orderItems,
            payment: { ...orderItems.payment, qrCode },
          },
        })
      }
    },

    setPaymentSlug: (paymentSlug: string) => {
      const { orderItems } = get()
      if (orderItems) {
        set({
          orderItems: {
            ...orderItems,
            payment: { ...orderItems.payment, paymentSlug },
          },
        })
      }
    },
  }
}

export function createOriginalOrderPaymentMethods(
  set: OrigSetFn,
  get: OrigGetFn,
) {
  return {
    addOriginalPaymentMethod: (paymentMethod: string) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({ originalOrderItems: { ...originalOrderItems, paymentMethod } })
      }
    },

    setOriginalPaymentMethod: (paymentMethod: string) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({ originalOrderItems: { ...originalOrderItems, paymentMethod } })
      }
    },

    setOriginalOrderSlug: (orderSlug: string) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({
          originalOrderItems: {
            ...originalOrderItems,
            payment: { ...originalOrderItems.payment, orderSlug },
          },
        })
      }
    },

    setOriginalQrCode: (qrCode: string) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({
          originalOrderItems: {
            ...originalOrderItems,
            payment: { ...originalOrderItems.payment, qrCode },
          },
        })
      }
    },

    setOriginalPaymentSlug: (paymentSlug: string) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({
          originalOrderItems: {
            ...originalOrderItems,
            payment: { ...originalOrderItems.payment, paymentSlug },
          },
        })
      }
    },
  }
}
