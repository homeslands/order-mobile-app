import { cn } from '@/lib/utils'
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import { ScrollView, View } from 'react-native'
import { DataTableBody } from './data-table-body'
import { DataTableProvider, useDataTableContext } from './data-table-context'
import { DataTableEmpty } from './data-table-empty'
import { DataTableHeader } from './data-table-header'
import { DataTablePagination } from './data-table-pagination'
import type {
  DataTableColumn,
  DataTableColumnResolved,
  DataTableRef,
  SortDirection,
} from './types'
import { useDataTable } from './use-data-table'

const NOOP = () => {}

function DefaultEmpty() {
  return <DataTableEmpty />
}

export interface DataTableComponentProps<T> {
  data?: T[]
  columns: DataTableColumn<T>[]
  config?: Parameters<typeof useDataTable<T>>[2]
  rows?: T[]
  resolvedColumns?: DataTableColumnResolved<T>[]
  sortKey?: string | null
  sortDirection?: SortDirection
  onToggleSort?: (key: string) => void
  filters?: Record<string, string>
  onSetFilter?: (key: string, value: string) => void
  selectedRows?: Set<string | number>
  onToggleRowSelection?: (id: string | number) => void
  onSelectAll?: (rowIds: (string | number)[]) => void
  onClearSelection?: () => void
  pagination?: ReturnType<typeof useDataTable<T>>['pagination']
  isLoading?: boolean
  rowKey?: keyof T | ((row: T) => string | number)
  onRowPress?: (row: T) => void
  emptyComponent?: React.ReactNode
  loadingComponent?: React.ReactNode
  className?: string
  showHeader?: boolean
  selectable?: boolean
  children?: React.ReactNode
}

function isPaginationChild(child: React.ReactNode): boolean {
  if (!child || typeof child !== 'object' || !('type' in child)) return false
  const type = (child as React.ReactElement).type
  return type === DataTablePagination || (type as { displayName?: string })?.displayName === 'DataTablePagination'
}

function DataTableInner<T>({
  className,
  showHeader = true,
  emptyComponent,
  loadingComponent,
  children,
}: {
  className?: string
  showHeader?: boolean
  emptyComponent?: React.ReactNode
  loadingComponent?: React.ReactNode
  children?: React.ReactNode
}) {
  const ctx = useDataTableContext<T>()
  const { rows, columns, isLoading, totalWidth } = ctx
  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible),
    [columns],
  )

  const childArray = React.Children.toArray(children)
  const topChildren = childArray.filter((c) => !isPaginationChild(c))
  const paginationChildren = childArray.filter(isPaginationChild)

  return (
    <View
      className={cn(
        'flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
        className,
      )}
    >
      {topChildren}
      {isLoading && loadingComponent}
      {!isLoading && (
        <View style={{ flex: 1, minHeight: 200 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <View style={{ width: totalWidth, minWidth: totalWidth, flex: 1 }}>
              {showHeader && <DataTableHeader />}
              {rows.length === 0 && (emptyComponent ?? <DefaultEmpty />)}
              {rows.length > 0 && (
                <DataTableBody
                  columns={visibleColumns}
                  emptyComponent={emptyComponent}
                />
              )}
            </View>
          </ScrollView>
        </View>
      )}
      {paginationChildren}
    </View>
  )
}

export const DataTable = React.forwardRef(function DataTableRoot<T>(
  props: DataTableComponentProps<T>,
  ref: React.Ref<DataTableRef>,
) {
  const {
    data = [],
    columns,
    config = {},
    rows: controlledRows,
    resolvedColumns: controlledColumns,
    sortKey: controlledSortKey,
    sortDirection: controlledSortDirection,
    onToggleSort,
    filters: controlledFilters,
    onSetFilter,
    selectedRows: controlledSelectedRows,
    onToggleRowSelection,
    onSelectAll,
    onClearSelection,
    pagination: controlledPagination,
    isLoading: controlledLoading,
    rowKey,
    onRowPress,
    emptyComponent,
    loadingComponent,
    showHeader = true,
    selectable: selectableProp,
    children,
    className,
  } = props

  const isControlled =
    controlledRows !== undefined && controlledColumns !== undefined
  const uncontrolled = useDataTable(
    isControlled ? [] : data,
    columns,
    isControlled ? {} : config,
  )

  const getRowId = useCallback(
    (row: T, index: number): string | number => {
      if (rowKey === undefined) return index
      if (typeof rowKey === 'function') return rowKey(row)
      const val = (row as Record<string, unknown>)[rowKey as string]
      return val != null ? (val as string | number) : index
    },
    [rowKey],
  )

  const imperativeRef = useRef<DataTableRef>({
    reset: NOOP,
    clearFilters: NOOP,
  })

  useEffect(() => {
    imperativeRef.current.reset = uncontrolled.reset
    imperativeRef.current.clearFilters = uncontrolled.clearFilters
  }, [uncontrolled.reset, uncontrolled.clearFilters])

  useImperativeHandle(ref, () => imperativeRef.current, [])

  const totalWidth = useMemo(() => {
    const cols = isControlled ? controlledColumns! : uncontrolled.columns
    return cols
      .filter((c) => c.visible)
      .reduce((s, c) => s + c.widthResolved, 0)
  }, [isControlled, controlledColumns, uncontrolled.columns])

  const uncontrolledSelectable = config?.selectable ?? false
  const selectable = isControlled
    ? (selectableProp ?? false)
    : uncontrolledSelectable

  const value = useMemo(() => {
    if (isControlled) {
      return {
        columns: controlledColumns!,
        rows: controlledRows!,
        sortKey: controlledSortKey ?? null,
        sortDirection: controlledSortDirection ?? 'none',
        toggleSort: onToggleSort ?? NOOP,
        filters: controlledFilters ?? {},
        setFilter: onSetFilter ?? NOOP,
        selectedRows: controlledSelectedRows ?? new Set(),
        toggleRowSelection: onToggleRowSelection ?? NOOP,
        selectAll: onSelectAll ?? NOOP,
        clearSelection: onClearSelection ?? NOOP,
        pagination: controlledPagination ?? null,
        isLoading: controlledLoading ?? false,
        selectable,
        rowKey,
        onRowPress,
        getRowId,
        refApi: imperativeRef,
        totalWidth,
      }
    }
    const {
      rows: uRows,
      columns: uColumns,
      sortKey: uSortKey,
      sortDirection: uSortDirection,
      toggleSort: uToggleSort,
      filters: uFilters,
      setFilter: uSetFilter,
      selectedRows: uSelectedRows,
      toggleRowSelection: uToggleRowSelection,
      selectAll: uSelectAll,
      clearSelection: uClearSelection,
      pagination: uPagination,
      isLoading: uIsLoading,
    } = uncontrolled
    return {
      rows: uRows,
      columns: uColumns,
      sortKey: uSortKey,
      sortDirection: uSortDirection,
      toggleSort: uToggleSort,
      filters: uFilters,
      setFilter: uSetFilter,
      selectedRows: uSelectedRows,
      toggleRowSelection: uToggleRowSelection,
      selectAll: uSelectAll,
      clearSelection: uClearSelection,
      pagination: uPagination,
      isLoading: controlledLoading ?? uIsLoading,
      selectable,
      rowKey,
      onRowPress,
      getRowId,
      refApi: imperativeRef,
      totalWidth,
    }
    // Omit `uncontrolled` to avoid context value changing every render (hook returns new object ref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isControlled,
    controlledColumns,
    controlledRows,
    controlledSortKey,
    controlledSortDirection,
    onToggleSort,
    controlledFilters,
    onSetFilter,
    controlledSelectedRows,
    onToggleRowSelection,
    onSelectAll,
    onClearSelection,
    controlledPagination,
    controlledLoading,
    selectable,
    rowKey,
    onRowPress,
    getRowId,
    totalWidth,
    uncontrolled.rows,
    uncontrolled.columns,
    uncontrolled.sortKey,
    uncontrolled.sortDirection,
    uncontrolled.filters,
    uncontrolled.selectedRows,
    uncontrolled.pagination,
    uncontrolled.isLoading,
  ])

  return (
    <DataTableProvider
      value={
        value as import('./data-table-context').DataTableContextValue<unknown>
      }
    >
      <DataTableInner
        className={className}
        showHeader={showHeader}
        emptyComponent={emptyComponent}
        loadingComponent={loadingComponent}
        children={children}
      />
    </DataTableProvider>
  )
}) as <T>(
  p: DataTableComponentProps<T> & { ref?: React.Ref<DataTableRef> },
) => React.ReactElement
