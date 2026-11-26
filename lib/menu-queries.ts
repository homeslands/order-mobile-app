/**
 * Cấu hình truy vấn Menu dùng chung cho màn Menu và việc tải trước từ Home.
 *
 * Tải trước Menu từ Home từng bị gỡ vì ghi vào khoá Menu không đọc. Mọi nơi
 * dựng tham số và khoá Menu đều đi qua đây, nên dữ liệu tải trước nằm đúng chỗ
 * màn Menu sẽ đọc.
 */
import type { QueryClient } from '@tanstack/react-query'

import { getAllBranches, getCatalog } from '@/api'
import {
  buildSpecificMenuRequest,
  getPublicSpecificMenu,
  getSpecificMenu,
} from '@/api/menu'
import { QUERYKEY } from '@/constants'
import { MENU_QUERY_SKIP_CODES } from '@/lib/global-error-gate'
import type { IMenuFilter, ISpecificMenuRequest } from '@/types'
import { getLocalDateString } from '@/utils/date'

/** Số danh mục tải mỗi đợt ở màn Menu (và đợt tải trước từ Home). */
export const MENU_CATALOG_BATCH = 5

export const branchesQueryOptions = () => ({
  queryKey: ['branches'] as const,
  queryFn: () => getAllBranches(),
  staleTime: 10 * 60_000,
})

export const catalogQueryOptions = () => ({
  queryKey: [QUERYKEY.catalog] as const,
  queryFn: () => getCatalog(),
})

/** Tham số menu theo bộ lọc hiện tại — giống hệt cách màn Menu dựng. */
export function menuRequestForFilter(
  filter: IMenuFilter,
  branchSlug: string | undefined,
): ISpecificMenuRequest {
  return buildSpecificMenuRequest({
    date: filter.date ?? getLocalDateString(),
    branch: filter.branch ?? branchSlug,
    catalog: filter.catalog,
    productName: filter.productName,
    minPrice: filter.minPrice,
    maxPrice: filter.maxPrice,
    slug: filter.menu,
    isNewProduct: filter.isNewProduct,
    isTopSell: filter.isTopSell,
  })
}

/** Menu của một danh mục. Khách đăng nhập và vãng lai dùng API và khoá khác. */
export function catalogMenuQueryOptions(
  hasUser: boolean,
  request: ISpecificMenuRequest,
  catalogSlug: string,
) {
  const q: ISpecificMenuRequest = { ...request, catalog: catalogSlug }
  return {
    queryKey: [hasUser ? 'specific-menu' : 'public-specific-menu', q] as const,
    queryFn: () => (hasUser ? getSpecificMenu(q) : getPublicSpecificMenu(q)),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    meta: { skipGlobalErrorCodes: MENU_QUERY_SKIP_CODES },
  }
}

/**
 * Tải trước danh mục và đợt món đầu tiên, đúng khoá màn Menu đọc. Gọi từ Home
 * khi Home đã rảnh. Lỗi thì bỏ qua — Menu tự tải khi khách vào.
 */
export async function prefetchMenu(
  client: QueryClient,
  opts: {
    hasUser: boolean
    branchSlug: string | undefined
    menuFilter: IMenuFilter
  },
): Promise<void> {
  const { hasUser, branchSlug, menuFilter } = opts
  const branch = menuFilter.branch ?? branchSlug
  if (!branch) {
    // Chưa có chi nhánh: tải sẵn danh sách để Menu tự chọn ngay khi vào.
    await client.prefetchQuery(branchesQueryOptions())
    return
  }
  // Lọc Bán chạy / Mới: Menu dùng một truy vấn riêng, không theo danh mục.
  if (menuFilter.isNewProduct || menuFilter.isTopSell) return
  try {
    const catalogs = await client.fetchQuery(catalogQueryOptions())
    const slugs = menuFilter.catalog
      ? [menuFilter.catalog]
      : (catalogs?.result ?? []).map((c) => c.slug)
    const request = menuRequestForFilter(menuFilter, branchSlug)
    await Promise.all(
      slugs
        .slice(0, MENU_CATALOG_BATCH)
        .map((slug) =>
          client.prefetchQuery(catalogMenuQueryOptions(hasUser, request, slug)),
        ),
    )
  } catch {
    // Tải trước chỉ để nhanh hơn; Menu vẫn tự tải.
  }
}
