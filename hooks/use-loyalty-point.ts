import {
  keepPreviousData,
  useMutation,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query'

import {
  applyLoyaltyPoint,
  cancelReservationForOrder,
  getLoyaltyPointHistory,
  getLoyaltyPoints,
} from '@/api'
import { QUERYKEY } from '@/constants'
import { IApiResponse, ILoyaltyPoint, ILoyaltyPointHistoryQuery } from '@/types'

/**
 * Nguồn duy nhất của key + queryFn cho tổng điểm tích luỹ.
 *
 * Có bốn chỗ ghi vào key này: hook dưới đây, hook barrel ở
 * `use-loyalty-points.ts`, prefetch ngay sau đăng nhập ở
 * `use-post-auth-actions.ts`, và prefetch khi nhấn giữ tab Cá nhân ở
 * `components/navigation/custom-tabs-navigator.tsx`. Không được tự dựng key
 * này ở chỗ nào khác — `__tests__/hooks/loyalty-points-cache.test.tsx` (L4)
 * quét mã nguồn để chặn. React Query lưu đúng giá trị `queryFn` trả về và
 * `select` chỉ chạy lúc đọc, nên cả ba phải ghi CÙNG một dạng — nguyên
 * response — nếu không màn đọc sau sẽ thấy dạng của màn ghi trước và
 * `totalPoints` ra `undefined`.
 */
export function loyaltyPointsTotalQueryOptions(slug: string) {
  return {
    queryKey: [QUERYKEY.loyaltyPoints, 'total', { slug }] as const,
    queryFn: (): Promise<IApiResponse<ILoyaltyPoint>> => getLoyaltyPoints(slug),
  }
}

export const useLoyaltyPoints = (q?: string) => {
  return useQuery({
    ...loyaltyPointsTotalQueryOptions(q ?? ''),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    enabled: !!q,
    meta: { skipGlobalError: true },
  })
}

export const useApplyLoyaltyPoint = () => {
  return useMutation({
    mutationFn: async ({
      orderSlug,
      pointsToUse,
    }: {
      orderSlug: string
      pointsToUse: number
    }) => applyLoyaltyPoint(orderSlug, pointsToUse),
  })
}

export const useCancelReservationForOrder = () => {
  return useMutation({
    mutationFn: async (orderSlug: string) =>
      cancelReservationForOrder(orderSlug),
  })
}

export const useLoyaltyPointHistory = (params: ILoyaltyPointHistoryQuery) => {
  return useQuery({
    queryKey: [
      QUERYKEY.loyaltyPoints,
      'history',
      params.slug,
      params.page,
      params.size,
      params.fromDate,
      params.toDate,
      (params.types || []).join(','),
    ],
    queryFn: () => getLoyaltyPointHistory(params),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    enabled: !!params.slug,
  })
}

export const useLoyaltyPointHistoryInfinite = (
  params: Omit<ILoyaltyPointHistoryQuery, 'page'>,
) => {
  return useInfiniteQuery({
    queryKey: [
      QUERYKEY.loyaltyPoints,
      'history-infinite',
      params.slug,
      params.size,
      params.fromDate,
      params.toDate,
      (params.types || []).join(','),
    ],
    queryFn: ({ pageParam }) =>
      getLoyaltyPointHistory({ ...params, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const total = lastPage.result.totalPages ?? 1
      return allPages.length < total ? allPages.length + 1 : undefined
    },
    enabled: !!params.slug,
  })
}
