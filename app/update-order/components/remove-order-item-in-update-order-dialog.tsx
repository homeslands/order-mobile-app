import { Trash2, TriangleAlert } from 'lucide-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, useColorScheme, View } from 'react-native'

import { Button } from '@/components/ui'
import { colors } from '@/constants'
import { scheduleStoreUpdate } from '@/lib/navigation'
import { useOrderFlowStore } from '@/stores'
import { IOrderItem } from '@/types'

import { ConfirmationDialog } from '@/components/dialog/confirmation-dialog'

interface RemoveOrderItemInUpdateOrderDialogProps {
  orderItem: IOrderItem
  totalOrderItems: number
}

export default function RemoveOrderItemInUpdateOrderDialog({
  orderItem,
  totalOrderItems,
}: RemoveOrderItemInUpdateOrderDialogProps) {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const isDark = useColorScheme() === 'dark'
  const [isOpen, setIsOpen] = useState(false)
  const removeDraftItem = useOrderFlowStore((s) => s.removeDraftItem)
  const removeDraftVoucher = useOrderFlowStore((s) => s.removeDraftVoucher)

  const handleDelete = () => {
    scheduleStoreUpdate(() => {
      if (totalOrderItems <= 1) {
        removeDraftVoucher()
      }
      removeDraftItem(orderItem.id!)
    })
    setIsOpen(false)
  }

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
        onConfirm={handleDelete}
        variant="destructive"
        icon={
          <TriangleAlert
            size={20}
            color={isDark ? colors.destructive.dark : colors.destructive.light}
          />
        }
        content={
          <View className="flex items-center gap-4">
            <Text className="text-left leading-5">
              {t('order.deleteContent')}{' '}
              <Text className="font-bold">{orderItem.name}</Text>{' '}
              {t('order.deleteContent2')}
            </Text>
          </View>
        }
        titleClassName="flex-row items-center gap-2 text-destructive"
        descriptionClassName="rounded-md bg-red-100 p-2 text-destructive dark:bg-transparent"
      />
    </>
  )
}
