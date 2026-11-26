import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  SystemLockFeatureChild,
  SystemLockFeatureGroup,
  SystemLockFeatureType,
} from '@/constants'
import { useGetSystemFeatureFlagsByGroup } from '@/hooks'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'

export interface OrderTypeOptionForUpdate {
  label: string
  value: string
}

export function useOrderTypeOptionsForUpdateOrder() {
  const { t } = useTranslation('menu')
  const setDraftType = useOrderFlowStore((s) => s.setDraftType)
  const currentType = useOrderFlowStore(
    (s) => s.updatingData?.updateDraft?.type,
  )
  const { data: featuresResponse } = useGetSystemFeatureFlagsByGroup(
    SystemLockFeatureGroup.ORDER,
  )

  const featureFlags = useMemo(
    () => featuresResponse?.result || [],
    [featuresResponse?.result],
  )

  const relevantParentFeature = useMemo(() => {
    return featureFlags.find(
      (parent) => parent.name === SystemLockFeatureType.CREATE_PRIVATE,
    )
  }, [featureFlags])

  const orderTypeLockStatus = useMemo(() => {
    const status: Record<string, boolean> = {}
    const children = relevantParentFeature?.children || []
    children.forEach((child) => {
      status[child.name] = child.isLocked
    })
    return status
  }, [relevantParentFeature])

  const orderTypes = useMemo<OrderTypeOptionForUpdate[]>(() => {
    const allTypes: OrderTypeOptionForUpdate[] = [
      { value: OrderTypeEnum.AT_TABLE, label: t('menu.dineIn') },
      { value: OrderTypeEnum.TAKE_OUT, label: t('menu.takeAway') },
    ]

    // Cờ chưa tải xong: hiện đủ loại — đừng giấu giao hàng của đơn giao hàng
    const flagsLoaded = !!featuresResponse
    const hasDeliveryInFeature = relevantParentFeature?.children?.some(
      (child) => child.name === SystemLockFeatureChild.DELIVERY,
    )
    if (!flagsLoaded || hasDeliveryInFeature) {
      allTypes.push({
        value: OrderTypeEnum.DELIVERY,
        label: t('menu.delivery'),
      })
    }

    const orderTypeToFeatureMap: Record<string, string> = {
      [OrderTypeEnum.AT_TABLE]: SystemLockFeatureChild.AT_TABLE,
      [OrderTypeEnum.TAKE_OUT]: SystemLockFeatureChild.TAKE_OUT,
      [OrderTypeEnum.DELIVERY]: SystemLockFeatureChild.DELIVERY,
    }

    return allTypes.filter((type) => {
      const featureKey = orderTypeToFeatureMap[type.value]
      return orderTypeLockStatus[featureKey] !== true
    })
  }, [t, featuresResponse, relevantParentFeature, orderTypeLockStatus])

  const selectedType = useMemo(() => {
    if (currentType) {
      const found = orderTypes.find((type) => type.value === currentType)
      return found || orderTypes[0]
    }
    return orderTypes[0]
  }, [currentType, orderTypes])

  // Không tự đổi loại của đơn đang sửa khi loại đó bị khoá: lúc cờ đang tải
  // danh sách tạm thiếu loại, tự đổi sẽ âm thầm biến đơn giao hàng thành tại
  // bàn. Sheet chỉ không cho chọn loại bị khoá.

  const handleChange = (value: string) => {
    setDraftType(value as OrderTypeEnum)
  }

  return { orderTypes, selectedType, handleChange }
}
