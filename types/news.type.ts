export type ContentBlockType = 'heading' | 'paragraph' | 'image'

export interface ContentBlock {
  type: ContentBlockType
  content?: string // for heading and paragraph
  imageUrl?: string // for image
  level?: number // for heading (2, 3, etc.)
}

export interface NewsArticle {
  id: string
  slug: string
  title: string
  summary: string // Preview content for list/carousel
  thumbnail: string
  publishDate: string
}

export interface NewsArticleDetail extends NewsArticle {
  contentBlocks: ContentBlock[]
}

