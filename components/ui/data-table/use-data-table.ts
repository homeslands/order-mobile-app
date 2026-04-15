import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDebounce } from 'use-debounce'
import type {
  DataTableColumn,
  DataTableColumnResolved,
  SortDirection,
  UseDataTableConfig,
  UseDataTableReturn,
} from './types'

const DEFAULT_PAGE_SIZE = 10
const DEFAULT_FILTER_DEBOUNCE_MS = 300

function getValue<T>(row: T, column: DataTableColumn<T>): unknown {
  if (column.accessor) return column.accessor(row)
  return (row as Record<string, unknown>)[column.key]
}

function compareValues(
  a: unknown,
  b: unknown,
  direction: 'asc' | 'desc',
): number {
  const aVal = a == null ? '' : String(a)
  const bVal = b == null ? '' : String(b)
  const cmp = aVal.localeCompare(bVal, undefined, { numeric: true })
  return direction === 'asc' ? cmp : -cmp
}

/**
 * Headless hook: all sorting, filtering, selection, pagination logic.
 * No UI, no API calls, no store. Presentational components consume this via context.
 */
export function useDataTable<T>(
  data: T[],
  columns: DataTableColumn<T>[],
  config: UseDataTableConfig<T> = {},
): UseDataTableReturn<T> {
  const {
    mode = 'client',
    pagination: paginationEnabled = false,
    pageSize = DEFAULT_PAGE_SIZE,
    filterDebounceMs = DEFAULT_FILTER_DEBOUNCE_MS,
    initialSortKey = null,
    initialSortDirection = 'none',
    initialColumnVisibility = {},
    initialColumnWidths = {},
    onSortChange,
    onFiltersChange,
    onPaginationChange,
    serverTotalRows = 0,
    serverRows = [],
  } = config

  const [columnVisibility, setColumnVisibilityState] = useState<
    Record<string, boolean>
  >(() => {
    const out: Record<string, boolean> = {}
    columns.forEach((col) => {
      out[col.key] = initialColumnVisibility[col.key] ?? col.visible ?? true
    })
    return out
  })

  const [columnWidths, setColumnWidthsState] =
    useState<Record<string, number>>(initialColumnWidths)
  const setColumnVisibility = useCallback((key: string, visible: boolean) => {
    setColumnVisibilityState((prev) => ({ ...prev, [key]: visible }))
  }, [])
  const setColumnWidth = useCallback((key: string, width: number) => {
    setColumnWidthsState((prev) => ({ ...prev, [key]: width }))
  }, [])

  const resolvedColumns: DataTableColumnResolved<T>[] = useMemo(() => {
    return columns.map((col) => {
      const visible = columnVisibility[col.key] ?? col.visible ?? true
      const widthResolved = columnWidths[col.key] ?? col.width ?? 120
      return { ...col, visible, widthResolved }
    })
  }, [columns, columnVisibility, columnWidths])

  const visibleColumns = useMemo(
    () => resolvedColumns.filter((c) => c.visible),
    [resolvedColumns],
  )

  const [sortKey, setSortKey] = useState<string | null>(initialSortKey)
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(initialSortDirection)
  const toggleSort = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key)
      if (col?.sortable === false) return
      const nextDir: SortDirection =
        sortKey !== key
          ? 'asc'
          : sortDirection === 'asc'
            ? 'desc'
            : sortDirection === 'desc'
              ? 'none'
              : 'asc'
      const nextKey = nextDir === 'none' ? null : key
      setSortKey(nextKey)
      setSortDirection(nextDir)
      if (mode === 'server' && onSortChange) onSortChange(nextKey, nextDir)
    },
    [columns, sortKey, sortDirection, mode, onSortChange],
  )

  const [filters, setFiltersState] = useState<Record<string, string>>({})
  const [debouncedFilters] = useDebounce(filters, filterDebounceMs)
  const setFilter = useCallback((key: string, value: string) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }))
  }, [])
  const setFilters = useCallback(
    (next: Record<string, string>) => setFiltersState(next),
    [],
  )
  const filtersForLogic = mode === 'server' ? filters : debouncedFilters
  useEffect(() => {
    if (mode === 'server' && onFiltersChange) onFiltersChange(filtersForLogic)
  }, [mode, filtersForLogic, onFiltersChange])

  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(
    new Set(),
  )
  const toggleRowSelection = useCallback((id: string | number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const selectAll = useCallback(
    (rowIds: (string | number)[]) => setSelectedRows(new Set(rowIds)),
    [],
  )
  const clearSelection = useCallback(() => setSelectedRows(new Set()), [])

  const clientRows = useMemo(() => {
    if (mode !== 'client') return []
    let list = [...data]
    visibleColumns.forEach((col) => {
      const q = (debouncedFilters[col.key] ?? '').trim().toLowerCase()
      if (!q) return
      list = list.filter((row) =>
        String(getValue(row, col) ?? '')
          .toLowerCase()
          .includes(q),
      )
    })
    if (sortKey && sortDirection !== 'none') {
      const col = columns.find((c) => c.key === sortKey)
      if (col) {
        list = [...list].sort((a, b) =>
          compareValues(
            getValue(a, col),
            getValue(b, col),
            sortDirection as 'asc' | 'desc',
          ),
        )
      }
    }
    return list
  }, [
    mode,
    data,
    visibleColumns,
    debouncedFilters,
    sortKey,
    sortDirection,
    columns,
  ])

  const totalRows = mode === 'client' ? clientRows.length : serverTotalRows
  const rowsForPagination = mode === 'client' ? clientRows : serverRows

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSizeStateVal, setPageSizeState] = useState(pageSize)
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSizeStateVal))
  const safePageIndex = Math.min(pageIndex, Math.max(0, totalPages - 1))
  const start = safePageIndex * pageSizeStateVal

  const rows: T[] = useMemo(() => {
    if (!paginationEnabled) return rowsForPagination
    if (mode === 'server') return serverRows
    return rowsForPagination.slice(start, start + pageSizeStateVal)
  }, [
    paginationEnabled,
    mode,
    rowsForPagination,
    serverRows,
    start,
    pageSizeStateVal,
  ])

  const paginationClean: UseDataTableReturn<T>['pagination'] = paginationEnabled
    ? {
        pageIndex: safePageIndex,
        pageSize: pageSizeStateVal,
        totalRows,
        totalPages,
        canPreviousPage: safePageIndex > 0,
        canNextPage: safePageIndex < totalPages - 1,
        setPageIndex,
        setPageSize: setPageSizeState,
        nextPage: () => setPageIndex((p) => Math.min(p + 1, totalPages - 1)),
        previousPage: () => setPageIndex((p) => Math.max(0, p - 1)),
      }
    : null

  const [isLoading, setIsLoading] = useState(false)
  const reset = useCallback(() => {
    setSortKey(initialSortKey)
    setSortDirection(initialSortDirection)
    setFiltersState({})
    setSelectedRows(new Set())
    setPageIndex(0)
    if (mode === 'server' && onSortChange)
      onSortChange(initialSortKey, initialSortDirection)
    if (mode === 'server' && onFiltersChange) onFiltersChange({})
    if (onPaginationChange) onPaginationChange(0, pageSizeStateVal)
  }, [
    initialSortKey,
    initialSortDirection,
    mode,
    onSortChange,
    onFiltersChange,
    onPaginationChange,
    pageSizeStateVal,
  ])
  const clearFilters = useCallback(() => {
    setFiltersState({})
    if (mode === 'server' && onFiltersChange) onFiltersChange({})
  }, [mode, onFiltersChange])

  return {
    rows,
    columns: resolvedColumns,
    setColumnVisibility,
    setColumnWidth,
    sortKey,
    sortDirection,
    toggleSort,
    filters: filtersForLogic,
    setFilter,
    setFilters,
    selectedRows,
    toggleRowSelection,
    selectAll,
    clearSelection,
    pagination: paginationClean,
    isLoading,
    setIsLoading,
    reset,
    clearFilters,
  }
}
