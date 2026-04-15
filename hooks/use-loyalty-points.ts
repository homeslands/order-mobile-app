import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getLoyaltyPoints } from '@/api/loyalty-point'
import { QUERYKEY } from '@/constants'

/** Hook: lấy tổng điểm tích luỹ thật cho user (ILoyaltyPoint.totalPoints). */
export function useLoyaltyPoints(
  slug: string | undefined,
  /** Defer fetch: chỉ bật khi screen đã sẵn sàng (useRunAfterTransition). */
  enabledOverride?: boolean,
) {
  const query = useQuery({
    queryKey: [QUERYKEY.loyaltyPoints, 'total', { slug: slug || '' }],
    queryFn: async () => {
      if (!slug) return { totalPoints: 0 }
      const response = await getLoyaltyPoints(slug)
      return response.result
    },
    enabled: !!slug && (enabledOverride ?? true),
    placeholderData: keepPreviousData,
  })

  return {
    totalPoints: query.data?.totalPoints ?? 0,
    isLoading: query.isPending,
    refetch: query.refetch,
  }
}
