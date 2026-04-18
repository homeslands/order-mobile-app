export interface ISize {
  slug: string
  name: string
  description: string
}

export interface ICreateSizeRequest {
  name: string
  description?: string
}

export interface IUpdateSizeRequest {
  slug: string //Slug of the size
  name: string
  description?: string
}
