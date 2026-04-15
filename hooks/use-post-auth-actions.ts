/**
 * usePostAuthActions — shared post-login/register logic.
 *
 * Sau khi login hoặc register thành công, cả hai đều cần:
 * 1. Lưu tokens vào authStore
 * 2. Fetch user profile
 * 3. Lưu userInfo vào userStore
 * 4. Prefetch loyalty points (0ms render ở Profile)
 * 5. Navigate về home
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { getLoyaltyPoints } from '@/api/loyalty-point'
import { BannerPage, QUERYKEY, Role } from '@/constants'
import { useProfile } from '@/hooks/use-profile'
import { navigateNative } from '@/lib/navigation'
import { useMasterTransitionOptional } from '@/lib/navigation/master-transition-provider'
import { useAuthStore, useUserStore } from '@/stores'
import { useShallow } from 'zustand/react/shallow'

export interface ITokenPayload {
  accessToken: string
  refreshToken: string
  expireTime: string
  expireTimeRefreshToken: string
}

export function usePostAuthActions() {
  const queryClient = useQueryClient()
  const masterTransition = useMasterTransitionOptional()

  const { setToken, setRefreshToken, setExpireTime, setExpireTimeRefreshToken, setLogout } =
    useAuthStore(
      useShallow((s) => ({
        setToken: s.setToken,
        setRefreshToken: s.setRefreshToken,
        setExpireTime: s.setExpireTime,
        setExpireTimeRefreshToken: s.setExpireTimeRefreshToken,
        setLogout: s.setLogout,
      })),
    )

  const { setUserInfo, removeUserInfo } = useUserStore(
    useShallow((s) => ({
      setUserInfo: s.setUserInfo,
      removeUserInfo: s.removeUserInfo,
    })),
  )

  const { refetch: refetchProfile } = useProfile()

  const navigateToHome = useCallback(() => {
    const homeCached = !!queryClient.getQueryData(['banners', BannerPage.HOME])
    const overlayMs = homeCached ? 100 : 250
    masterTransition?.showLoadingFor(overlayMs)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        navigateNative.replace('/(tabs)/home')
      })
    })
  }, [queryClient, masterTransition])

  /**
   * Gọi sau khi nhận được tokens từ API login/register.
   * onSuccess callback tuỳ chọn — mặc định navigate về home.
   * Throws error nếu profile check fails — form error handler sẽ catch.
   */
  const handleAuthSuccess = useCallback(
    async (tokens: ITokenPayload, onSuccess?: () => void) => {
      // 1. Lưu tokens
      setToken(tokens.accessToken)
      setRefreshToken(tokens.refreshToken)
      setExpireTime(tokens.expireTime)
      setExpireTimeRefreshToken(tokens.expireTimeRefreshToken)

      // 2. Fetch profile (cần token đã được lưu ở bước trên)
      const profile = await refetchProfile()
      const profileResult = profile.data?.result

      if (!profileResult) {
        setLogout()
        removeUserInfo()
        throw new Error('Failed to fetch user profile')
      }

      // 3. Chặn tài khoản không phải CUSTOMER
      if (profileResult.role?.name !== Role.CUSTOMER) {
        setLogout()
        removeUserInfo()
        throw new Error('Tài khoản không có quyền truy cập ứng dụng này')
      }

      // 4. Lưu user info + slug
      setUserInfo(profileResult)
      useAuthStore.getState().setSlug(profileResult.slug)

      // 5. Prefetch loyalty points để Profile render từ cache
      if (profileResult.slug) {
        await queryClient.prefetchQuery({
          queryKey: [QUERYKEY.loyaltyPoints, 'total', { slug: profileResult.slug }],
          queryFn: () => getLoyaltyPoints(profileResult.slug),
        })
      }

      // 6. Navigate
      if (onSuccess) {
        onSuccess()
      } else {
        navigateToHome()
      }
    },
    [
      setToken,
      setRefreshToken,
      setExpireTime,
      setExpireTimeRefreshToken,
      setLogout,
      setUserInfo,
      removeUserInfo,
      refetchProfile,
      queryClient,
      navigateToHome,
    ],
  )

  return { handleAuthSuccess, navigateToHome }
}
