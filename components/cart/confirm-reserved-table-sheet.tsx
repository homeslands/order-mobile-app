import { colors } from '@/constants'
import { Text } from '@/components/ui/text'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ConfirmReservedTableSheetProps {
  visible: boolean
  tableName: string
  onConfirm: () => void
  onCancel: () => void
}

const SNAP_POINTS = ['30%']

export const ConfirmReservedTableSheet = memo(
  function ConfirmReservedTableSheet({
    visible,
    tableName,
    onConfirm,
    onCancel,
  }: ConfirmReservedTableSheetProps) {
    const sheetRef = useRef<BottomSheetModal>(null)
    const { t } = useTranslation('table')
    const { t: tCommon } = useTranslation('common')
    const isDark = useColorScheme() === 'dark'
    const { bottom } = useSafeAreaInsets()

    useEffect(() => {
      if (visible) sheetRef.current?.present()
      else sheetRef.current?.dismiss()
    }, [visible])

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

    const bgStyle = useMemo(
      () => ({
        backgroundColor: isDark ? colors.card.dark : colors.white.light,
      }),
      [isDark],
    )

    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => (
        <BottomSheetFooter {...props} bottomInset={bottom}>
          <View
            className="flex-row gap-3 border-t px-5 pb-4 pt-3"
            style={{
              backgroundColor: isDark ? colors.card.dark : colors.white.light,
              borderTopColor: isDark ? colors.border.dark : colors.border.light,
            }}
          >
            <TouchableOpacity
              onPress={onCancel}
              className="flex-1 items-center justify-center rounded-full border border-gray-300 bg-white py-3 dark:border-[#2e2e2e] dark:bg-[#1c1c1e]"
              activeOpacity={0.8}
            >
              <Text className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {tCommon('common.cancel')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              className="flex-1 items-center justify-center rounded-full py-3"
              activeOpacity={0.8}
              style={{
                backgroundColor: isDark
                  ? colors.destructive.dark
                  : colors.destructive.light,
              }}
            >
              <Text className="text-sm font-semibold text-white">
                {t('table.confirmReservedAction')}
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetFooter>
      ),
      [bottom, isDark, onCancel, onConfirm, t, tCommon],
    )

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP_POINTS}
        enablePanDownToClose
        enableContentPanningGesture={false}
        enableHandlePanningGesture
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={bgStyle}
        footerComponent={renderFooter}
        onDismiss={onCancel}
      >
        {/* paddingBottom clears the absolute-positioned BottomSheetFooter
            (footer height ~76: pt-3 12 + button 48 + pb-4 16) + safe-area bottom. */}
        <View
          className="px-5 pt-4"
          style={{ paddingBottom: bottom + 76 + 16 }}
        >
          <Text className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-50">
            {t('table.confirmReservedTitle')}
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {t('table.confirmReservedDescription', { name: tableName })}
          </Text>
        </View>
      </BottomSheetModal>
    )
  },
)
