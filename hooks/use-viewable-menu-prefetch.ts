/**
 * Viewable Menu Prefetch — Prefetch Detail data + ảnh cho món đang trong viewport.
 * Dùng onViewableItemsChanged của FlashList để đón đầu hành động user.
 */
import { Image } from 'expo-image'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { getSpecificMenuItem } from '@/api/menu'
import { getProductImageUrl } from '@/utils/product-image-url'

const QUERY_KEY = ['specific-menu-item'] as const
const PREFETCH_LIMIT = 4
const PREFETCH_DEBOUNCE_MS = 150
const PREFETCH_COOLDOWN_MS = 3000

/** Tương thích với FlatMenuItem từ menu/index.tsx */
type ViewableItem = { type: string; id: string; item?: { slug?: string; product?: { slug?: string; image?: string; images?: string[] } } }

function getSlugFromItem(item: ViewableItem): string | null {
  if (item.type !== 'row' || !item.item) return null
  return item.item.slug ?? item.item.product?.slug ?? null
}

export function useViewableMenuPrefetch() {
  const queryClient = useQueryClient()
  const lastPrefetchRef = useRef<Record<string, number>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const prefetchForSlugs = useCallback(
    (slugs: string[]) => {
      const unique = [...new Set(slugs)].slice(0, PREFETCH_LIMIT)

      const now = Date.now()
      unique.forEach((slug) => {
        if (!slug?.trim()) return
        if (now - (lastPrefetchRef.current[slug] ?? 0) < PREFETCH_COOLDOWN_MS) return
        lastPrefetchRef.current[slug] = now

        getSpecificMenuItem(slug)
          .then((res) => {
            queryClient.setQueryData([...QUERY_KEY, slug] as const, res)
            const product = res?.result?.product
            if (!product?.image) return
            const urls: string[] = []
            const main = getProductImageUrl(product.image)
            if (main) urls.push(main)
            product.images?.forEach((img) => {
              const u = getProductImageUrl(img)
              if (u) urls.push(u)
            })
            if (urls.length) Image.prefetch(urls).catch(() => {})
          })
          .catch(() => {})
      })
    },
    [queryClient],
  )

  const onViewableItemsChanged = useCallback(
    (info: { viewableItems: Array<{ item: ViewableItem }> }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const slugs = info.viewableItems
          .map((v) => getSlugFromItem(v.item))
          .filter((s): s is string => !!s)
        prefetchForSlugs(slugs)
        debounceRef.current = null
      }, PREFETCH_DEBOUNCE_MS)
    },
    [prefetchForSlugs],
  )

  // Clear the pending debounce on unmount so a fire-after-unmount doesn't
  // call queryClient.setQueryData / Image.prefetch on a stale closure.
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [])

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
      minimumViewTime: 200,
    }),
    [],
  )

  const viewabilityConfigCallbackPairs = useMemo(
    () => [{ viewabilityConfig, onViewableItemsChanged }],
    [viewabilityConfig, onViewableItemsChanged],
  )

  return { viewabilityConfigCallbackPairs }
}
