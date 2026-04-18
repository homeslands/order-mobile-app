import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, useColorScheme, View } from 'react-native'

import { colors } from '@/constants'
import { useOrderFlowStore } from '@/stores'
import { IProductVariant } from '@/types'

let sheetRef: BottomSheet | null = null
let openCallback: ((itemId: string) => void) | null = null
let pendingItemId: string | null = null
let currentItemId: string | null = null

interface ProductVariantSheetProps {
  /** Lazy mount: itemId khi mở từ cart — thay cho openForItem() gọi trước mount */
  initialItemId?: string
  /** Gọi khi sheet đóng (index -1) — reset parent state */
  onClose?: () => void
}

function ProductVariantSheet({
  initialItemId,
  onClose,
}: ProductVariantSheetProps = {}) {
  const { t } = useTranslation('product')
  const isDark = useColorScheme() === 'dark'
  const bottomSheetRef = useRef<BottomSheet>(null)

  // Đăng ký ref global + openCallback theo pattern ổn định
  useEffect(() => {
    const currentRef = bottomSheetRef.current
    if (currentRef) {
      sheetRef = currentRef
      openCallback = (itemId: string) => {
        pendingItemId = itemId
      }
    }
    return () => {
      if (sheetRef === currentRef) {
        sheetRef = null
      }
    }
  }, [])

  const snapPoints = useMemo(() => ['45%'], [])

  // Chỉ chạy khi mount — xử lý openForItem trước mount hoặc initialItemId (lazy load).
  useEffect(() => {
    const itemId = initialItemId ?? pendingItemId
    if (!itemId) return

    currentItemId = itemId
    pendingItemId = null

    const open = () => {
      if (sheetRef) {
        sheetRef.snapToIndex(0)
        return true
      }
      return false
    }

    if (!open()) {
      const t = setTimeout(open, 100)
      return () => clearTimeout(t)
    }
  }, [initialItemId])

  const getCartItems = useOrderFlowStore((s) => s.getCartItems)
  const updateOrderingItemVariant = useOrderFlowStore(
    (s) => s.updateOrderingItemVariant,
  )
  const cartItems = getCartItems()

  const effectiveItemId = initialItemId ?? currentItemId
  const activeItem =
    cartItems?.orderItems.find((i) => i.id === effectiveItemId) ?? null
  const variants = (activeItem?.allVariants || []) as IProductVariant[]
  const selectedSlug = (activeItem?.variant as IProductVariant | undefined)
    ?.slug

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index < 0) onClose?.()
    },
    [onClose],
  )

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

  const renderItem = useCallback(
    ({ item }: { item: IProductVariant }) => {
      const isSelected = item.slug === selectedSlug
      const sizeName = item.size?.name || ''

      const handlePress = () => {
        if (!effectiveItemId) return
        updateOrderingItemVariant(effectiveItemId, item)
        sheetRef?.close()
      }

      return (
        <View className="px-4 py-1.5">
          <View className="flex-row items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
            <View className="flex-1">
              <Text
                className="text-sm font-medium text-gray-900 dark:text-gray-50"
                onPress={handlePress}
              >
                {sizeName || t('product.size', 'Size mặc định')}
              </Text>
            </View>

            <View className="ml-3">
              <View className="h-5 w-5 items-center justify-center rounded-full border border-gray-300 dark:border-gray-600">
                {isSelected && (
                  <Text className="text-[11px] font-semibold text-primary">
                    ✓
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
      )
    },
    [selectedSlug, t, updateOrderingItemVariant, effectiveItemId],
  )

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableDynamicSizing={false}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: isDark ? '#111827' : '#ffffff',
      }}
      containerStyle={{
        zIndex: 9999,
        elevation: 9999,
      }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? colors.mutedForeground.dark : '#d1d5db',
      }}
    >
      <View className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
          {t('product.selectSize', 'Chọn size')}
        </Text>
      </View>

      {variants.length > 0 ? (
        <BottomSheetFlatList
          data={variants}
          keyExtractor={(item: IProductVariant) => item.slug}
          renderItem={renderItem}
          initialNumToRender={8}
          windowSize={5}
          maxToRenderPerBatch={8}
          removeClippedSubviews
        />
      ) : (
        <View className="flex-1 items-center justify-center py-12">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {t('product.noVariants', 'Không có size khác')}
          </Text>
        </View>
      )}
    </BottomSheet>
  )
}

// static open cho cart item
ProductVariantSheet.openForItem = (itemId: string) => {
  if (openCallback) {
    openCallback(itemId)
  } else {
    pendingItemId = itemId
  }
  if (sheetRef) {
    currentItemId = itemId
    sheetRef.snapToIndex(0)
  }
}

export default ProductVariantSheet
