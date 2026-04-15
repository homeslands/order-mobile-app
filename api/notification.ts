import { IApiResponse, IPaginationResponse } from '@/types'
import type { IAllNotificationRequest, INotification } from '@/types/notification.type'
import { http } from '@/utils'

export interface IRegisterDeviceTokenRequest {
  token: string
  platform: 'android' | 'ios' | 'web'
  userAgent: string
}

export interface IUnregisterDeviceTokenRequest {
  token: string
}

export async function registerDeviceToken(
  params: IRegisterDeviceTokenRequest,
): Promise<IApiResponse<unknown>> {
  const response = await http.post<IApiResponse<unknown>>(
    '/notification/firebase/register-device-token',
    params,
  )
  return response.data
}

export async function unregisterDeviceToken(
  params: IUnregisterDeviceTokenRequest,
): Promise<IApiResponse<unknown>> {
  const response = await http.post<IApiResponse<unknown>>(
    '/notification/firebase/unregister-device-token',
    params,
  )
  return response.data
}

export async function getNotifications(
  params: IAllNotificationRequest,
): Promise<IApiResponse<IPaginationResponse<INotification>>> {
  const response = await http.get<IApiResponse<IPaginationResponse<INotification>>>(
    '/notification',
    { params },
  )
  return response.data
}

export async function markNotificationAsRead(
  slug: string,
): Promise<IApiResponse<unknown>> {
  const response = await http.patch<IApiResponse<unknown>>(
    `/notification/${slug}/read`,
  )
  return response.data
}
