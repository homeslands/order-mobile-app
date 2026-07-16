/**
 * Product image URL — Single source of truth cho Menu và Product Detail.
 * Cùng URI → cùng cache key trong expo-image → không flicker khi navigate.
 *
 * ── Thumbnail / resize (đang CHỜ backend) ─────────────────────────────────────
 * Root cause drop-frame ở list: ảnh serve full-size (tới 1080px) từ S3 thô,
 * KHÔNG resize (`?w=` bị bỏ qua). List hiển thị ~384px nên upload texture GPU
 * lớn ~18× mỗi frame khi cuộn. Chi tiết:
 * docs/tickets/2026-07-15-product-image-thumbnail-resize.md
 *
 * Phần mobile đã wire sẵn: call site truyền `{ maxWidth: IMAGE_PRESET.THUMB }`
 * (ô list) hoặc `IMAGE_PRESET.HERO` (full-screen). Khi backend có endpoint resize
 * (S3 hỗ trợ `?w=`, hoặc imgix/Cloudinary) → **flip 1 chỗ**: RESIZE_SERVICE_READY.
 * Nếu dùng proxy có URL khác (imgproxy/thumbor) thì chỉ sửa hàm build URL bên dưới.
 */
import { publicFileURL } from '@/constants'

/**
 * Flip `true` khi endpoint resize sẵn sàng. Đang `false` → KHÔNG thêm `?w=`
 * (S3 bỏ qua nó, thêm vào chỉ làm đổi cache key → tải lại thừa mà 0 lợi ích).
 */
export const RESIZE_SERVICE_READY = false

/** Preset chiều rộng ảnh (px). THUMB cho ô list, HERO cho full-screen (cap). */
export const IMAGE_PRESET = {
  THUMB: 384,
  HERO: 1080,
} as const

/**
 * @deprecated Dùng `IMAGE_PRESET.HERO`. Giữ để tương thích call site cũ.
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
  const url = `${base.replace(/\/$/, '')}/${raw.replace(/^\//, '')}`

  // Gate resize sau flag — khi chưa có endpoint, trả URL gốc (không đổi cache key).
  if (!RESIZE_SERVICE_READY) return url
  const maxW = options?.maxWidth ?? 0
  if (maxW <= 0) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}w=${maxW}`
}
