import { Trash2, TriangleAlert } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, useColorScheme, View } from 'react-native'

import { Button, Label } from '@/components/ui'
import { colors, VOUCHER_TYPE } from '@/constants'
import { scheduleStoreUpdate } from '@/lib/navigation'
import { useOrderFlowDeleteCartItem } from '@/stores/selectors'
import { IOrderItem } from '@/types'
import { showErrorToast } from '@/utils'

import { ConfirmationDialog } from './confirmation-dialog'

interface DialogDeleteCartItemProps {
  cartItem: IOrderItem
}

export default function DeleteCartItemDialog({
  cartItem,
}: DialogDeleteCartItemProps) {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const isDark = useColorScheme() === 'dark'
  const [isOpen, setIsOpen] = useState(false)
  const { removeOrderingItem, getCartItems, removeVoucher } =
    useOrderFlowDeleteCartItem()

  const handleDelete = (cartItemId: string) => {
    const cartItems = getCartItems()
    if (cartItems) {
      const { orderItems } = cartItems

      if (orderItems.length === 1) {
        scheduleStoreUpdate(removeVoucher)
      }
    }

    setIsOpen(false)
    scheduleStoreUpdate(() => removeOrderingItem(cartItemId))
  }

  // use useEffect to check if subtotal is less than minOrderValue of voucher
  useEffect(() => {
    const cartItems = getCartItems()
    if (cartItems) {
      const { orderItems, voucher } = cartItems

      // Tính tổng tiền GỐC (chỉ trừ promotion nếu có, KHÔNG trừ voucher)
      const subtotalBeforeVoucher = orderItems.reduce((acc, item) => {
        const original = item.originalPrice
        const promotionDiscount = item.promotionDiscount ?? 0
        return acc + ((original ?? 0) - promotionDiscount) * item.quantity
      }, 0)

      // Nếu không phải SAME_PRICE_PRODUCT thì mới cần check
      const shouldCheckMinOrderValue =
        voucher?.type !== VOUCHER_TYPE.SAME_PRICE_PRODUCT

      if (
        shouldCheckMinOrderValue &&
        subtotalBeforeVoucher < (voucher?.minOrderValue || 0)
      ) {
        scheduleStoreUpdate(removeVoucher)
        showErrorToast(1004)
        setTimeout(() => {
          setIsOpen(false)
        }, 0)
      }
    }
  }, [getCartItems, removeVoucher])

  return (
    <>
      <Button variant="ghost" onPress={() => setIsOpen(true)}>
        <Trash2
          size={20}
          color={isDark ? colors.destructive.dark : colors.destructive.light}
        />
      </Button>
      <ConfirmationDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={t('order.deleteItem')}
        description={tCommon('common.deleteNote')}
        confirmLabel={tCommon('common.confirmDelete')}
        cancelLabel={tCommon('common.cancel')}
        onConfirm={() => handleDelete(cartItem.id)}
        variant="destructive"
        icon={
          <TriangleAlert
            size={20}
            color={isDark ? colors.destructive.dark : colors.destructive.light}
          />
        }
        content={
          <View className="flex items-center gap-4">
            <Label className="text-left leading-5">
              {t('order.deleteContent')}{' '}
              <Text className="font-bold">{cartItem.name}</Text>
              {t('order.deleteContent2')}
            </Label>
          </View>
        }
        titleClassName="flex-row items-center gap-2 text-destructive"
        descriptionClassName="rounded-md bg-red-100 p-2 text-destructive dark:bg-transparent"
      />
    </>
  )
}
