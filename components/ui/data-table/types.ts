import type { ReactNode } from 'react'

/** Sort: asc → desc → none */
export type SortDirection = 'asc' | 'desc' | 'none'

export type DataTableMode = 'client' | 'server'

/**
 * Column config (mobile-first).
 * Example: { key: "name", title: "Name", sortable: true, filterable: true, width: 140, render?: (row) => ReactNode }
 */
export interface DataTableColumn<T> {
  key: string
  title: string
  sortable?: boolean
  filterable?: boolean
  width?: number
  minWidth?: number
  maxWidth?: number
  visible?: boolean
  render?: (row: T, value: unknown) => ReactNode
  accessor?: (row: T) => unknown
}

export interface DataTableColumnResolved<T> extends DataTableColumn<T> {
  widthResolved: number
  visible: boolean
}

export interface DataTablePaginationState {
  pageIndex: number
  pageSize: number
  totalRows: number
  totalPages: number
  canPreviousPage: boolean
  canNextPage: boolean
}

export interface UseDataTableConfig<T> {
  mode?: DataTableMode
  selectable?: boolean
  pagination?: boolean
  pageSize?: number
  filterDebounceMs?: number
  initialSortKey?: string | null
  initialSortDirection?: SortDirection
  initialColumnVisibility?: Record<string, boolean>
  initialColumnWidths?: Record<string, number>
  onSortChange?: (sortKey: string | null, sortDirection: SortDirection) => void
  onFiltersChange?: (filters: Record<string, string>) => void
  onPaginationChange?: (pageIndex: number, pageSize: number) => void
  serverTotalRows?: number
  serverRows?: T[]
}

export interface UseDataTableReturn<T> {
  rows: T[]
  columns: DataTableColumnResolved<T>[]
  setColumnVisibility: (key: string, visible: boolean) => void
  setColumnWidth: (key: string, width: number) => void
  sortKey: string | null
  sortDirection: SortDirection
  toggleSort: (key: string) => void
  filters: Record<string, string>
  setFilter: (key: string, value: string) => void
  setFilters: (filters: Record<string, string>) => void
  selectedRows: Set<string | number>
  toggleRowSelection: (id: string | number) => void
  selectAll: (rowIds: (string | number)[]) => void
  clearSelection: () => void
  pagination: (DataTablePaginationState & {
    setPageIndex: (index: number) => void
    setPageSize: (size: number) => void
    nextPage: () => void
    previousPage: () => void
  }) | null
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  reset: () => void
  clearFilters: () => void
}

export interface DataTableRef {
  reset: () => void
  clearFilters: () => void
}
