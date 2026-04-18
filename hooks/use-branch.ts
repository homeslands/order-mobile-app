import { getAllBranches, getBranchInfoForDelivery } from '@/api'
import { useQuery } from '@tanstack/react-query'

export interface UseBranchOptions {
  /** Khi false, không fetch — dùng để defer khi dropdown chưa mở */
  enabled?: boolean
}

/**
 * Hook to fetch all branches
 */
export const useBranch = (options?: UseBranchOptions) => {
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => getAllBranches(),
    enabled,
  })
}

export interface UseGetBranchInfoForDeliveryOptions {
  /** Khi false, không fetch — dùng để defer khi chưa cần (B1). */
  enabled?: boolean
}

const BRANCH_DELIVERY_STALE_MS = 5 * 60 * 1000 // 5 phút — branch config ít thay đổi

export const useGetBranchInfoForDelivery = (
  slug: string,
  options?: UseGetBranchInfoForDeliveryOptions,
) => {
  const enabled = options?.enabled !== false && !!slug
  return useQuery({
    queryKey: ['branchInfoForDelivery', slug],
    queryFn: async () => getBranchInfoForDelivery(slug),
    enabled,
    staleTime: BRANCH_DELIVERY_STALE_MS,
  })
}
