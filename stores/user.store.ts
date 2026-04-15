import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { IUserInfo, IUserStore } from '@/types'
import { createSafeStorage } from '@/utils/storage'
import { useGiftCardStore } from './gift-card.store'

export const useUserStore = create<IUserStore>()(
  persist(
    (set, get) => ({
      userInfo: null,
      deviceToken: null,
      setDeviceToken: (deviceToken: string) => {
        set({ deviceToken })
      },
      getDeviceToken: () => get().deviceToken,
      emailVerificationStatus: null,
      phoneNumberVerificationStatus: null,
      isVerifyingPhoneNumber: false,
      isVerifyingEmail: false,
      setUserInfo: (userInfo: IUserInfo) => {
        set({ userInfo })
      },
      getUserInfo: () => get().userInfo,
      removeUserInfo: () => {
        set({ userInfo: null })
        useGiftCardStore.getState().clearGiftCard(false)
      },
      setIsVerifyingEmail: (isVerifyingEmail: boolean) =>
        set({ isVerifyingEmail }),
      setIsVerifyingPhoneNumber: (isVerifyingPhoneNumber: boolean) =>
        set({ isVerifyingPhoneNumber }),
      getIsVerifyingEmail: () => get().isVerifyingEmail,
      getIsVerifyingPhoneNumber: () => get().isVerifyingPhoneNumber,
      setEmailVerificationStatus: (
        emailVerificationStatus: {
          expiresAt: string // ISO string timestamp when OTP expires
          slug?: string // verification slug from response
        } | null,
      ) => set({ emailVerificationStatus }),
      setPhoneNumberVerificationStatus: (
        phoneNumberVerificationStatus: {
          expiresAt: string // ISO string timestamp when OTP expires
          slug?: string // verification slug from response
        } | null,
      ) => set({ phoneNumberVerificationStatus }),
      getEmailVerificationStatus: () => get().emailVerificationStatus,
      getPhoneNumberVerificationStatus: () =>
        get().phoneNumberVerificationStatus,
      clearUserData: () => {
        set({
          userInfo: null,
          deviceToken: null, // Clear device token when logout
          emailVerificationStatus: null,
          phoneNumberVerificationStatus: null,
          isVerifyingEmail: false,
          isVerifyingPhoneNumber: false,
        })
      },
    }),

    {
      name: 'user-info',
      storage: createJSONStorage(() => createSafeStorage()),
    },
  ),
)
