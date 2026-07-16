/**
 * Predictive Prefetch — preload data khi user idle.
 * Chạy khi: screen focus, idle time. Không chạy trong transition lock.
 *
 * Routes: Home → banners + giftcards | Cart → (payment prefetch ở create-order)
 *
 * Menu prefetch removed: Menu tab now fetches per-catalog via `useQueries`
 * (queryKey ['specific-menu', { ...request, catalog: slug }]) — this hook
 * has no catalog list to build a matching key against, so a single-key
 * prefetch here would just populate an entry the Menu screen never reads.
 */
import { useQueryClient } from '@tanstack/react-query'
import { usePathname } from 'expo-router'
import { useEffect } from 'react'
import { InteractionManager } from 'react-native'

import { getBanners } from '@/api/banner'
import { getGiftCards } from '@/api/gift-card'
import { BannerPage, QUERYKEY } from '@/constants'
import { isTransitionLocked } from '@/lib/navigation/transition-lock'
import { useAuthStore, useUserStore } from '@/stores'

export function usePredictivePrefetch() {
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const userSlug = useUserStore((s) => s.userInfo?.slug)

  const isOnHome =
    pathname === '/' ||
    pathname === '/(tabs)' ||
    pathname?.startsWith('/(tabs)/home')

  const hasUser = isAuthenticated && !!userSlug

  // Prefetch ngay khi vào Home (banners + giftcards)
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      if (isTransitionLocked()) return

      if (isOnHome) {
        queryClient.prefetchQuery({
          queryKey: [
            QUERYKEY.banners,
            { page: BannerPage.HOME, isActive: true },
          ],
          queryFn: () => getBanners({ page: BannerPage.HOME, isActive: true }),
        })
        if (hasUser) {
          queryClient.prefetchQuery({
            queryKey: [QUERYKEY.giftCards, undefined],
            queryFn: () => getGiftCards(),
          })
        }
      }
    })
    return () => task.cancel()
  }, [isOnHome, hasUser, queryClient])
}
