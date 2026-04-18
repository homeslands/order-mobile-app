/**
 * MenuItemQuantityControl — Chỉ nút + (Add to cart), không hiển thị số lượng.
 * Khi onAddToCart được truyền từ parent: không subscribe store → tránh re-render cascade.
 */
import dayjs from 'dayjs'
import { Plus } from 'lucide-react-native'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { PressableWithFeedback } from '@/components/navigation'
import { OrderFlowStep } from '@/constants'
import { scheduleStoreUpdate } from '@/lib/navigation'
import { HIT_SLOP_SMALL } from '@/lib/navigation/constants'
import { useUserStore } from '@/stores'
import { useOrderFlowMenuItemControl } from '@/stores/selectors'
import { IMenuItem, IOrderItem } from '@/types'
import { showToast } from '@/utils'

interface MenuItemQuantityControlProps {
  item: IMenuItem
  hasStock: boolean
  isMobile: boolean
  /** Callback từ parent — khi có thì không subscribe store */
  onAddToCart?: (item: IMenuItem) => void
}

function buildOrderItem(item: IMenuItem): IOrderItem {
  return {
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
}

/** Không subscribe store — dùng onAddToCart từ parent */
const MenuItemQuantityControlWithCallback = React.memo(
  function MenuItemQuantityControlWithCallback({
    item,
    hasStock,
    isMobile,
    onAddToCart,
  }: MenuItemQuantityControlProps & {
    onAddToCart: (item: IMenuItem) => void
  }) {
    const { t } = useTranslation('menu')

    const handleAddToCart = React.useCallback(() => {
      onAddToCart(item)
    }, [item, onAddToCart])

    if (!hasStock) {
      return (
        <View
          className={
            isMobile
              ? 'rounded-full bg-primary px-4 py-1'
              : 'w-full rounded-full bg-red-500 px-3 py-2'
          }
        >
          <Text
            className={`text-xs font-semibold text-white ${!isMobile ? 'text-center' : ''}`}
          >
            {t('menu.outOfStock', 'Hết hàng')}
          </Text>
        </View>
      )
    }

    return (
      <PressableWithFeedback
        onPress={handleAddToCart}
        hitSlop={HIT_SLOP_SMALL}
        className={
          isMobile
            ? 'z-50 h-8 w-8 items-center justify-center rounded-full bg-primary'
            : 'w-full items-center justify-center rounded-full bg-primary px-3 py-2'
        }
      >
        <Plus size={20} color="#ffffff" />
      </PressableWithFeedback>
    )
  },
)

/** Subscribe store — dùng khi không có onAddToCart từ parent */
const MenuItemQuantityControlWithStore = React.memo(
  function MenuItemQuantityControlWithStore({
    item,
    hasStock,
    isMobile,
  }: Omit<MenuItemQuantityControlProps, 'onAddToCart'>) {
    const { t } = useTranslation('menu')
    const { t: tToast } = useTranslation('toast')
    const {
      hasOrderingData,
      orderingOwner,
      isHydrated,
      currentStep,
      initializeOrdering,
      setCurrentStep,
      addOrderingItem,
    } = useOrderFlowMenuItemControl()
    const userSlug = useUserStore((s) => s.userInfo?.slug)

    const handleAddToCart = React.useCallback(() => {
      if (!item?.product?.variants?.length || !isHydrated) return
      if (currentStep !== OrderFlowStep.ORDERING)
        setCurrentStep(OrderFlowStep.ORDERING)
      if (!hasOrderingData) {
        initializeOrdering()
        return
      }
      if (userSlug && !orderingOwner.trim()) {
        initializeOrdering()
        return
      }
      const orderItem = buildOrderItem(item)
      try {
        scheduleStoreUpdate(() => addOrderingItem(orderItem))
        showToast(
          tToast('toast.addSuccess', 'Đã thêm vào giỏ hàng'),
          'Thông báo',
        )
      } catch {
        // Silent fail
      }
    }, [
      item,
      isHydrated,
      currentStep,
      hasOrderingData,
      orderingOwner,
      userSlug,
      setCurrentStep,
      initializeOrdering,
      addOrderingItem,
      tToast,
    ])

    if (!hasStock) {
      return (
        <View
          className={
            isMobile
              ? 'rounded-full bg-primary px-4 py-1'
              : 'w-full rounded-full bg-red-500 px-3 py-2'
          }
        >
          <Text
            className={`text-xs font-semibold text-white ${!isMobile ? 'text-center' : ''}`}
          >
            {t('menu.outOfStock', 'Hết hàng')}
          </Text>
        </View>
      )
    }

    return (
      <PressableWithFeedback
        onPress={handleAddToCart}
        hitSlop={HIT_SLOP_SMALL}
        className={
          isMobile
            ? 'z-50 h-8 w-8 items-center justify-center rounded-full bg-primary'
            : 'w-full items-center justify-center rounded-full bg-primary px-3 py-2'
        }
      >
        <Plus size={20} color="#ffffff" />
      </PressableWithFeedback>
    )
  },
)

export const MenuItemQuantityControl = React.memo(
  function MenuItemQuantityControl(props: MenuItemQuantityControlProps) {
    if (props.onAddToCart) {
      return (
        <MenuItemQuantityControlWithCallback
          {...props}
          onAddToCart={props.onAddToCart}
        />
      )
    }
    return <MenuItemQuantityControlWithStore {...props} />
  },
)
