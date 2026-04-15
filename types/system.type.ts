import { IBase } from './base.type'

export interface ISystemConfig extends IBase {
  key: string
  value: string
  description: string
  createdAt: string
}

export interface ICreateSystemConfigRequest {
  key: string
  value: string
  description: string
}

export interface IUpdateSystemConfigRequest {
  slug: string
  key: string
  value: string
  description?: string
}

export interface IDeleteSystemConfigRequest {
  slug: string
  key: string
}
