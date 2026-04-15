/**
 * Example: DataTable (uncontrolled) với sort, filter, pagination.
 * Chạy: mở tab/màn hình có import screen này.
 */
import {
  DataTable,
  useDataTable,
  type DataTableColumn,
  type DataTableRef,
} from '@/components/ui/data-table'
import React, { useRef } from 'react'
import { View } from 'react-native'

interface OrderRow {
  id: string
  name: string
  amount: number
  status: string
}

const MOCK_DATA: OrderRow[] = Array.from({ length: 120 }, (_, i) => ({
  id: `ORD-${1000 + i}`,
  name: `Order ${i + 1}`,
  amount: Math.round(100 + Math.random() * 500),
  status: ['Pending', 'Done', 'Cancelled'][i % 3],
}))

const columns: DataTableColumn<OrderRow>[] = [
  { key: 'id', title: 'ID', width: 100, sortable: true },
  { key: 'name', title: 'Name', width: 160, sortable: true, filterable: true },
  { key: 'amount', title: 'Amount', width: 100, sortable: true },
  { key: 'status', title: 'Status', width: 100, filterable: true },
]

export default function DataTableExampleScreen() {
  const tableRef = useRef<DataTableRef>(null)

  return (
    <View className="flex-1 bg-gray-100 p-4 dark:bg-gray-950">
      <DataTable<OrderRow>
        ref={tableRef}
        data={MOCK_DATA}
        columns={columns}
        config={{
          pagination: true,
          pageSize: 10,
          filterDebounceMs: 300,
        }}
        rowKey="id"
        onRowPress={() => {}}
        emptyComponent={<DataTable.Empty message="No orders" />}
        loadingComponent={<DataTable.Loading />}
      >
        <DataTable.Toolbar />
        <DataTable.Pagination />
      </DataTable>
    </View>
  )
}

/**
 * Controlled example (comment out above and use this):
 */
export function DataTableControlledExample() {
  const data = MOCK_DATA
  const tableState = useDataTable(data, columns, {
    pagination: true,
    pageSize: 20,
  })

  return (
    <View className="flex-1 p-4">
      <DataTable<OrderRow>
        rows={tableState.rows}
        resolvedColumns={tableState.columns}
        columns={columns}
        sortKey={tableState.sortKey}
        sortDirection={tableState.sortDirection}
        onToggleSort={tableState.toggleSort}
        filters={tableState.filters}
        onSetFilter={tableState.setFilter}
        selectedRows={tableState.selectedRows}
        onToggleRowSelection={tableState.toggleRowSelection}
        onSelectAll={tableState.selectAll}
        onClearSelection={tableState.clearSelection}
        pagination={tableState.pagination}
        rowKey="id"
      >
        <DataTable.Toolbar />
        <DataTable.Pagination />
      </DataTable>
    </View>
  )
}
