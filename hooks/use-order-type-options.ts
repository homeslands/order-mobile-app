import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { SystemLockFeatureChild, SystemLockFeatureGroup, SystemLockFeatureType } from '@/constants'
import { useGetSystemFeatureFlagsByGroup } from '@/hooks'
import { useOrderFlowStore, useUserStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import { useShallow } from 'zustand/react/shallow'

export interface OrderTypeOption {
  label: string
  value: string
}

export interface UseOrderTypeOptionsOptions {
  /** Khi false, không fetch feature flags — defer đến khi cần (B2). Trả về fallback AT_TABLE + TAKE_OUT. */
  enabled?: boolean
}

export function useOrderTypeOptions(options?: UseOrderTypeOptionsOptions) {
  const { t } = useTranslation('menu')
  const setOrderingType = useOrderFlowStore((s) => s.setOrderingType)
  const getCartItems = useOrderFlowStore((s) => s.getCartItems)
  const shouldFetch = options?.enabled !== false
  const { data: featuresSystemFlagsResponse } = useGetSystemFeatureFlagsByGroup(
    SystemLockFeatureGroup.ORDER,
    { enabled: shouldFetch },
  )

  const cartItems = getCartItems()
  // Check if user is logged in
  const userInfo = useUserStore(
    useShallow((s) => s.userInfo)
  )
  const isUserLoggedIn = useMemo(() => {
    return !!userInfo
  }, [userInfo])

  // Wrap featureFlags in useMemo to avoid changing dependencies
  const featureFlags = useMemo(
    () => featuresSystemFlagsResponse?.result || [],
    [featuresSystemFlagsResponse?.result]
  )

  // Lấy parent feature phù hợp với trạng thái logged in
  const relevantParentFeature = useMemo(() => {
    if (isUserLoggedIn) {
      // User đã đăng nhập → lấy CREATE_PRIVATE
      return featureFlags.find((parent) => parent.name === SystemLockFeatureType.CREATE_PRIVATE)
    } else {
      // User chưa đăng nhập → lấy CREATE_PUBLIC
      return featureFlags.find((parent) => parent.name === SystemLockFeatureType.CREATE_PUBLIC)
    }
  }, [featureFlags, isUserLoggedIn])

  // Map children với order types để check trạng thái locked (chỉ từ parent phù hợp)
  const orderTypeLockStatus = useMemo(() => {
    const status: Record<string, boolean> = {}
    const children = relevantParentFeature?.children || []

    children.forEach((child) => {
      status[child.name] = child.isLocked
    })

    return status
  }, [relevantParentFeature])

  const orderTypes = useMemo<OrderTypeOption[]>(() => {
    // Map OrderTypeEnum values to SystemLockFeatureChild keys
    const orderTypeToFeatureMap: Record<string, string> = {
      [OrderTypeEnum.AT_TABLE]: SystemLockFeatureChild.AT_TABLE,
      [OrderTypeEnum.TAKE_OUT]: SystemLockFeatureChild.TAKE_OUT,
    }

    const allTypes: OrderTypeOption[] = [
      {
        value: OrderTypeEnum.AT_TABLE,
        label: t('menu.dineIn'),
      },
      {
        value: OrderTypeEnum.TAKE_OUT,
        label: t('menu.takeAway'),
      },
    ]

    // Lọc bỏ các order type bị locked (isLocked = true)
    const availableTypes = allTypes.filter((type) => {
      const featureKey = orderTypeToFeatureMap[type.value]
      const isLocked = orderTypeLockStatus[featureKey] === true
      return !isLocked
    })

    return availableTypes
  }, [t, orderTypeLockStatus])

  const selectedType = useMemo(() => {
    if (cartItems?.type) {
      const currentType = orderTypes.find((type) => type.value === cartItems.type)
      // Nếu type hiện tại không còn available (đã bị filter), chọn type đầu tiên
      if (!currentType) {
        return orderTypes[0]
      }
      return currentType
    }
    // Chọn type đầu tiên có sẵn
    return orderTypes[0]
  }, [cartItems, orderTypes])

  // Auto switch to available order type if current type is locked or not available
  useEffect(() => {
    const currentType = orderTypes.find((type) => type.value === cartItems?.type)

    // Nếu type hiện tại không tồn tại trong danh sách available types
    if (!currentType && orderTypes.length > 0) {
      setOrderingType(orderTypes[0].value as OrderTypeEnum)
    }
  }, [orderTypes, cartItems?.type, setOrderingType])

  const handleChange = (value: string) => {
    setOrderingType(value as OrderTypeEnum)
  }

  return {
    orderTypes,
    selectedType,
    handleChange,
  }
}

