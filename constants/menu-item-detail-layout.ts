/**
 * Task 6.1 — Kích thước cố định cho Menu Item Detail.
 * Skeleton và Content thật dùng chung constants → pixel-perfect sync.
 */
export const MENU_ITEM_DETAIL_LAYOUT = {
  /** Padding ngang (px-4) */
  PADDING_X: 16,
  /** Padding top cho section ảnh (pt-4) */
  PADDING_TOP_IMAGES: 16,
  /** Padding dọc cho Product Info (py-6) */
  PADDING_Y_INFO: 24,
  /** Padding bottom cho Related Products (pb-6) */
  PADDING_BOTTOM: 24,
  /** Margin bottom cho image container (mb-2) */
  IMAGE_MARGIN_BOTTOM: 8,
  /** Gap giữa các section (gap-4) */
  GAP_4: 16,
  /** Gap nhỏ (gap-3) */
  GAP_3: 12,
  /** Gap nhỏ hơn (gap-2) */
  GAP_2: 8,
  /** Gap lớn (gap-6) */
  GAP_6: 24,
  /** Chiều cao ảnh sản phẩm liên quan */
  RELATED_PRODUCT_IMAGE_HEIGHT: 112,
  /** Chiều rộng ảnh sản phẩm liên quan (45% screen) — tính tại runtime */
  relatedProductItemWidth: (screenWidth: number) => screenWidth * 0.45,
  /** Khoảng cách giữa các item related */
  RELATED_ITEM_SPACING: 12,
  /** Kích thước image container — screenWidth - 2*PADDING_X */
  imageContainerSize: (screenWidth: number) =>
    screenWidth - MENU_ITEM_DETAIL_LAYOUT.PADDING_X * 2,
} as const
