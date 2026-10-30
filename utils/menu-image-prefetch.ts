type PrefetchRow =
  | { _kind: 'header' }
  | { _kind: 'item'; data: { imageUrl: string | null } }

/**
 * URL ảnh của tối đa `count` món ngay SAU dòng `fromIndex`, đi trên chính mảng
 * dòng của FlashList (có xen dòng tiêu đề danh mục) — chỉ số ô đang hiện của
 * FlashList đếm cả tiêu đề. `fromIndex = -1` là lấy từ đầu. Bỏ tiêu đề, URL
 * rỗng và URL trùng.
 */
export function getAheadImageUrls(
  rows: ReadonlyArray<PrefetchRow>,
  fromIndex: number,
  count: number,
): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  for (let i = fromIndex + 1; i < rows.length && urls.length < count; i += 1) {
    const row = rows[i]
    if (row._kind !== 'item') continue
    const url = row.data.imageUrl
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }
  return urls
}
