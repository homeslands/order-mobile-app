import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet'
import { ShoppingBag } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, TouchableOpacity, useColorScheme, View } from 'react-native'

import { colors } from '@/constants/colors.constant'
import { useOrderTypeOptions } from '@/hooks'
import { cn } from '@/lib/utils'

let sheetRef: BottomSheet | null = null
let openCallback: (() => void) | null = null
let isComponentMounted = false
const openRetryTimeoutIds: ReturnType<typeof setTimeout>[] = []

function clearOrderTypeOpenRetries() {
  openRetryTimeoutIds.forEach((id) => clearTimeout(id))
  openRetryTimeoutIds.length = 0
}

interface OrderTypeSheetProps {
  /** B2: Khi false, không fetch feature flags — defer đến khi cần. */
  fetchEnabled?: boolean
  /** Gọi khi sheet đóng (index -1) — dùng cho single-active-sheet pattern. */
  onClose?: () => void
  /** Lazy mount: mở ngay khi mount — dùng khi render conditional, không cần gọi .open() */
  openOnMount?: boolean
}

function OrderTypeSheet({
  fetchEnabled = true,
  onClose,
  openOnMount,
}: OrderTypeSheetProps) {
  const { t } = useTranslation('menu')
  const isDark = useColorScheme() === 'dark'
  const bottomSheetRef = useRef<BottomSheet>(null)
  const { orderTypes, selectedType, handleChange } = useOrderTypeOptions({
    enabled: fetchEnabled,
  })
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
      clearTimeout(timeoutId1)
      clearTimeout(timeoutId2)
      // Null out module-level refs to prevent orphan retries from calling
      // snapToIndex on an unmounted component (and to release ref retention).
      isComponentMounted = false
      clearOrderTypeOpenRetries()
      sheetRef = null
      openCallback = null
    }
  }, [])

  // Liên tục đồng bộ ref khi bottomSheetRef thay đổi (giống VoucherListDrawer)
  useEffect(() => {
    if (bottomSheetRef.current && isComponentMounted) {
      sheetRef = bottomSheetRef.current
      openCallback = () => {
        setShouldOpen(true)
      }
    }
  }, [])

  const snapPoints = useMemo(() => ['32%'], [])

  // Handle sheet index changes (để reset shouldOpen giống VoucherListDrawer)
  const handleSheetChanges = useCallback(
    (index: number) => {
      setIsOpen(index >= 0)

      if (index < 0) {
        clearOrderTypeOpenRetries()
        setShouldOpen(false)
        onClose?.()
      } else if (index >= 0 && shouldOpen) {
        // Vừa mở thành công → reset cờ shouldOpen
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
        console.error('[OrderTypeSheet] Error calling snapToIndex:', error)
        return false
      }
    }

    // Thử mở ngay lập tức
    if (openSheet()) {
      return
    }

    // Retry với delay ngắn nếu lần đầu thất bại
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

  interface OrderTypeItem {
    label: string
    value: string
  }

  const keyExtractor = useCallback((item: OrderTypeItem) => item.value, [])

  const renderItem = useCallback(
    ({ item }: { item: OrderTypeItem }) => {
      const isSelected = selectedType?.value === item.value
      return (
        <TouchableOpacity
          onPress={() => {
            handleChange(item.value)
            bottomSheetRef.current?.close()
          }}
          className={cn(
            'mx-3 my-2 flex-row items-center gap-3 rounded-xl px-4 py-3',
            '',
            isSelected
              ? 'border border-primary/60 bg-primary/5'
              : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
          )}
        >
          {/* Icon đầu option */}
          <View
            className={cn(
              'h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800',
              isSelected ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-800',
            )}
          >
            <ShoppingBag
              size={18}
              color={
                isSelected ? colors.primary.light : colors.mutedForeground.light
              }
            />
          </View>

          <View className="flex-1 flex-row items-center justify-between">
            <Text
              numberOfLines={1}
              className={cn(
                'flex-1 text-sm font-medium',
                isSelected
                  ? 'text-primary dark:text-primary'
                  : 'text-gray-900 dark:text-gray-50',
              )}
            >
              {item.label}
            </Text>
            {isSelected && (
              <View className="ml-2 h-6 items-center justify-center rounded-full bg-primary/10 px-3">
                <Text className="text-xs font-semibold text-primary dark:text-primary">
                  ✓
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      )
    },
    [handleChange, selectedType?.value],
  )

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
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      android_keyboardInputMode="adjustResize"
      backgroundStyle={backgroundStyle}
      containerStyle={containerStyle}
    >
      <View className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
          {t('menu.selectOrderType', 'Chọn loại đơn')}
        </Text>
      </View>

      <BottomSheetFlatList
        data={orderTypes}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={
          <View className="items-center px-4 py-8">
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {t('menu.noOrderTypes', 'Không có loại đơn nào')}
            </Text>
          </View>
        }
      />
    </BottomSheet>
  )
}

// Hàm helper mở sheet với retry logic (export để dùng ở component khác)
export function openOrderTypeSheet() {
  if (openCallback) {
    clearOrderTypeOpenRetries()
    openCallback()
  } else if (sheetRef) {
    clearOrderTypeOpenRetries()
    try {
      sheetRef.snapToIndex(0)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[OrderTypeSheet.open] Error:', error)
    }
  } else {
    // Retry nhiều lần giống VoucherListDrawer
    // eslint-disable-next-line no-console
    console.warn(
      '[OrderTypeSheet.open] Both sheetRef and openCallback are null, retrying with multiple attempts...',
    )

    clearOrderTypeOpenRetries()
    const attempts = [100, 200, 300, 500, 1000]
    attempts.forEach((delay, index) => {
      const id = setTimeout(() => {
        if (openCallback) {
          clearOrderTypeOpenRetries()
          openCallback()
        } else if (sheetRef) {
          try {
            clearOrderTypeOpenRetries()
            sheetRef.snapToIndex(0)
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `[OrderTypeSheet.open] Retry ${index + 1} error:`,
              error,
            )
          }
        } else if (index === attempts.length - 1) {
          // eslint-disable-next-line no-console
          console.error(
            '[OrderTypeSheet.open] All retry attempts failed. Component may not be mounted.',
          )
        }
      }, delay)
      openRetryTimeoutIds.push(id)
    })
  }
}

// Static method để mở sheet (giữ compat cũ nếu có nơi khác dùng)
;(OrderTypeSheet as unknown as { open?: () => void }).open = openOrderTypeSheet

export default OrderTypeSheet
