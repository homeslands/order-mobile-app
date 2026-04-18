import React, { useCallback, useMemo } from 'react'
import { FlatList } from 'react-native'
import { useDataTableContext } from './data-table-context'
import { DataTableRow } from './data-table-row'
import type { DataTableColumnResolved } from './types'

interface DataTableBodyProps<T> {
  columns: DataTableColumnResolved<T>[]
  emptyComponent?: React.ReactNode
}

/** Virtualized body: FlatList only. keyExtractor and renderItem memoized. */
export function DataTableBody<T>({
  columns,
  emptyComponent,
}: DataTableBodyProps<T>) {
  const {
    rows,
    getRowId,
    selectedRows,
    toggleRowSelection,
    onRowPress,
    selectable,
  } = useDataTableContext<T>()

  const renderItem = useCallback(
    ({ item, index }: { item: T; index: number }) => {
      const rowId = getRowId(item, index)
      const selected = selectedRows.has(rowId)
      return (
        <DataTableRow<T>
          row={item}
          index={index}
          columns={columns}
          rowId={rowId}
          selected={selected}
          selectable={selectable}
          onToggleSelection={toggleRowSelection}
          onPress={onRowPress}
        />
      )
    },
    [
      columns,
      getRowId,
      selectedRows,
      toggleRowSelection,
      onRowPress,
      selectable,
    ],
  )

  const keyExtractor = useCallback(
    (item: T, index: number) => String(getRowId(item, index)),
    [getRowId],
  )

  const listEmptyComponent = useMemo(
    () => (emptyComponent ? () => <>{emptyComponent}</> : null),
    [emptyComponent],
  )

  return (
    <FlatList
      data={rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={null}
      removeClippedSubviews
      maxToRenderPerBatch={2}
      windowSize={3}
      initialNumToRender={5}
      style={{ flex: 1 }}
      contentContainerStyle={rows.length === 0 ? { flex: 1 } : undefined}
      ListEmptyComponent={listEmptyComponent}
    />
  )
}
