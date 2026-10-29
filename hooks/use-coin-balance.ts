import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getBalance } from '@/api'
import { QUERYKEY } from '@/constants'
import { useUserStore } from '@/stores'

export function useCoinBalance(enabled = true) {
  const userSlug = useUserStore((s) => s.userInfo?.slug)

  const query = useQuery({
    queryKey: [QUERYKEY.profile, 'balance', userSlug],
    queryFn: () => getBalance(userSlug!),
    select: (data) => data.result?.points ?? 0,
    enabled: !!userSlug && enabled,
    placeholderData: keepPreviousData,
  })

  return {
    balance: query.data ?? 0,
    /** false khi chưa có dữ liệu — `balance` lúc đó là 0 giả, không phải số dư thật. */
    hasData: query.data !== undefined,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
