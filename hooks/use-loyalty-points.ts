import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { loyaltyPointsTotalQueryOptions } from './use-loyalty-point'

/** Hook: lấy tổng điểm tích luỹ thật cho user (ILoyaltyPoint.totalPoints). */
export function useLoyaltyPoints(
  slug: string | undefined,
  /** Defer fetch: chỉ bật khi screen đã sẵn sàng (useRunAfterTransition). */
  enabledOverride?: boolean,
) {
  const query = useQuery({
    ...loyaltyPointsTotalQueryOptions(slug ?? ''),
    // Cache giữ nguyên response (xem loyaltyPointsTotalQueryOptions); bóc
    // `.result` ở đây, lúc đọc, chứ không ở queryFn.
    select: (data) => data.result,
    enabled: !!slug && (enabledOverride ?? true),
    placeholderData: keepPreviousData,
  })

  return {
    totalPoints: query.data?.totalPoints ?? 0,
    /** false khi chưa có dữ liệu — `totalPoints` lúc đó là 0 giả. */
    hasData: query.data !== undefined,
    isLoading: query.isPending,
    refetch: query.refetch,
  }
}
