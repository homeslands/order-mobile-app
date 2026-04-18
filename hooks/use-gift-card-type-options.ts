import { useMemo } from 'react'

import { GiftCardFlagGroup } from '@/constants/gift-card.constant'
import { useGetFeatureFlagsByGroup } from '@/hooks/use-feature-lock'
import { GiftCardType } from '@/constants/gift-card.constant'

export function useGiftCardTypeOptions() {
  const { data, isFetched, refetch } = useGetFeatureFlagsByGroup(
    GiftCardFlagGroup.GIFT_CARD,
  )

  const lockMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    ;(data ?? []).forEach((flag) => {
      map[flag.name] = flag.isLocked
    })
    return map
  }, [data])

  // SELF, GIFT, BUY: hiện nếu không bị lock
  const availableTypes = useMemo(
    () =>
      (
        [GiftCardType.SELF, GiftCardType.GIFT, GiftCardType.BUY] as const
      ).filter((t) => lockMap[t] !== true),
    [lockMap],
  )

  // Type đầu tiên available, null = tất cả đều bị lock
  const defaultType:
    | GiftCardType.SELF
    | GiftCardType.GIFT
    | GiftCardType.BUY
    | null = availableTypes[0] ?? null

  return { availableTypes, defaultType, lockMap, isLoaded: isFetched, refetch }
}
