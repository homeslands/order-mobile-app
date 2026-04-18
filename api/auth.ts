import {
  IApiResponse,
  IConfirmForgotPasswordRequest,
  IEmailVerificationResponse,
  IInitiateForgotPasswordRequest,
  IInitiateForgotPasswordResponse,
  ILoginRequest,
  ILoginResponse,
  IRefreshTokenResponse,
  IRegisterRequest,
  IResendOTPForgotPasswordRequest,
  IUserInfo,
  IVerifyEmailRequest,
  IVerifyOTPForgotPasswordRequest,
  IVerifyOTPForgotPasswordResponse,
  IVerifyPhoneNumberResponse,
} from '@/types'
import { http } from '@/utils'

export async function login(params: ILoginRequest): Promise<ILoginResponse> {
  const response = await http.post<ILoginResponse>('/auth/login', params)
  return response.data
}

export async function register(
  params: IRegisterRequest,
): Promise<IApiResponse<ILoginResponse>> {
  const response = await http.post<IApiResponse<ILoginResponse>>(
    '/auth/register',
    params,
  )
  return response.data
}

export async function refreshToken(params: {
  refreshToken: string
  accessToken: string
}): Promise<IApiResponse<IRefreshTokenResponse>> {
  const response = await http.post<IApiResponse<IRefreshTokenResponse>>(
    '/auth/refresh',
    params,
  )
  return response.data
}

export async function initiateForgotPassword(
  params: IInitiateForgotPasswordRequest,
): Promise<IApiResponse<IInitiateForgotPasswordResponse>> {
  const response = await http.post<
    IApiResponse<IInitiateForgotPasswordResponse>
  >('/auth/forgot-password/initiate', params)
  return response.data
}

export async function verifyOTPForgotPassword(
  params: IVerifyOTPForgotPasswordRequest,
): Promise<IApiResponse<IVerifyOTPForgotPasswordResponse>> {
  const response = await http.post<
    IApiResponse<IVerifyOTPForgotPasswordResponse>
  >('/auth/forgot-password/confirm', params)
  return response.data
}

export async function resendOTPForgotPassword(
  params: IResendOTPForgotPasswordRequest,
): Promise<IApiResponse<IInitiateForgotPasswordResponse>> {
  const response = await http.post<
    IApiResponse<IInitiateForgotPasswordResponse>
  >('/auth/forgot-password/resend', params)
  return response.data
}

export async function confirmForgotPassword(
  params: IConfirmForgotPasswordRequest,
): Promise<IApiResponse<null>> {
  const response = await http.post<IApiResponse<null>>(
    '/auth/forgot-password/change',
    params,
  )
  return response.data
}

export async function verifyEmail(
  verifyParams: IVerifyEmailRequest,
): Promise<IApiResponse<IEmailVerificationResponse>> {
  const response = await http.post<IApiResponse<IEmailVerificationResponse>>(
    `/auth/initiate-verify-email`,
    verifyParams,
  )
  return response.data
}

export async function verifyPhoneNumber(): Promise<
  IApiResponse<IVerifyPhoneNumberResponse>
> {
  const response = await http.post<IApiResponse<IVerifyPhoneNumberResponse>>(
    `/auth/initiate-verify-phone-number`,
  )
  return response.data
}

export async function confirmEmailVerification(
  code: string,
): Promise<IApiResponse<null>> {
  const response = await http.post<IApiResponse<null>>(
    `/auth/confirm-email-verification/code`,
    { code },
  )
  return response.data
}

export async function confirmPhoneNumberVerification(
  code: string,
): Promise<IApiResponse<null>> {
  const response = await http.post<IApiResponse<null>>(
    `/auth/confirm-phone-number-verification/code`,
    { code },
  )
  return response.data
}

export async function resendEmailVerification(): Promise<
  IApiResponse<IEmailVerificationResponse>
> {
  const response = await http.post<IApiResponse<IEmailVerificationResponse>>(
    `/auth/resend-verify-email`,
  )
  return response.data
}

export async function resendPhoneNumberVerification(): Promise<
  IApiResponse<IVerifyPhoneNumberResponse>
> {
  const response = await http.post<IApiResponse<IVerifyPhoneNumberResponse>>(
    `/auth/resend-verify-phone-number`,
  )
  return response.data
}

export async function uploadAvatar(
  formData: FormData,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.patch<IApiResponse<IUserInfo>>(
    '/auth/upload',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  )
  return response.data
}
