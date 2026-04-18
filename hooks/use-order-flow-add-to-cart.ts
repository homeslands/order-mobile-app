/**
 * Hook trả về callback onAddToCart ổn định — không subscribe store.
 * Dùng getState() khi gọi để tránh re-render cascade khi thêm món vào giỏ.
 */
import { useCallback } from 'react'
import dayjs from 'dayjs'

import i18n from '@/i18n'
import { OrderFlowStep } from '@/constants'
import { scheduleStoreUpdate } from '@/lib/navigation'
import { useOrderFlowStore, useUserStore } from '@/stores'
import type { IMenuItem, IOrderItem } from '@/types'
import { showToast } from '@/utils'

export function useOrderFlowAddToCart() {
  return useCallback((item: IMenuItem) => {
    const store = useOrderFlowStore.getState()
    const {
      addOrderingItem,
      setCurrentStep,
      initializeOrdering,
      orderingData,
      isHydrated,
    } = store

    if (!item?.product?.variants?.length || !isHydrated) return

    if (store.currentStep !== OrderFlowStep.ORDERING) {
      setCurrentStep(OrderFlowStep.ORDERING)
    }
    if (!orderingData) {
      initializeOrdering()
      return
    }
    const userSlug = useUserStore.getState().userInfo?.slug
    if (userSlug && !(orderingData.owner ?? '').trim()) {
      initializeOrdering()
      return
    }

    const orderItem: IOrderItem = {
      id: `item_${dayjs().valueOf()}_${Math.random().toString(36).substr(2, 9)}`,
      slug: item?.product?.slug,
      image: item?.product?.image,
      name: item?.product?.name,
      quantity: 1,
      size: item?.product?.variants[0]?.size?.name,
      allVariants: item?.product?.variants,
      variant: item?.product?.variants[0],
      originalPrice: item?.product?.variants[0]?.price,
      productSlug: item?.product?.slug,
      description: item?.product?.description,
      isLimit: item?.product?.isLimit,
      isGift: item?.product?.isGift,
      promotion: item?.promotion ?? null,
      promotionValue: item?.promotion?.value ?? 0,
      note: '',
    }

    try {
      scheduleStoreUpdate(() => addOrderingItem(orderItem))
      showToast(
        i18n.t('toast.addSuccess', {
          ns: 'toast',
          defaultValue: 'Đã thêm vào giỏ hàng',
        }),
        'Thông báo',
      )
    } catch {
      // Silent fail
    }
  }, [])
}
