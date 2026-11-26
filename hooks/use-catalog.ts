import { catalogQueryOptions } from '@/lib/menu-queries'
import { useQuery } from '@tanstack/react-query'

export interface UseCatalogOptions {
  /** Khi false, không fetch — dùng để defer khi màn chưa cần catalog */
  enabled?: boolean
}

/**
 * Hook to fetch all catalogs
 */
export const useCatalog = (options?: UseCatalogOptions) => {
  const enabled = options?.enabled ?? true
  return useQuery({
    ...catalogQueryOptions(),
    enabled,
  })
}
