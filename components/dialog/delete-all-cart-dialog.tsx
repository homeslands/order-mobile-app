import { Trash2, TriangleAlert } from 'lucide-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { Button, Dialog, Label } from '@/components/ui'
import { useOrderFlowStore } from '@/stores'

import { ConfirmationDialog } from './confirmation-dialog'

export default function DeleteAllCartDialog() {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const [isOpen, setIsOpen] = useState(false)
  const clearAllData = useOrderFlowStore((s) => s.clearAllData)

  const handleDelete = () => {
    setIsOpen(false)
    clearAllData()
  }

  return (
    <>
      <Dialog.Trigger>
        <Button
          variant="destructive"
          onPress={() => setIsOpen(true)}
          className="rounded-md"
        >
          <View className="flex-row items-center justify-center gap-2">
            <Trash2 size={20} color="#fff" />
            <Text className="text-white">{t('order.deleteAll')}</Text>
          </View>
        </Button>
      </Dialog.Trigger>
      <ConfirmationDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={t('order.deleteAll')}
        description={tCommon('common.deleteNote')}
        confirmLabel={tCommon('common.confirmDelete')}
        cancelLabel={tCommon('common.cancel')}
        onConfirm={handleDelete}
        variant="destructive"
        icon={<TriangleAlert size={20} color="#ef4444" />}
        content={
          <View className="flex items-center gap-4">
              <Label className="text-left leading-5">
                {t('order.deleteAllWarning')}
              </Label>
            </View>
        }
        descriptionClassName="text-destructive rounded-md bg-red-100 p-2 dark:bg-transparent"
      />
    </>
  )
}
