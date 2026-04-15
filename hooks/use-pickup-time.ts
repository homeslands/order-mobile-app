import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'

const PICKUP_TIME_OPTIONS = [0, 5, 10, 15, 30, 45, 60] as const

export interface PickupTimeOption {
  label: string
  value: string
}

export interface UsePickupTimeResult {
  shouldRender: boolean
  selectedValue: string
  options: PickupTimeOption[]
  handleChange: (value: string) => void
}

export function usePickupTime(defaultValue?: number, onPickupTimeSelect?: (minutes: number) => void): UsePickupTimeResult {
  const { t } = useTranslation('menu')
  const orderType = useOrderFlowStore((s) => s.orderingData?.type)
  const storedTimeLeftTakeOut = useOrderFlowStore((s) => s.orderingData?.timeLeftTakeOut)
  const addPickupTime = useOrderFlowStore((s) => s.addPickupTime)
  const [userSelectedTime, setUserSelectedTime] = useState<string | undefined>()

  const shouldRender = orderType === OrderTypeEnum.TAKE_OUT

  // Derive selectedTime from props/cart, with user selection taking precedence
  const selectedValue = useMemo(() => {
    if (userSelectedTime !== undefined) return userSelectedTime
    if (defaultValue !== undefined) return defaultValue.toString()
    if (storedTimeLeftTakeOut !== undefined) {
      return storedTimeLeftTakeOut.toString()
    }
    return '0'
  }, [userSelectedTime, defaultValue, storedTimeLeftTakeOut])

  // Initialize pickup time if not set
  useEffect(() => {
    if (
      defaultValue === undefined &&
      storedTimeLeftTakeOut === undefined &&
      userSelectedTime === undefined &&
      orderType === OrderTypeEnum.TAKE_OUT
    ) {
      addPickupTime(0)
    }
  }, [defaultValue, storedTimeLeftTakeOut, orderType, userSelectedTime, addPickupTime])

  const options = useMemo<PickupTimeOption[]>(() => {
    return PICKUP_TIME_OPTIONS.map((minutes) => ({
      value: minutes.toString(),
      label:
        minutes === 0
          ? t('menu.immediately')
          : `${minutes} ${t('menu.minutes')}`,
    }))
  }, [t])

  const handleChange = useCallback(
    (value: string) => {
      const minutes = parseInt(value, 10)
      setUserSelectedTime(value)
      addPickupTime(minutes)
      onPickupTimeSelect?.(minutes)
    },
    [addPickupTime, onPickupTimeSelect],
  )

  return {
    shouldRender,
    selectedValue,
    options,
    handleChange,
  }
}


