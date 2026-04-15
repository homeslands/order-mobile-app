import { IBase } from './base.type'

export interface IBanner extends IBase {
  title: string
  content: string
  url: string
  useButtonUrl: boolean
  image: string
  isActive: boolean
  page: string
}
export interface IBannerRequest {
  isActive: boolean
  page: string
}
export interface ICreateBannerRequest {
  title: string
  content: string
  url: string
  useButtonUrl: boolean
}

export interface IUpdateBannerRequest {
  slug: string
  title: string
  content: string
  url?: string
  useButtonUrl: boolean
  page: string
  image?: string
  isActive?: boolean
}
