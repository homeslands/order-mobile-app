/**
 * Predictive Prefetch — preload data khi user idle.
 * Chạy khi: screen focus, idle time. Không chạy trong transition lock.
 *
 * Routes: Home → banners + menu (sau 2s idle) | Menu → public-specific-menu | Cart → (payment prefetch ở create-order)
 *
 * Phase 6 Task 6: Khi user ở Home 2s, prefetch Menu data để chuyển tab mượt hơn.
 */
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { usePathname } from 'expo-router'
import { useEffect, useMemo, useRef } from 'react'
import { InteractionManager } from 'react-native'

import { getBanners } from '@/api/banner'
import { getPublicSpecificMenu, getSpecificMenu } from '@/api/menu'
import { BannerPage, FILTER_VALUE } from '@/constants'
import { isTransitionLocked } from '@/lib/navigation/transition-lock'
import {
  useAuthStore,
  useBranchStore,
  useMenuFilterStore,
  useUserStore,
} from '@/stores'
import type { ISpecificMenuRequest } from '@/types'

/** Giảm từ 2s → 300ms — user chủ yếu vào Menu, prefetch sớm hơn để giảm cảm giác khựng */
const HOME_IDLE_PREFETCH_MS = 300

export function usePredictivePrefetch() {
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const branchSlug = useBranchStore((s) => s.branch?.slug)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const userSlug = useUserStore((s) => s.userInfo?.slug)
  const filterBranch = useMenuFilterStore((s) => s.menuFilter.branch)
  const filterCatalog = useMenuFilterStore((s) => s.menuFilter.catalog)
  const filterProductName = useMenuFilterStore((s) => s.menuFilter.productName)
  const filterMinPrice = useMenuFilterStore((s) => s.menuFilter.minPrice)
  const filterMaxPrice = useMenuFilterStore((s) => s.menuFilter.maxPrice)
  const filterMenu = useMenuFilterStore((s) => s.menuFilter.menu)
  const hasPrefetchedRef = useRef(false)

  const isOnHome =
    pathname === '/' ||
    pathname === '/(tabs)' ||
    pathname?.startsWith('/(tabs)/home')

  const hasUser = isAuthenticated && !!userSlug
  const hasBranch = !!(filterBranch ?? branchSlug)

  const menuRequest = useMemo<ISpecificMenuRequest>(
    () => ({
      date: dayjs().format('YYYY-MM-DD'),
      branch: filterBranch ?? branchSlug ?? undefined,
      catalog: filterCatalog,
      productName: filterProductName,
      minPrice: filterMinPrice ?? FILTER_VALUE.MIN_PRICE,
      maxPrice: filterMaxPrice ?? FILTER_VALUE.MAX_PRICE,
      slug: filterMenu,
    }),
    [
      filterBranch,
      branchSlug,
      filterCatalog,
      filterProductName,
      filterMinPrice,
      filterMaxPrice,
      filterMenu,
    ],
  )

  // Prefetch ngay khi vào Home (banners) + Menu/Menu khi đang ở Menu
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      if (isTransitionLocked()) return

      if (isOnHome) {
        queryClient.prefetchQuery({
          queryKey: ['banners', BannerPage.HOME],
          queryFn: () => getBanners({ page: BannerPage.HOME, isActive: true }),
        })
        // Prefetch menu ngay khi vào Home — user chủ yếu vào Menu, giảm khựng khi chuyển tab
        if (hasBranch) {
          if (hasUser) {
            queryClient.prefetchQuery({
              queryKey: ['specific-menu', menuRequest],
              queryFn: () => getSpecificMenu(menuRequest),
            })
          } else {
            queryClient.prefetchQuery({
              queryKey: ['public-specific-menu', menuRequest],
              queryFn: () => getPublicSpecificMenu(menuRequest),
            })
          }
        }
      }

      if (pathname?.startsWith('/menu') || pathname?.includes('/(tabs)/menu')) {
        if (hasBranch) {
          if (hasUser) {
            queryClient.prefetchQuery({
              queryKey: ['specific-menu', menuRequest],
              queryFn: () => getSpecificMenu(menuRequest),
            })
          } else {
            queryClient.prefetchQuery({
              queryKey: ['public-specific-menu', menuRequest],
              queryFn: () => getPublicSpecificMenu(menuRequest),
            })
          }
        }
      }
    })
    return () => task.cancel()
  }, [pathname, isOnHome, hasBranch, hasUser, queryClient, menuRequest])

  // Phase 6 Task 6: Prefetch Menu sau 2s idle trên Home
  useEffect(() => {
    if (!isOnHome || !hasBranch) {
      hasPrefetchedRef.current = false
      return
    }

    const timeoutId = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        if (isTransitionLocked()) return
        if (hasPrefetchedRef.current) return
        hasPrefetchedRef.current = true

        if (hasUser) {
          queryClient.prefetchQuery({
            queryKey: ['specific-menu', menuRequest],
            queryFn: () => getSpecificMenu(menuRequest),
          })
        } else {
          queryClient.prefetchQuery({
            queryKey: ['public-specific-menu', menuRequest],
            queryFn: () => getPublicSpecificMenu(menuRequest),
          })
        }
      })
    }, HOME_IDLE_PREFETCH_MS)

    return () => clearTimeout(timeoutId)
  }, [isOnHome, hasBranch, hasUser, queryClient, menuRequest])
}
