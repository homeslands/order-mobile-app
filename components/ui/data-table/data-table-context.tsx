import React, { createContext, useContext } from 'react'
import type {
  DataTableColumnResolved,
  DataTableRef,
  SortDirection,
  UseDataTableReturn,
} from './types'

export type DataTableContextValue<T> = {
  columns: DataTableColumnResolved<T>[]
  rows: T[]
  sortKey: string | null
  sortDirection: SortDirection
  toggleSort: (key: string) => void
  filters: Record<string, string>
  setFilter: (key: string, value: string) => void
  selectedRows: Set<string | number>
  toggleRowSelection: (id: string | number) => void
  selectAll: (rowIds: (string | number)[]) => void
  clearSelection: () => void
  pagination: UseDataTableReturn<T>['pagination']
  isLoading: boolean
  selectable: boolean
  rowKey: keyof T | ((row: T) => string | number) | undefined
  onRowPress: ((row: T) => void) | undefined
  getRowId: (row: T, index: number) => string | number
  refApi: React.MutableRefObject<DataTableRef | null>
  totalWidth: number
}

const DataTableContext = createContext<DataTableContextValue<unknown> | null>(null)

export function DataTableProvider<T>({
  value,
  children,
}: {
  value: DataTableContextValue<T>
  children: React.ReactNode
}) {
  return (
    <DataTableContext.Provider value={value as DataTableContextValue<unknown>}>
      {children}
    </DataTableContext.Provider>
  )
}

export function useDataTableContext<T>(): DataTableContextValue<T> {
  const ctx = useContext(DataTableContext)
  if (!ctx) throw new Error('DataTable components must be used within DataTable')
  return ctx as DataTableContextValue<T>
}
