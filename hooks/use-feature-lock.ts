import { keepPreviousData, useQuery } from '@tanstack/react-query'

import {
  getSystemFeatureFlagsByGroup,
  getFeatureFlagsByGroup,
} from '@/api'
import { QUERYKEY } from '@/constants'

export interface UseGetSystemFeatureFlagsByGroupOptions {
  /** Khi false, không fetch — defer đến khi cần (B2). */
  enabled?: boolean
}

export const useGetSystemFeatureFlagsByGroup = (
  groupName: string,
  options?: UseGetSystemFeatureFlagsByGroupOptions,
) => {
  const enabled = options?.enabled !== false && !!groupName
  return useQuery({
    queryKey: [QUERYKEY.systemFeatureFlagsByGroup, groupName],
    queryFn: () => getSystemFeatureFlagsByGroup(groupName),
    placeholderData: keepPreviousData,
    enabled,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  })
}

export const useGetFeatureFlagsByGroup = (group: string) => {
  return useQuery({
    queryKey: [QUERYKEY.giftCardFeatureFlags, group],
    queryFn: () => getFeatureFlagsByGroup(group),
    select: (data) => data.result,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
}
