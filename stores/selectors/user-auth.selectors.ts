/**
 * User & Auth narrow selectors — giảm re-render cascade giữa các Tab.
 * Chỉ subscribe đúng field cần thiết.
 */
import { useShallow } from 'zustand/react/shallow'

import { useUserStore } from '../user.store'

/** Chỉ avatar display: firstName, lastName, image — cho UserAvatarDropdown */
export const useUserAvatarInfo = () =>
  useUserStore(
    useShallow((s) => {
      const u = s.userInfo
      if (!u) return null
      return {
        firstName: u.firstName,
        lastName: u.lastName,
        image: u.image,
      }
    }),
  )

/** Chỉ có user hay không — cho layout shouldHideBottomBar */
export const useHasUser = () => useUserStore((s) => !!s.userInfo)

/** Chỉ user slug — cho auth check, không re-render khi tên/avatar đổi */
export const useUserSlug = () => useUserStore((s) => s.userInfo?.slug)
