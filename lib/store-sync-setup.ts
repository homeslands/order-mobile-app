/**
 * Bootstrap — đăng ký store clear callbacks cho mediator.
 * Gọi ngay khi app khởi động, sau khi stores đã load.
 */
import { initStoreSync } from './store-sync'
import { useOrderFlowStore } from '@/stores/order-flow.store'
import { usePaymentFlowStore } from '@/stores/payment-flow.store'
import { useUpdateOrderFlowStore } from '@/stores/update-order-flow.store'
import { usePaymentMethodStore } from '@/stores/payment-method.store'

initStoreSync({
  cart: () => useOrderFlowStore.getState().clearOrderingData(),
  payment: () => {
    usePaymentMethodStore.getState().clearStore()
    usePaymentFlowStore.getState().clearPaymentData()
  },
  'update-order': () => {
    useUpdateOrderFlowStore.getState().clearUpdatingData()
  },
  'order-flow': () => useOrderFlowStore.getState().clearOrderingData(),
})
