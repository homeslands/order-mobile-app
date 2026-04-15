import { PaymentMethod } from '@/constants'
import { IPaymentMethodStore } from '@/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { requestClearStoresExcept } from '@/lib/store-sync'
import { createSafeStorage } from '@/utils/storage'

export const usePaymentMethodStore = create<IPaymentMethodStore>()(
  persist(
    (set) => ({
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      qrCode: '',
      orderSlug: '',
      setPaymentMethod: (value: PaymentMethod) => {
        requestClearStoresExcept('payment')
        set({ paymentMethod: value })
      },
      setQrCode: (value: string) => {
        requestClearStoresExcept('payment')
        set({ qrCode: value })
      },
      setOrderSlug: (value: string) => {
        requestClearStoresExcept('payment')
        set({ orderSlug: value })
      },
      paymentSlug: '',
      setPaymentSlug: (value: string) => {
        requestClearStoresExcept('payment')
        set({ paymentSlug: value })
      },
      clearPaymentData: () => {
        set({
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          qrCode: '',
          orderSlug: '',
          paymentSlug: '',
        })
      },
      clearStore: () => {
        set({
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          qrCode: '',
          paymentSlug: '',
          orderSlug: '',
        })
      },
    }),
    {
      name: 'payment-storage',
      storage: createJSONStorage(() => createSafeStorage()),
    },
  ),
)
