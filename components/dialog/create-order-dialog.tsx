import { useQueryClient } from '@tanstack/react-query'
import { Loader2, ShoppingCart } from 'lucide-react-native'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, TouchableOpacity, useColorScheme, View } from 'react-native'

import { getOrderBySlug } from '@/api/order'
import { OrderInfoSection } from '@/components/dialog/order-info-section'
import { OrderItemsList } from '@/components/dialog/order-items-list'
import { Button, Dialog, ScrollArea } from '@/components/ui'

import { colors, PHONE_NUMBER_REGEX, Role, ROUTE } from '@/constants'
import {
  useCalculateDeliveryFee,
  useCreateOrder,
  useCreateOrderWithoutLogin,
} from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { onReactProfilerRender } from '@/lib/qa/react-profiler-logger'
import {
  IOrderingData,
  useBranchStore,
  useOrderFlowStore,
  useUpdateOrderStore,
  useUserStore,
} from '@/stores'
import { useOrderFlowCreateOrderDialog } from '@/stores/selectors'
import { ICreateOrderRequest, OrderTypeEnum } from '@/types'
import {
  calculateCartDisplayAndTotals,
  parseKm,
  showErrorToast,
  showToast,
} from '@/utils'
import { Profiler } from 'react'
import { useShallow } from 'zustand/react/shallow'

interface IPlaceOrderDialogProps {
  onSuccess?: () => void
  disabled?: boolean | undefined
  onSuccessfulOrder?: () => void
  fullWidthButton?: boolean
  /** Dùng TouchableOpacity thay Button — giảm PlaceOrderDialog ~10ms (Profiler) */
  lightButton?: boolean
  /** Mount xong mở dialog ngay (dùng cho lazy mount từ CartFooter). */
  autoOpenOnMount?: boolean
}

export default function PlaceOrderDialog({
  disabled,
  onSuccessfulOrder,
  onSuccess,
  fullWidthButton = true,
  lightButton = false,
  autoOpenOnMount = false,
}: IPlaceOrderDialogProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation(['menu'])
  const { t: tCommon } = useTranslation('common')
  const { t: tToast } = useTranslation('toast')
  const orderFields = useOrderFlowCreateOrderDialog()
  const clearUpdateOrderStore = useUpdateOrderStore((s) => s.clearStore)
  const { mutate: createOrder, isPending } = useCreateOrder()
  const { mutate: createOrderWithoutLogin, isPending: isPendingWithoutLogin } =
    useCreateOrderWithoutLogin()
  const [isOpen, setIsOpen] = useState(false)
  // #1 Lazy: Chỉ mount Dialog.Content sau lần mở đầu — giảm CPU khi Cart mount
  const [hasOpened, setHasOpened] = useState(false)
  const getUserInfo = useUserStore((s) => s.getUserInfo)
  const branchSlugFromBranch = useBranchStore((s) => s.branch?.slug)
  const { hasUser, roleName, userBranchSlug } = useUserStore(
    useShallow((s) => ({
      hasUser: !!s.userInfo,
      roleName: s.userInfo?.role?.name,
      userBranchSlug: s.userInfo?.branch?.slug,
    })),
  )

  const isDark = useColorScheme() === 'dark'
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light

  const { transitionToPayment, ...orderFieldsData } = orderFields
  const order = useMemo(() => {
    const od = useOrderFlowStore.getState().orderingData
    if (!od) return null
    return { ...od, ...orderFieldsData } as IOrderingData
  }, [orderFieldsData])

  // #1 Lazy: Chỉ tính displayItems, cartTotals, deliveryFee khi dialog mở — giảm CPU khi Cart mount
  const branchSlug =
    !hasUser || roleName === Role.CUSTOMER
      ? branchSlugFromBranch
      : userBranchSlug

  // Phase 1: Memo — native-first (calculateDisplayItemsNative), fallback JS
  const { displayItems, cartTotals } = useMemo(() => {
    if (!hasOpened || !order) {
      return {
        displayItems: [] as ReturnType<
          typeof calculateCartDisplayAndTotals
        >['displayItems'],
        cartTotals: {
          subTotalBeforeDiscount: 0,
          promotionDiscount: 0,
          voucherDiscount: 0,
          finalTotal: 0,
        },
      }
    }
    return calculateCartDisplayAndTotals(order, order?.voucher || null)
  }, [hasOpened, order])
  const displayItemsBySlug = useMemo(() => {
    const map = new Map<string, (typeof displayItems)[number]>()
    for (const d of displayItems) {
      const slug = (d as { slug?: string }).slug
      if (slug) map.set(slug, d)
    }
    return map
  }, [displayItems])
  const deliveryFee = useCalculateDeliveryFee(
    parseKm(order?.deliveryDistance) || 0,
    branchSlug || '',
    { enabled: hasOpened && hasUser },
  )

  const handleSubmit = (orderParam: IOrderingData) => {
    const order = useOrderFlowStore.getState().orderingData ?? orderParam
    if (!order) return

    if (!branchSlug) {
      showErrorToast(11000)
      return
    }

    // Validate delivery case
    if (order.type === OrderTypeEnum.DELIVERY) {
      const phoneOk =
        !!order.deliveryPhone && PHONE_NUMBER_REGEX.test(order.deliveryPhone)
      if (!order.deliveryAddress || !phoneOk) {
        showErrorToast(119000)
        return
      }
    }

    const createOrderRequest: ICreateOrderRequest = {
      type: order.type,
      timeLeftTakeOut: order.timeLeftTakeOut || 0,
      deliveryTo: order.deliveryPlaceId || '',
      deliveryPhone: order.deliveryPhone || '',
      table: order.table || '',
      branch: branchSlug,
      owner: order.owner || getUserInfo()?.slug || '',
      approvalBy: getUserInfo()?.slug || '',
      orderItems: order.orderItems.map((orderItem) => {
        return {
          quantity: orderItem.quantity,
          variant: orderItem.variant.slug,
          promotion: orderItem.promotion ? orderItem.promotion.slug : null,
          note: orderItem.note || '',
        }
      }),
      voucher: order.voucher?.slug || null,
      description: order.description || '',
    }

    // Call API to create order
    if (hasUser) {
      createOrder(createOrderRequest, {
        onSuccess: (data) => {
          const orderSlug = data.result.slug
          const paymentRoute =
            roleName === Role.CUSTOMER
              ? ROUTE.CLIENT_PAYMENT
              : ROUTE.SYSTEM_PAYMENT

          queryClient.prefetchQuery({
            queryKey: ['order', orderSlug],
            queryFn: () => getOrderBySlug(orderSlug),
          })

          navigateNative.push({
            pathname: paymentRoute,
            params: { order: orderSlug },
          })

          onSuccess?.()
          transitionToPayment(orderSlug)
          // Clear cart sau khi đơn đã tạo thành công — orderingData không còn cần
          useOrderFlowStore.getState().clearOrderingData()

          setIsOpen(false)
          onSuccessfulOrder?.()
          clearUpdateOrderStore()
          showToast(tToast('toast.createOrderSuccess'))
        },
      })
    } else {
      createOrderWithoutLogin(createOrderRequest, {
        onSuccess: (data) => {
          const orderSlug = data.result.slug

          queryClient.prefetchQuery({
            queryKey: ['order', orderSlug],
            queryFn: () => getOrderBySlug(orderSlug),
          })

          navigateNative.push({
            pathname: ROUTE.CLIENT_PAYMENT,
            params: { order: orderSlug },
          })

          onSuccess?.()
          transitionToPayment(orderSlug)
          useOrderFlowStore.getState().clearOrderingData()

          setIsOpen(false)
          onSuccessfulOrder?.()
          clearUpdateOrderStore()
          showToast(tToast('toast.createOrderSuccess'))
        },
      })
    }
  }

  const buttonLabel = (() => {
    if (order?.type === OrderTypeEnum.AT_TABLE) {
      return order?.table ? t('order.create') : t('menu.noSelectedTable')
    }
    if (order?.type === OrderTypeEnum.DELIVERY) {
      const phoneOk =
        !!order?.deliveryPhone &&
        PHONE_NUMBER_REGEX.test(order?.deliveryPhone || '')
      return order?.deliveryAddress && phoneOk
        ? t('order.create')
        : t('menu.deliveryInfoMissing')
    }
    return t('order.create')
  })()

  const needsTable = order?.type === OrderTypeEnum.AT_TABLE && !order?.table
  const needsDeliveryInfo =
    order?.type === OrderTypeEnum.DELIVERY &&
    (!order?.deliveryAddress ||
      !order?.deliveryPhone ||
      !PHONE_NUMBER_REGEX.test(order?.deliveryPhone || ''))
  const isButtonDisabled =
    disabled ||
    isPending ||
    isPendingWithoutLogin ||
    needsTable ||
    needsDeliveryInfo

  const triggerContent = (
    <>
      {(isPending || isPendingWithoutLogin) && (
        <Loader2 size={16} color="#6b7280" />
      )}
      <Text className="font-medium text-white">{buttonLabel}</Text>
    </>
  )

  useEffect(() => {
    if (autoOpenOnMount) {
      setHasOpened(true)
      setIsOpen(true)
    }
  }, [autoOpenOnMount])

  return (
    <Profiler id="CreateOrderDialog" onRender={onReactProfilerRender}>
      <>
        <Dialog.Trigger>
          {lightButton ? (
            <TouchableOpacity
              disabled={isButtonDisabled}
              onPress={() => {
                setHasOpened(true)
                setIsOpen(true)
              }}
              activeOpacity={0.8}
              className={`flex flex-row items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm ${
                fullWidthButton ? 'w-full' : ''
              } ${isButtonDisabled ? 'px-5 opacity-50' : 'px-6'}`}
            >
              {triggerContent}
            </TouchableOpacity>
          ) : (
            <Button
              disabled={isButtonDisabled}
              className={`flex items-center rounded-full bg-primary text-sm ${
                fullWidthButton ? 'w-full' : 'px-16'
              }`}
              onPress={() => {
                setHasOpened(true)
                setIsOpen(true)
              }}
            >
              {triggerContent}
            </Button>
          )}
        </Dialog.Trigger>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          {/* #1 Lazy: Chỉ mount Dialog.Content khi user bấm Đặt món — giảm CPU khi Cart mount */}
          {hasOpened && (
            <Profiler
              id="CreateOrderDialogContent"
              onRender={onReactProfilerRender}
            >
              <Dialog.Content className="max-w-md gap-0 rounded-md p-0">
                <Dialog.Close onPress={() => setIsOpen(false)} />
                <Dialog.Header className="p-4">
                  <View className="border-b border-gray-200 pb-2 dark:border-gray-700">
                    <View className="flex-row items-center gap-2">
                      <View className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 p-1">
                        <ShoppingCart size={16} color={primaryColor} />
                      </View>
                      <Dialog.Title>{t('order.create')}</Dialog.Title>
                    </View>
                  </View>
                  <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400">
                    {t('order.confirmOrder')}
                  </Dialog.Description>
                </Dialog.Header>

                {/* Order Items List */}
                <ScrollArea className="flex-1 px-4">
                  <ScrollArea.Viewport>
                    <View className="flex-col gap-4 py-4">
                      {/* Order Info */}
                      <OrderInfoSection order={order} />
                      <OrderItemsList
                        order={order}
                        displayItemsBySlug={displayItemsBySlug}
                        cartTotals={cartTotals}
                        deliveryFee={deliveryFee?.deliveryFee || 0}
                      />
                    </View>
                  </ScrollArea.Viewport>
                </ScrollArea>
                <Dialog.Footer className="p-4">
                  {/* Total Amount */}
                  <View className="w-full flex-col items-start justify-start gap-1">
                    <OrderItemsList
                      order={order}
                      displayItemsBySlug={displayItemsBySlug}
                      cartTotals={cartTotals}
                      deliveryFee={deliveryFee?.deliveryFee || 0}
                      pricingSummaryOnly
                    />
                    <View className="mt-4 w-full flex-row justify-end gap-2">
                      <Button
                        variant="outline"
                        onPress={() => setIsOpen(false)}
                        className="min-w-24 border border-gray-300"
                        disabled={isPending || isPendingWithoutLogin}
                      >
                        {tCommon('common.cancel')}
                      </Button>
                      {(() => {
                        const isDelivery =
                          order?.type === OrderTypeEnum.DELIVERY
                        const phoneOk =
                          !!order?.deliveryPhone &&
                          PHONE_NUMBER_REGEX.test(order.deliveryPhone || '')
                        const createDisabled =
                          isPending ||
                          isPendingWithoutLogin ||
                          (isDelivery && (!order?.deliveryAddress || !phoneOk))
                        return (
                          <Button
                            onPress={() => {
                              if (order) {
                                handleSubmit(order)
                              }
                            }}
                            disabled={createDisabled}
                            className="bg-primary"
                          >
                            {(isPending || isPendingWithoutLogin) && (
                              <Loader2 size={16} color="#ffffff" />
                            )}
                            {t('order.create')}
                          </Button>
                        )
                      })()}
                    </View>
                  </View>
                </Dialog.Footer>
              </Dialog.Content>
            </Profiler>
          )}
        </Dialog>
      </>
    </Profiler>
  )
}
