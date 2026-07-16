import { FILTER_VALUE } from '@/constants'
import {
  IApiResponse,
  IMenuItem,
  ISpecificMenuPaged,
  ISpecificMenuRequest,
} from '@/types'
import { http } from '@/utils'

/**
 * Chuẩn hoá params cho getSpecificMenu — single source of truth.
 *
 * Giá: backend CHỈ lọc khi có ĐỦ cả minPrice VÀ maxPrice (gửi 1 param lẻ bị bỏ
 * qua). Vì vậy áp dụng quy tắc "cả hai hoặc không":
 *  - Ở dải mặc định đầy đủ (min ≤ 0 và max ≥ 300000): BỎ cả hai → backend trả về
 *    TẤT CẢ món. Trước đây luôn gửi 0/300000 khiến các món > 300k bị âm thầm ẩn
 *    dù user chưa hề lọc.
 *  - User thu hẹp bất kỳ đầu nào: GỬI cả hai (điền default cho đầu chưa đổi) để
 *    bộ lọc thực sự có hiệu lực.
 *
 * Đồng thời giữ query key nhất quán giữa màn menu, predictive-prefetch và
 * cart-validation để chia sẻ cache React Query (mặc định → key { date, branch }).
 */
export function buildSpecificMenuRequest(filter: {
  date: string
  branch?: string
  catalog?: string
  productName?: string
  minPrice?: number
  maxPrice?: number
  slug?: string
  isNewProduct?: boolean
  isTopSell?: boolean
}): ISpecificMenuRequest {
  const isDefaultRange =
    (filter.minPrice == null || filter.minPrice <= FILTER_VALUE.MIN_PRICE) &&
    (filter.maxPrice == null || filter.maxPrice >= FILTER_VALUE.MAX_PRICE)

  return {
    date: filter.date,
    branch: filter.branch,
    catalog: filter.catalog,
    productName: filter.productName,
    minPrice: isDefaultRange
      ? undefined
      : (filter.minPrice ?? FILTER_VALUE.MIN_PRICE),
    maxPrice: isDefaultRange
      ? undefined
      : (filter.maxPrice ?? FILTER_VALUE.MAX_PRICE),
    slug: filter.slug,
    isNewProduct: filter.isNewProduct,
    isTopSell: filter.isTopSell,
  }
}

export async function getSpecificMenu(
  query: ISpecificMenuRequest,
): Promise<IApiResponse<ISpecificMenuPaged>> {
  const response = await http.get<IApiResponse<ISpecificMenuPaged>>(
    `/menu/specific`,
    {
      params: query,
    },
  )
  return response.data
}

export async function getPublicSpecificMenu(
  query: ISpecificMenuRequest,
): Promise<IApiResponse<ISpecificMenuPaged>> {
  const response = await http.get<IApiResponse<ISpecificMenuPaged>>(
    `/menu/specific/public`,
    {
      params: query,
    },
  )
  return response.data
}

/** Specific-menu response that may be the new paged envelope OR the legacy flat one. */
export type MenuEnvelope = Partial<ISpecificMenuPaged> & {
  menuItems?: IMenuItem[]
}

/**
 * Flatten a specific-menu response to a flat menu-item array. Handles BOTH the
 * new paged envelope (`result.items[].menuItems`) and the legacy flat envelope
 * (`result.menuItems`) — so it works whether or not a given endpoint (public vs
 * private) has been migrated to paging yet.
 */
export function extractMenuItems(
  res: MenuEnvelope | undefined | null,
): IMenuItem[] {
  if (!res) return []
  if (Array.isArray(res.menuItems)) return res.menuItems
  return res.items?.flatMap((m) => m.menuItems ?? []) ?? []
}

export async function getSpecificMenuItem(
  slug: string,
): Promise<IApiResponse<IMenuItem>> {
  const response = await http.get<IApiResponse<IMenuItem>>(`/menu-item/${slug}`)
  return response.data
}
