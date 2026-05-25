import {
  completeRegistration,
  confirmEmailVerification,
  confirmForgotPassword,
  confirmPhoneNumberVerification,
  deleteAccount,
  initiateForgotPassword,
  initiateRegistration,
  login,
  resendEmailVerification,
  resendOTPForgotPassword,
  resendPhoneNumberVerification,
  resendRegistration,
  updateLanguage,
  uploadAvatar,
  verifyEmail,
  verifyOTPForgotPassword,
  verifyPhoneNumber,
} from '@/api'
import {
  ICompleteRegistrationRequest,
  IConfirmForgotPasswordRequest,
  IInitiateForgotPasswordRequest,
  ILoginRequest,
  IResendOTPForgotPasswordRequest,
  IVerifyEmailRequest,
  IVerifyOTPForgotPasswordRequest,
} from '@/types'
import { useMutation } from '@tanstack/react-query'

export const useLogin = () => {
  return useMutation({
    mutationFn: async (data: ILoginRequest) => {
      const response = await login(data)
      return response
    },
  })
}

export const useInitiateRegistration = () =>
  useMutation({
    mutationFn: (phonenumber: string) => initiateRegistration(phonenumber),
    meta: { skipGlobalError: true },
  })

export const useResendRegistration = () =>
  useMutation({
    mutationFn: (phonenumber: string) => resendRegistration(phonenumber),
    meta: { skipGlobalError: true },
  })

export const useCompleteRegistration = () =>
  useMutation({
    mutationFn: (params: ICompleteRegistrationRequest) =>
      completeRegistration(params),
    meta: { skipGlobalError: true },
  })

export const useInitiateForgotPassword = () => {
  return useMutation({
    mutationFn: async (params: IInitiateForgotPasswordRequest) => {
      return initiateForgotPassword(params)
    },
    meta: { skipGlobalError: true },
  })
}

export const useVerifyOTPForgotPassword = () => {
  return useMutation({
    mutationFn: async (params: IVerifyOTPForgotPasswordRequest) => {
      return verifyOTPForgotPassword(params)
    },
    meta: { skipGlobalError: true },
  })
}

export const useResendOTPForgotPassword = () => {
  return useMutation({
    mutationFn: async (params: IResendOTPForgotPasswordRequest) => {
      return resendOTPForgotPassword(params)
    },
    meta: { skipGlobalError: true },
  })
}

export const useConfirmForgotPassword = () => {
  return useMutation({
    mutationFn: async (params: IConfirmForgotPasswordRequest) => {
      return confirmForgotPassword(params)
    },
    meta: { skipGlobalError: true },
  })
}

export const useVerifyEmail = () => {
  return useMutation({
    mutationFn: async (data: IVerifyEmailRequest) => {
      return verifyEmail(data)
    },
    meta: { skipGlobalError: true },
  })
}

export const useVerifyPhoneNumber = () => {
  return useMutation({
    mutationFn: async () => {
      return verifyPhoneNumber()
    },
    meta: { skipGlobalError: true },
  })
}

export const useConfirmPhoneNumberVerification = () => {
  return useMutation({
    mutationFn: async (code: string) => {
      return confirmPhoneNumberVerification(code)
    },
  })
}

export const useResendPhoneNumberVerification = () => {
  return useMutation({
    mutationFn: async () => {
      return resendPhoneNumberVerification()
    },
  })
}

export const useConfirmEmailVerification = () => {
  return useMutation({
    mutationFn: async (code: string) => {
      return confirmEmailVerification(code)
    },
  })
}

export const useResendEmailVerification = () => {
  return useMutation({
    mutationFn: async () => {
      return resendEmailVerification()
    },
    meta: { skipGlobalError: true },
  })
}

export const useUploadAvatar = () => {
  return useMutation({
    mutationFn: async (formData: FormData) => {
      return uploadAvatar(formData)
    },
  })
}

export const useUpdateLanguage = () => {
  return useMutation({
    mutationFn: async ({
      userSlug,
      language,
    }: {
      userSlug: string
      language: string
    }) => {
      return updateLanguage(userSlug, language)
    },
  })
}

export const useDeleteAccount = () => {
  return useMutation({
    mutationFn: async (password: string) => {
      return deleteAccount(password)
    },
  })
}
