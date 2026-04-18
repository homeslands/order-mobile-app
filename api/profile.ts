import { IApiResponse, IUserInfo } from '@/types'
import { http } from '@/utils'

export async function getProfile(): Promise<IApiResponse<IUserInfo>> {
  const response = await http.get<IApiResponse<IUserInfo>>('/auth/profile')
  return response.data
}

export type UpdateProfilePayload = {
  firstName?: string
  lastName?: string
  address?: string
  dob?: string
}

export async function updateProfile(
  payload: UpdateProfilePayload,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.patch<IApiResponse<IUserInfo>>(
    '/auth/profile',
    payload,
  )
  return response.data
}

export type ChangePasswordPayload = {
  oldPassword: string
  newPassword: string
}

export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<IApiResponse<null>> {
  const response = await http.patch<IApiResponse<null>>(
    '/auth/change-password',
    payload,
  )
  return response.data
}
