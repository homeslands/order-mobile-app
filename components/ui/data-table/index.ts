export { DataTable as DataTableRoot } from './data-table'
export { DataTableBody } from './data-table-body'
export { DataTableCell } from './data-table-cell'
export { DataTableProvider, useDataTableContext } from './data-table-context'
export { DataTableEmpty } from './data-table-empty'
export { DataTableHeader } from './data-table-header'
export { DataTableLoading } from './data-table-loading'
export { DataTablePagination } from './data-table-pagination'
export { DataTableRow } from './data-table-row'
export { DataTableToolbar } from './data-table-toolbar'
export type {
  DataTableColumn,
  DataTableColumnResolved,
  DataTableMode,
  DataTablePaginationState,
  DataTableRef,
  SortDirection,
  UseDataTableConfig,
  UseDataTableReturn,
} from './types'
export { useDataTable } from './use-data-table'

import { DataTable as DataTableBase } from './data-table'
import { DataTableEmpty } from './data-table-empty'
import { DataTableLoading } from './data-table-loading'
import { DataTablePagination } from './data-table-pagination'
import { DataTableToolbar } from './data-table-toolbar'

/** DataTable with compound components (Toolbar, Pagination, Empty, Loading). Main export. */
export const DataTable = Object.assign(DataTableBase, {
  Toolbar: DataTableToolbar,
  Pagination: DataTablePagination,
  Empty: DataTableEmpty,
  Loading: DataTableLoading,
})
