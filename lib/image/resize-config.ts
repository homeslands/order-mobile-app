/** Master kill switch — flip to false to fall back to full-size remote images. */
export const ON_DEVICE_RESIZE_ENABLED = true

/** Max concurrent on-device resizes (bounds CPU during a scroll burst). */
export const RESIZE_CONCURRENCY = 3

/** Max cached thumbnail files before LRU eviction kicks in. */
export const THUMBNAIL_CACHE_MAX = 400

/** JPEG quality for saved thumbnails (0..1). */
export const THUMBNAIL_JPEG_COMPRESS = 0.8

/**
 * Chờ bao lâu (ms) sau ảnh cuối rồi mới ghi chỉ mục xuống MMKV. Ghi là
 * JSON.stringify cả chỉ mục trên JS thread — gộp lại để không làm việc đó sau
 * mỗi ảnh lúc đang cuộn. Mất vài mục khi app bị kill chỉ khiến ảnh resize lại.
 */
export const THUMBNAIL_INDEX_PERSIST_MS = 1000
