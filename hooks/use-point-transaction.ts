import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query'

import { getPointTransactionAnalysis, getPointTransactions } from '@/api'
import { QUERYKEY } from '@/constants'
import type { IPointTransactionQuery } from '@/types'

export const usePointTransactionsInfinite = (
  params: Omit<IPointTransactionQuery, 'page'>,
) => {
  return useInfiniteQuery({
    queryKey: [
      QUERYKEY.pointTransactions,
      'infinite',
      params.userSlug,
      params.size,
      params.fromDate,
      params.toDate,
      params.type,
    ],
    queryFn: ({ pageParam }) =>
      getPointTransactions({ ...params, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const total = lastPage.result.totalPages ?? 1
      return allPages.length < total ? allPages.length + 1 : undefined
    },
    enabled: !!params.userSlug,
  })
}

export const usePointTransactionAnalysis = (
  userSlug: string | undefined,
  enabled = true,
) => {
  return useQuery({
    queryKey: [QUERYKEY.pointTransactions, 'analysis', userSlug],
    queryFn: () => getPointTransactionAnalysis(userSlug!),
    select: (data) => data.result,
    placeholderData: keepPreviousData,
    enabled: !!userSlug && enabled,
  })
}
