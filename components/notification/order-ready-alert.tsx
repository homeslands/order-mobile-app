import { ShoppingBag } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { Button, Dialog } from '@/components/ui'
import { colors } from '@/constants'

interface OrderReadyAlertProps {
  visible: boolean
  orderSlug: string | null
  branchName: string
  referenceNumber: string
  isDark: boolean
  onViewOrder: () => void
  onClose: () => void
}

export function OrderReadyAlert({
  visible,
  orderSlug,
  branchName,
  referenceNumber,
  isDark,
  onViewOrder,
  onClose,
}: OrderReadyAlertProps) {
  const { t } = useTranslation('notification')

  const ref = referenceNumber ? `#${referenceNumber}` : orderSlug ? `#${orderSlug}` : ''
  const body = branchName
    ? t('alertOrderReadyBody', { ref, branch: branchName })
    : t('alertOrderReadyBodyNoBranch', { ref })

  const iconColor = isDark ? colors.primary.dark : colors.primary.light
  const bodyColor = isDark ? colors.gray[200] : colors.gray[700]

  return (
    <Dialog open={visible} onOpenChange={() => {}}>
      <Dialog.Content className="max-w-[22rem] rounded-2xl sm:max-w-[32rem]">
        <Dialog.Header>
          <Dialog.Title className="flex flex-row items-center gap-2">
            <ShoppingBag size={20} color={iconColor} />
            <Text style={s.title}>{t('alertOrderReadyTitle')}</Text>
          </Dialog.Title>
          <Dialog.Description>
            <Text style={[s.body, { color: bodyColor }]}>{body}</Text>
          </Dialog.Description>
        </Dialog.Header>

        <Dialog.Footer className="mt-4 flex flex-row gap-2 justify-end">
          <Button variant="outline" onPress={onClose}>
            {t('alertOrderReadyClose')}
          </Button>
          {orderSlug ? (
            <Button variant="default" onPress={onViewOrder}>
              {t('alertOrderReadyViewOrder')}
            </Button>
          ) : null}
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  )
}

const s = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
})
