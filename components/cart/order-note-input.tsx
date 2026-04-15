import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Textarea } from '@/components/ui'

interface OrderNoteInputProps {
  value?: string
  onChange: (text: string) => void
}

// Presentational component (cart-specific layout), không truy cập store
export default function OrderNoteInput({ value, onChange }: OrderNoteInputProps) {
  const { t } = useTranslation('menu')

  return (
    <View className="flex w-full flex-row items-center justify-center gap-2.5">
      <View className="flex flex-row flex-1 gap-2 justify-between items-start w-full">
        <Textarea
          defaultValue={value || ''}
          className="bg-white text-[11px] shadow-none xl:text-sm dark:border-muted-foreground/60 dark:bg-transparent"
          placeholder={t('order.enterOrderNote')}
          onChangeText={onChange}
        />
      </View>
    </View>
  )
}
