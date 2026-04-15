import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'

const PICKUP_TIME_OPTIONS = [0, 5, 10, 15, 30, 45, 60] as const

export function usePickupTimeForUpdateOrder() {
  const { t } = useTranslation('menu')
  const orderType = useOrderFlowStore((s) => s.updatingData?.updateDraft?.type)
  const pickupTime = useOrderFlowStore(
    (s) =>
      s.updatingData?.updateDraft?.timeLeftTakeOut ??
      s.updatingData?.originalOrder?.timeLeftTakeOut ??
      0,
  )
  const addDraftPickupTime = useOrderFlowStore((s) => s.addDraftPickupTime)

  const shouldRender = orderType === OrderTypeEnum.TAKE_OUT

  const selectedValue = pickupTime.toString()

  const options = useMemo(
    () =>
      PICKUP_TIME_OPTIONS.map((minutes) => ({
        value: minutes.toString(),
        label:
          minutes === 0
            ? t('menu.immediately')
            : `${minutes} ${t('menu.minutes')}`,
      })),
    [t],
  )

  const handleChange = (value: string) => {
    const minutes = parseInt(value, 10)
    addDraftPickupTime(minutes)
  }

  return { shouldRender, selectedValue, options, handleChange }
}
