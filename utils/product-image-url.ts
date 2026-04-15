/**
 * Product image URL — Single source of truth cho Menu và Product Detail.
 * Cùng URI → cùng cache key trong expo-image → không flicker khi navigate.
 *
 * Downsampling: Nếu backend hỗ trợ ?w= (imgix, Cloudinary, ...), set PRODUCT_IMAGE_MAX_WIDTH.
 */
import { publicFileURL } from '@/constants'

/**
 * Downsampling: Set giá trị > 0 nếu backend hỗ trợ ?w= (imgix, Cloudinary, WordPress+Jetpack...).
 * Mặc định 0 = không thêm param, load ảnh gốc.
 */
export const PRODUCT_IMAGE_MAX_WIDTH_DETAIL = 0

export function getProductImageUrl(
  imagePath: string | null | undefined,
  options?: { maxWidth?: number },
): string | null {
  const raw = imagePath?.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  const base = publicFileURL ?? ''
  if (!base) return null
  let url = `${base.replace(/\/$/, '')}/${raw.replace(/^\//, '')}`
  const maxW = options?.maxWidth ?? PRODUCT_IMAGE_MAX_WIDTH_DETAIL
  if (maxW > 0) {
    const sep = url.includes('?') ? '&' : '?'
    url += `${sep}w=${maxW}`
  }
  return url
}
