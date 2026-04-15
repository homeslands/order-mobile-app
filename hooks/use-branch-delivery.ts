import { useTranslation } from 'react-i18next'

import { useGetBranchInfoForDelivery } from './use-branch'

export interface UseCalculateDeliveryFeeOptions {
  /** Khi false, không fetch branch info — defer đến khi cần (B1). */
  enabled?: boolean
}

/**
 * Tính phí giao hàng dựa trên khoảng cách và thông tin branch.
 *
 * @see docs/IMPLEMENTATION_TASKS.md T-503
 */
export function useCalculateDeliveryFee(
  distance: number,
  branchSlug: string,
  options?: UseCalculateDeliveryFeeOptions,
) {
  const { t } = useTranslation('menu')
  const shouldFetch =
    options?.enabled !== false && !!branchSlug
  const {
    data: branchInfo,
    isLoading,
    error,
  } = useGetBranchInfoForDelivery(branchSlug, { enabled: shouldFetch })

  if (!shouldFetch) {
    return { deliveryFee: 0, isLoading: false, error: null }
  }

  if (isLoading) {
    return { deliveryFee: 0, isLoading: true, error: null }
  }

  if (error) {
    return { deliveryFee: 0, isLoading: false, error }
  }

  if (!branchInfo?.result) {
    return {
      deliveryFee: 0,
      isLoading: false,
      error: new Error('Branch info not found'),
    }
  }

  const { maxDistanceDelivery, deliveryFeePerKm } = branchInfo.result

  if (distance > maxDistanceDelivery) {
    return {
      deliveryFee: 0,
      isLoading: false,
      error: new Error(t('cart.deliveryAddressNote')),
    }
  }

  const deliveryFee = distance * deliveryFeePerKm
  return { deliveryFee, isLoading: false, error: null }
}

/**
 * Lấy max distance và fee per km từ branch delivery info.
 *
 * @see docs/IMPLEMENTATION_TASKS.md T-503
 */
export function useGetBranchDeliveryConfig(branchSlug: string) {
  const {
    data: branchInfo,
    isLoading,
    error,
  } = useGetBranchInfoForDelivery(branchSlug)

  if (isLoading) {
    return { maxDistance: 0, feePerKm: 0, isLoading: true, error: null }
  }

  if (error) {
    return { maxDistance: 0, feePerKm: 0, isLoading: false, error }
  }

  if (!branchInfo?.result) {
    return {
      maxDistance: 0,
      feePerKm: 0,
      isLoading: false,
      error: new Error('Branch info not found'),
    }
  }

  const { maxDistanceDelivery, deliveryFeePerKm } = branchInfo.result

  return {
    maxDistance: maxDistanceDelivery,
    feePerKm: deliveryFeePerKm,
    isLoading: false,
    error: null,
  }
}
