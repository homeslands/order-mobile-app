/**
 * Cấu hình FlatList chuẩn production — tránh mount quá nhiều item gây jank.
 * windowSize=3, initialNumToRender=5, maxToRenderPerBatch=2 giảm tải bộ nhớ khi transition.
 * Dùng cho màn có list dài (history, search, …).
 */
export const FLATLIST_PROPS = {
  initialNumToRender: 5,
  maxToRenderPerBatch: 2,
  windowSize: 3,
  updateCellsBatchingPeriod: 50,
  removeClippedSubviews: true,
} as const
