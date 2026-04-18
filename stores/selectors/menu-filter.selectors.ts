/**
 * MenuFilter narrow selectors — atomic selectors cho từng field.
 * Tránh re-render khi field khác (vd: productName) thay đổi nhưng branch/date không đổi.
 * Dùng các hook này thay vì useShallow trên object menuFilter để tránh re-render khi setMenuFilter tạo object mới.
 */
import { useMemo } from 'react'
import { useBranchStore } from '../branch.store'
import { useMenuFilterStore } from '../menu-filter.store'

/** Stable selectors — subscribe từng primitive, không re-render khi field khác đổi */
export const useDateFilter = () => useMenuFilterStore((s) => s.menuFilter.date)
export const useBranchFilter = () =>
  useMenuFilterStore((s) => s.menuFilter.branch)
export const useCatalogFilter = () =>
  useMenuFilterStore((s) => s.menuFilter.catalog)
export const useProductNameFilter = () =>
  useMenuFilterStore((s) => s.menuFilter.productName)
export const useMinPriceFilter = () =>
  useMenuFilterStore((s) => s.menuFilter.minPrice)
export const useMaxPriceFilter = () =>
  useMenuFilterStore((s) => s.menuFilter.maxPrice)
export const useMenuSlugFilter = () =>
  useMenuFilterStore((s) => s.menuFilter.menu)
export const useSetMenuFilter = () => useMenuFilterStore((s) => s.setMenuFilter)

/** Các field cần cho ISpecificMenuRequest — atomic selectors + useMemo for stable ref */
export const useMenuFilterForRequest = (catalogOverride?: string) => {
  const date = useMenuFilterStore((s) => s.menuFilter.date)
  const branch = useMenuFilterStore((s) => s.menuFilter.branch)
  const catalog = useMenuFilterStore((s) => s.menuFilter.catalog)
  const productName = useMenuFilterStore((s) => s.menuFilter.productName)
  const minPrice = useMenuFilterStore((s) => s.menuFilter.minPrice)
  const maxPrice = useMenuFilterStore((s) => s.menuFilter.maxPrice)
  const slug = useMenuFilterStore((s) => s.menuFilter.menu)
  const resolvedCatalog = catalogOverride ?? catalog
  return useMemo(
    () => ({
      date,
      branch,
      catalog: resolvedCatalog,
      productName,
      minPrice,
      maxPrice,
      slug,
    }),
    [date, branch, resolvedCatalog, productName, minPrice, maxPrice, slug],
  )
}

/** Branch slug — atomic selector */
export const useBranchSlug = () => useBranchStore((s) => s.branch?.slug)
