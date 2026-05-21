import { NotificationMessageCode } from '@/constants'
import { IBase } from './base.type'

export interface IAllNotificationRequest {
  receiver?: string
  isRead?: boolean
  type?: string
  page?: number
  size?: number
}

export interface INotificationMetadata {
  order: string
  chefOrder?: string
  orderType: string
  tableName: string
  table: string // slug of the table
  referenceNumber?: string // Reference number from API/Firebase
  branchName: string
  branch: string // slug of the branch
  createdAt: string
  cardOrder?: string
  cardOrderCode?: string
}

export interface INotification extends IBase {
  message: string
  senderId: string
  receiverId: string
  type: string
  isRead: boolean
  metadata: INotificationMetadata
  /** Server timestamp of when the notification was sent (= when staff pressed call).
   *  Present in FCM payload as sentAt. Undefined for API-hydrated items. */
  sentAt?: string
  /** Device-local fallback when sentAt is absent (older FCM without sentAt field). */
  receivedAt?: string
}

export interface IRegisterDeviceTokenRequest {
  token: string
  platform: string
  userAgent: string
}

export interface IRegisterDeviceTokenResponse extends IBase {
  platform: string
}

export interface PrinterFailNotificationItem {
  isRead: boolean
  slug: string
  message: NotificationMessageCode
  metadata: INotificationMetadata
}

export interface IAllNotificationRequest {
  receiver?: string
  isRead?: boolean
  type?: string
  page?: number
  size?: number
}

export interface INotificationMetadata {
  order: string
  chefOrder?: string
  orderType: string
  tableName: string
  table: string // slug of the table
  referenceNumber?: string // Reference number from API/Firebase
  branchName: string
  branch: string // slug of the branch
  createdAt: string
  cardOrder?: string
  cardOrderCode?: string
}

export interface IRegisterDeviceTokenRequest {
  token: string
  platform: string
  userAgent: string
}

export interface IRegisterDeviceTokenResponse extends IBase {
  platform: string
}

export interface PrinterFailNotificationItem {
  isRead: boolean
  slug: string
  message: NotificationMessageCode
  metadata: INotificationMetadata
}
