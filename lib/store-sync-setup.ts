/**
 * Bootstrap — đăng ký store clear callbacks cho mediator.
 * Gọi ngay khi app khởi động, sau khi stores đã load.
 */
import { initStoreSync } from './store-sync'
import { useCartItemStore } from '@/stores/cart-legacy.store'
import { useOrderFlowStore } from '@/stores/order-flow.store'
import { usePaymentFlowStore } from '@/stores/payment-flow.store'
import { useUpdateOrderFlowStore } from '@/stores/update-order-flow.store'
import { usePaymentMethodStore } from '@/stores/payment-method.store'
import { useUpdateOrderStore } from '@/stores/update-order.store'

initStoreSync({
  cart: () => useCartItemStore.getState().clearCart(),
  payment: () => {
    usePaymentMethodStore.getState().clearStore()
    usePaymentFlowStore.getState().clearPaymentData()
  },
  'update-order': () => {
    useUpdateOrderStore.getState().clearStore()
    useUpdateOrderFlowStore.getState().clearUpdatingData()
  },
  'order-flow': () => useOrderFlowStore.getState().clearOrderingData(),
})
