import { useTranslation } from 'react-i18next'

import { Select } from '@/components/ui'
import { cn } from '@/lib/utils'
import { usePickupTimeForUpdateOrder } from '@/hooks/use-pickup-time-for-update-order'

const PICKUP_TIME_OPTIONS = [0, 5, 10, 15, 30, 45, 60] as const

export default function PickupTimeSelectInUpdateOrder() {
  const { t } = useTranslation('menu')
  const { shouldRender, selectedValue, handleChange } = usePickupTimeForUpdateOrder()

  if (!shouldRender) return null

  return (
    <Select onValueChange={handleChange} value={selectedValue}>
      <Select.Trigger
        className={cn(
          'w-full bg-white dark:bg-gray-900',
          !selectedValue && 'highlight-blink-border',
        )}
      >
        <Select.Value placeholder={t('menu.pickupTime')} />
      </Select.Trigger>
      <Select.Content>
        <Select.Group>
          <Select.Label>{t('menu.pickupTime')}</Select.Label>
          {PICKUP_TIME_OPTIONS.map((minutes) => (
            <Select.Item key={minutes} value={minutes.toString()}>
              {minutes === 0
                ? t('menu.immediately')
                : `${minutes} ${t('menu.minutes')}`}
            </Select.Item>
          ))}
        </Select.Group>
      </Select.Content>
    </Select>
  )
}
