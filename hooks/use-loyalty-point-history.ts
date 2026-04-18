import { useQuery } from '@tanstack/react-query'
import type { ILoyaltyPointHistory } from '@/types'
import type { ILoyaltyPointHistoryQuery } from '@/types/loyalty-point.type'
import {
  LoyaltyPointHistoryType,
  LoyaltyPointTransactionStatus,
} from '@/constants'

const TYPES = [
  LoyaltyPointHistoryType.ADD,
  LoyaltyPointHistoryType.USE,
  LoyaltyPointHistoryType.RESERVE,
  LoyaltyPointHistoryType.REFUND,
]

const STATUS_BY_TYPE: Record<
  LoyaltyPointHistoryType,
  LoyaltyPointTransactionStatus
> = {
  [LoyaltyPointHistoryType.ADD]: LoyaltyPointTransactionStatus.CONFIRMED,
  [LoyaltyPointHistoryType.USE]: LoyaltyPointTransactionStatus.CONFIRMED,
  [LoyaltyPointHistoryType.RESERVE]: LoyaltyPointTransactionStatus.PENDING,
  [LoyaltyPointHistoryType.REFUND]: LoyaltyPointTransactionStatus.CONFIRMED,
}

const MOCK_HISTORY: ILoyaltyPointHistory[] = Array.from(
  { length: 24 },
  (_, i) => {
    const type = TYPES[i % 4]
    return {
      id: `lp-${i + 1}`,
      slug: `lp-${i + 1}`,
      type,
      status: STATUS_BY_TYPE[type],
      points: [50, -30, 20, 10][i % 4] * (i % 3 === 0 ? 2 : 1),
      lastPoints: 1250 - i * 20,
      orderSlug: i % 2 === 0 ? `ORD-${1000 + i}` : '',
      date: new Date(Date.now() - i * 86400000).toISOString(),
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - i * 86400000).toISOString(),
    }
  },
)

/** Stub: trả về lịch sử điểm tích lũy (có phân trang, lọc type). Khi có API thật, thay queryFn. */
export function useLoyaltyPointHistory(params: ILoyaltyPointHistoryQuery) {
  const { page = 1, size = 10, types } = params
  const query = useQuery({
    queryKey: ['loyaltyPointHistory', params.slug, page, size, types],
    queryFn: async () => {
      let list = [...MOCK_HISTORY]
      if (types && types.length > 0) {
        list = list.filter((item) =>
          types.includes(item.type as LoyaltyPointHistoryType),
        )
      }
      const total = list.length
      const start = (page - 1) * size
      const items = list.slice(start, start + size)
      return {
        items,
        totalPages: Math.max(1, Math.ceil(total / size)),
        total,
      }
    },
    enabled: !!params.slug,
  })
  return {
    data: query.data,
    isLoading: query.isPending,
    refetch: query.refetch,
  }
}
