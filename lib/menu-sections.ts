/**
 * Dựng các dòng của danh sách Menu: chế độ "Tất cả" xếp món theo nhóm danh
 * mục (theo thứ tự danh sách danh mục), mỗi nhóm có dòng tiêu đề kèm số món;
 * trả kèm chỉ số dòng tiêu đề để FlashList ghim tiêu đề khi cuộn.
 * Đang lọc / tìm kiếm thì trả danh sách phẳng.
 */
type CatalogItem = { menuItem: { product: { catalog?: { slug: string } } } }

export type MenuSectionRow<T> =
  | { _kind: 'header'; key: string; name: string; count: number }
  | { _kind: 'item'; data: T }

export function buildMenuSections<T extends CatalogItem>(
  items: T[],
  catalogs: { slug: string; name: string }[],
  grouped: boolean,
): { rows: MenuSectionRow<T>[]; stickyHeaderIndices: number[] } {
  if (!grouped || catalogs.length === 0) {
    return {
      rows: items.map((data) => ({ _kind: 'item' as const, data })),
      stickyHeaderIndices: [],
    }
  }
  const byCatalog = new Map<string, T[]>()
  const uncategorized: T[] = []
  for (const data of items) {
    const slug = data.menuItem.product.catalog?.slug
    if (!slug) {
      uncategorized.push(data)
      continue
    }
    const bucket = byCatalog.get(slug)
    if (bucket) bucket.push(data)
    else byCatalog.set(slug, [data])
  }
  const rows: MenuSectionRow<T>[] = []
  const stickyHeaderIndices: number[] = []
  for (const cat of catalogs) {
    const bucket = byCatalog.get(cat.slug)
    if (!bucket?.length) continue
    stickyHeaderIndices.push(rows.length)
    rows.push({
      _kind: 'header',
      key: `header-${cat.slug}`,
      name: cat.name,
      count: bucket.length,
    })
    for (const data of bucket) rows.push({ _kind: 'item', data })
  }
  for (const data of uncategorized) rows.push({ _kind: 'item', data })
  return { rows, stickyHeaderIndices }
}
