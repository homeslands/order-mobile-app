import { CircleAlert } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { Image } from 'expo-image'
import { Text, View } from 'react-native'

import PaymentMethodRadioGroup from '@/components/radio/payment-method-radio-group'
import { Label } from '@/components/ui'
import { PaymentMethod } from '@/constants'
import { cn } from '@/lib/utils'
import { IOrder } from '@/types'
import { formatCurrency } from '@/utils'

interface PaymentMethodSelectProps {
  order?: IOrder
  paymentMethod: PaymentMethod[]
  defaultMethod: PaymentMethod | null
  disabledMethods: PaymentMethod[]
  disabledReasons?: Record<PaymentMethod, string>
  qrCode?: string
  total?: number
  onSubmit?: (paymentMethod: PaymentMethod) => void
}

export default function ClientPaymentMethodSelect({
  order,
  paymentMethod,
  defaultMethod,
  disabledMethods,
  disabledReasons,
  qrCode,
  total,
  onSubmit,
}: PaymentMethodSelectProps) {
  const { t } = useTranslation('menu')

  const handlePaymentMethodSubmit = (paymentMethodSubmit: PaymentMethod) => {
    if (onSubmit) {
      onSubmit(paymentMethodSubmit)
    }
  }

  return (
    <View className="flex-col gap-2 mt-6 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <View className="flex-col gap-1 p-4 bg-gray-100 dark:bg-gray-900">
        <Label className="text-base">{t('paymentMethod.title')}</Label>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          ({t('paymentMethod.cashMethodNote')})
        </Text>
      </View>
      <View className={cn(
        'flex-row',
        qrCode ? 'flex-col lg:flex-row' : 'flex-col'
      )}>
        <View className="flex-col flex-1">
          <View className="p-4">
            <PaymentMethodRadioGroup
              order={order}
              defaultValue={defaultMethod}
              disabledMethods={disabledMethods}
              disabledReasons={disabledReasons}
              onSubmit={handlePaymentMethodSubmit}
            />
          </View>
          <View className="flex-row items-center gap-1 px-4 pb-4">
            <CircleAlert size={12} color="#3b82f6" />
            <Text className="text-[10px] text-gray-500 dark:text-gray-400">
              {t('paymentMethod.bankTransferProcessing')}
            </Text>
          </View>
        </View>
        {qrCode && paymentMethod[0] === PaymentMethod.BANK_TRANSFER && (
          <View className="flex-1 pb-4">
            <View className="flex-col justify-center items-center">
              <Image
                source={qrCode}
                contentFit="contain"
                cachePolicy="none"
                className="w-2/5 aspect-square"
              />
              <View className="flex-col gap-2 justify-center items-center mt-2">
                <View className="flex-row items-center gap-1">
                  <Text className="text-sm text-gray-700 dark:text-gray-300">
                    {t('paymentMethod.total')}
                  </Text>
                  <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(total || 0)}
                  </Text>
                </View>
                <View className="flex-row gap-1 items-center px-4">
                  <CircleAlert size={12} color="#3b82f6" />
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    {t('paymentMethod.paymentNote')}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
