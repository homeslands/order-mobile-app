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
}

export interface INotification extends IBase {
  message: string
  senderId: string
  receiverId: string
  type: string
  isRead: boolean
  metadata: INotificationMetadata
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

