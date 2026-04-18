import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetFlashList,
} from '@gorhom/bottom-sheet'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, useColorScheme, View } from 'react-native'

import { TableStatus } from '@/constants'
import { TABLE_SELECT_ITEM_HEIGHT } from '@/constants/list-item-sizes'
import { useTables } from '@/hooks'
import { useOrderFlowStore } from '@/stores'
import { ITable } from '@/types'

import { TableItem } from './table-item'

let sheetRef: BottomSheet | null = null
let openCallback: (() => void) | null = null
let isComponentMounted = false
let pendingOpen = false
const tableOpenRetryTimeoutIds: ReturnType<typeof setTimeout>[] = []

function clearTableOpenRetries() {
  tableOpenRetryTimeoutIds.forEach((id) => clearTimeout(id))
  tableOpenRetryTimeoutIds.length = 0
}

interface TableSelectSheetProps {
  branchSlug: string
  /** Gọi khi sheet đóng (index -1) — dùng cho single-active-sheet pattern. */
  onClose?: () => void
  /** Lazy mount: mở ngay khi mount — dùng khi render conditional, không cần gọi .open() */
  openOnMount?: boolean
}

function TableSelectSheet({
  branchSlug,
  onClose,
  openOnMount,
}: TableSelectSheetProps) {
  const { t } = useTranslation('table')
  const isDark = useColorScheme() === 'dark'
  const bottomSheetRef = useRef<BottomSheet>(null)
  const [shouldOpen, setShouldOpen] = useState(!!openOnMount)
  const [_isOpen, setIsOpen] = useState(false)
  // Copy đúng pattern ref + openCallback từ VoucherListDrawer
  useEffect(() => {
    isComponentMounted = true

    const checkAndSetRef = () => {
      const currentRef = bottomSheetRef.current
      if (currentRef && isComponentMounted) {
        sheetRef = currentRef
        openCallback = () => {
          setShouldOpen(true)
        }
        if (pendingOpen) {
          pendingOpen = false
          setTimeout(() => setShouldOpen(true), 0)
        }
        return currentRef
      }
      return null
    }

    // Check immediately
    checkAndSetRef()

    // Retry 2 lần nếu BottomSheet mount bất đồng bộ
    const timeoutId1 = setTimeout(() => {
      if (isComponentMounted) checkAndSetRef()
    }, 100)
    const timeoutId2 = setTimeout(() => {
      if (isComponentMounted) checkAndSetRef()
    }, 300)

    return () => {
      isComponentMounted = false
      sheetRef = null
      openCallback = null
      pendingOpen = false
      clearTimeout(timeoutId1)
      clearTimeout(timeoutId2)
      // Also clear any pending open-retry timers — otherwise they fire
      // snapToIndex on an unmounted BottomSheet ref.
      clearTableOpenRetries()
    }
  }, [])

  // Liên tục đồng bộ ref khi bottomSheetRef thay đổi (giống VoucherListDrawer)
  useEffect(() => {
    if (bottomSheetRef.current && isComponentMounted) {
      sheetRef = bottomSheetRef.current
      openCallback = () => {
        setShouldOpen(true)
      }
      if (pendingOpen) {
        pendingOpen = false
        setTimeout(() => setShouldOpen(true), 0)
      }
    }
  }, [])

  const snapPoints = useMemo(() => ['50%'], [])

  // Handle sheet index changes (để reset shouldOpen giống VoucherListDrawer)
  const handleSheetChanges = useCallback(
    (index: number) => {
      setIsOpen(index >= 0)

      if (index < 0) {
        clearTableOpenRetries()
        setShouldOpen(false)
        onClose?.()
      } else if (index >= 0 && shouldOpen) {
        setShouldOpen(false)
      }
    },
    [shouldOpen, onClose],
  )

  // Handle shouldOpen state change — mở sheet với retry giống VoucherListDrawer
  useEffect(() => {
    if (!shouldOpen) return

    const openSheet = () => {
      if (!bottomSheetRef.current) {
        return false
      }

      try {
        bottomSheetRef.current.snapToIndex(0)
        return true
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[TableSelectSheet] Error calling snapToIndex:', error)
        return false
      }
    }

    // Thử mở ngay
    if (openSheet()) {
      return
    }

    const timeout1 = setTimeout(() => {
      if (shouldOpen && openSheet()) return
    }, 50)

    const timeout2 = setTimeout(() => {
      if (shouldOpen && openSheet()) return
    }, 100)

    const timeout3 = setTimeout(() => {
      if (shouldOpen && openSheet()) return
    }, 200)

    return () => {
      clearTimeout(timeout1)
      clearTimeout(timeout2)
      clearTimeout(timeout3)
    }
  }, [shouldOpen])

  // Defer fetch như Voucher: chỉ fetch khi sắp mở (shouldOpen) — tránh API + re-render block BottomSheet mount
  const { data, isLoading } = useTables(shouldOpen ? branchSlug : undefined)
  const tables = useMemo(() => data?.result || [], [data])

  const getCartItems = useOrderFlowStore((s) => s.getCartItems)
  const addTable = useOrderFlowStore((s) => s.addTable)
  const cartItems = getCartItems()
  const selectedTableId = cartItems?.table

  // Pre-compute status label (tránh t() trong list)
  const statusLabelMap = useMemo(() => {
    const map: Record<string, string> = {}

    Object.values(TableStatus).forEach((status) => {
      map[status] = t(`table.${status}`)
    })

    return map
  }, [t])

  // Backdrop component để đóng khi chạm vào backdrop
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  )

  const handleSelectTable = useCallback(
    (table: ITable) => {
      addTable(table)
      bottomSheetRef.current?.close()
    },
    [addTable],
  )

  const renderItem = useCallback(
    ({ item }: { item: ITable }) => (
      <TableItem
        table={item}
        isSelected={selectedTableId === item.slug}
        isDark={isDark}
        statusLabel={statusLabelMap[item.status]}
        onSelect={handleSelectTable}
      />
    ),
    [handleSelectTable, isDark, selectedTableId, statusLabelMap],
  )

  const renderFooter = useCallback(() => {
    return <View className="h-2" />
  }, [])

  const keyExtractor = useCallback((item: ITable) => item.slug, [])

  const backgroundStyle = useMemo(
    () => ({ backgroundColor: isDark ? '#111827' : '#ffffff' }),
    [isDark],
  )
  const containerStyle = useMemo(() => ({ zIndex: 9999, elevation: 9999 }), [])

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      enableContentPanningGesture={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={backgroundStyle}
      containerStyle={containerStyle}
    >
      <View className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
          {t('table.title')}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator
            size="small"
            color={isDark ? '#9ca3af' : '#6b7280'}
          />
          <Text className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {t('table.loading', 'Đang tải...')}
          </Text>
        </View>
      ) : tables.length > 0 ? (
        <BottomSheetFlashList
          data={tables}
          keyExtractor={keyExtractor}
          estimatedItemSize={TABLE_SELECT_ITEM_HEIGHT}
          overrideItemLayout={(layout: { span?: number; size?: number }) => {
            layout.size = TABLE_SELECT_ITEM_HEIGHT
          }}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View className="items-center px-4 py-8">
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {t('table.noTables', 'Không có bàn nào')}
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
      ) : (
        <View className="flex-1 items-center justify-center py-12">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {t('table.noTables', 'Không có bàn nào')}
          </Text>
        </View>
      )}
    </BottomSheet>
  )
}

// Expose static method to open sheet — copy pattern từ VoucherListDrawer (B3: pendingOpen khi chưa mount)
TableSelectSheet.open = () => {
  if (openCallback) {
    clearTableOpenRetries()
    openCallback()
  } else if (sheetRef) {
    clearTableOpenRetries()
    try {
      sheetRef.snapToIndex(0)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[TableSelectSheet.open] Error:', error)
    }
  } else {
    clearTableOpenRetries()
    pendingOpen = true
    // eslint-disable-next-line no-console
    console.warn(
      '[TableSelectSheet.open] Both sheetRef and openCallback are null, retrying with multiple attempts...',
    )

    const attempts = [100, 200, 300, 500, 1000]
    attempts.forEach((delay, index) => {
      const id = setTimeout(() => {
        if (openCallback) {
          clearTableOpenRetries()
          openCallback()
        } else if (sheetRef) {
          try {
            clearTableOpenRetries()
            sheetRef.snapToIndex(0)
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `[TableSelectSheet.open] Retry ${index + 1} error:`,
              error,
            )
          }
        } else if (index === attempts.length - 1) {
          // eslint-disable-next-line no-console
          console.error(
            '[TableSelectSheet.open] All retry attempts failed. Component may not be mounted.',
          )
        }
      }, delay)
      tableOpenRetryTimeoutIds.push(id)
    })
  }
}

export default TableSelectSheet
