/**
 * Payment Flow Store — standalone store for payment phase.
 * Extracted from order-flow.store.ts to reduce monolith complexity.
 */
import { PaymentMethod } from '@/constants'
import { IOrder } from '@/types'
import { createSafeStorage } from '@/utils/storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface IPaymentData {
  orderSlug: string
  paymentMethod: PaymentMethod
  transactionId?: string
  qrCode: string
  paymentSlug: string
  orderData?: IOrder
  paymentAmount?: number
  isQrValid: boolean
}

interface IPaymentFlowStore {
  paymentData: IPaymentData | null
  isHydrated: boolean

  initializePayment: (orderSlug: string, paymentMethod?: PaymentMethod) => void
  setPaymentData: (data: Partial<IPaymentData>) => void
  updatePaymentMethod: (method: PaymentMethod, transactionId?: string) => void
  updateQrCode: (qrCode: string) => void
  setOrderFromAPI: (order: IOrder) => void
  setPaymentSlug: (slug: string) => void
  clearPaymentData: () => void
}

export const usePaymentFlowStore = create<IPaymentFlowStore>()(
  persist(
    (set, get) => ({
      paymentData: null,
      isHydrated: false,

      initializePayment: (orderSlug, paymentMethod) => {
        set({
          paymentData: {
            orderSlug,
            paymentMethod: paymentMethod || PaymentMethod.BANK_TRANSFER,
            qrCode: '',
            paymentSlug: '',
            isQrValid: false,
          },
        })
      },

      setPaymentData: (data) => {
        const { paymentData } = get()
        if (!paymentData) return
        set({ paymentData: { ...paymentData, ...data } })
      },

      updatePaymentMethod: (method, transactionId) => {
        const { paymentData } = get()
        if (!paymentData) return
        set({
          paymentData: { ...paymentData, paymentMethod: method, transactionId },
        })
      },

      updateQrCode: (qrCode) => {
        const { paymentData } = get()
        if (!paymentData) return
        const isQrValid =
          paymentData.orderData?.payment?.amount != null &&
          paymentData.orderData.subtotal != null &&
          paymentData.orderData.payment.amount === paymentData.orderData.subtotal &&
          qrCode.trim() !== ''
        set({ paymentData: { ...paymentData, qrCode, isQrValid } })
      },

      setOrderFromAPI: (order) => {
        const { paymentData } = get()
        if (!paymentData) return
        set({
          paymentData: {
            ...paymentData,
            paymentMethod: paymentData.paymentMethod,
            orderData: order,
            paymentAmount: order.payment?.amount || 0,
            paymentSlug: order.payment?.slug || '',
          },
        })
      },

      setPaymentSlug: (slug) => {
        const { paymentData } = get()
        if (!paymentData) return
        set({ paymentData: { ...paymentData, paymentSlug: slug } })
      },

      clearPaymentData: () => {
        set({ paymentData: null })
      },
    }),
    {
      name: 'payment-flow-store',
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: (state) => ({ paymentData: state.paymentData }),
      onRehydrateStorage: () => () => {
        setTimeout(() => {
          usePaymentFlowStore.setState({ isHydrated: true })
        }, 0)
      },
    },
  ),
)
