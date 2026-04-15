import { keepPreviousData, useMutation, useInfiniteQuery, useQuery } from '@tanstack/react-query'

import {
  applyLoyaltyPoint,
  cancelReservationForOrder,
  getLoyaltyPointHistory,
  getLoyaltyPoints,
} from '@/api'
import { QUERYKEY } from '@/constants'
import { ILoyaltyPointHistoryQuery } from '@/types'

export const useLoyaltyPoints = (q?: string) => {
  return useQuery({
    queryKey: [QUERYKEY.loyaltyPoints, 'total', { slug: q || '' }],
    queryFn: () => {
      if (!q) return Promise.resolve({ result: { totalPoints: 0 } } as never)
      return getLoyaltyPoints(q)
    },
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
