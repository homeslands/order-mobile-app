import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueries } from '@tanstack/react-query'

import {
  extractMenuItems,
  getPublicSpecificMenu,
  getSpecificMenu,
} from '@/api/menu'
import type { ISpecificMenuRequest } from '@/types'

/**
 * Per-catalog progressive menu loader. Issues one query per catalog (via
 * useQueries) and loads catalogs in batches — so the catalog-grouped list never
 * reshuffles and each catalog's data stays contiguous.
 */
export function useCatalogMenuPages(opts: {
  catalogSlugs: string[]
  request: ISpecificMenuRequest
  hasUser: boolean
  enabled: boolean
  batch: number
}) {
  const { catalogSlugs, request, hasUser, enabled, batch } = opts

  // Reset how many catalogs are loaded whenever the catalog set OR batch size
  // changes (filter switch / search toggle). Render-phase reset pattern.
  const [loadedCount, setLoadedCount] = useState(batch)
  const [prevKey, setPrevKey] = useState<string | null>(null)
  const resetKey = `${catalogSlugs.join(',')}|${batch}`
  if (prevKey !== resetKey) {
    setPrevKey(resetKey)
    setLoadedCount(batch)
  }

  const slugs = useMemo(
    () => catalogSlugs.slice(0, loadedCount),
    [catalogSlugs, loadedCount],
  )
  const fetcher = hasUser ? getSpecificMenu : getPublicSpecificMenu
  const keyRoot = hasUser ? 'specific-menu' : 'public-specific-menu'

  const results = useQueries({
    queries: slugs.map((slug) => {
      const q: ISpecificMenuRequest = { ...request, catalog: slug }
      return {
        queryKey: [keyRoot, q],
        queryFn: () => fetcher(q),
        enabled,
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnMount: false,
        meta: { skipGlobalErrorCodes: [401, 403] },
      }
    }),
  })

  // Recompute the flat list only when the per-catalog data signature changes
  // (dataUpdatedAt per query — count is implied by the joined string). A single
  // stable string dep avoids the variable-length-deps hazard and keeps the array
  // identity stable while data is unchanged, so itemsRaw / flatItems / FlashList
  // data do not churn.
  const dataSignature = results.map((r) => r.dataUpdatedAt).join(',')
  const menuItems = useMemo(
    () => results.flatMap((r) => extractMenuItems(r.data?.result)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataSignature],
  )

  const isLoading = results.length > 0 && results.every((r) => r.isPending)
  const isLoadingMore = !isLoading && results.some((r) => r.isPending)
  const hasMore = loadedCount < catalogSlugs.length
  const loadMore = useCallback(() => {
    setLoadedCount((c) => Math.min(c + batch, catalogSlugs.length))
  }, [batch, catalogSlugs.length])

  // Stable refetch: read the latest results from a ref updated in an effect, so
  // the callback identity never changes (safe for the caller to depend on).
  const resultsRef = useRef(results)
  useEffect(() => {
    resultsRef.current = results
  })
  const refetchAll = useCallback(
    () => Promise.all(resultsRef.current.map((r) => r.refetch())),
    [],
  )

  return { menuItems, isLoading, isLoadingMore, hasMore, loadMore, refetchAll }
}
