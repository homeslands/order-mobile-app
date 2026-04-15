import { colors } from '@/constants'
import { type OrderTypeOption, useOrderTypeOptions } from '@/hooks/use-order-type-options'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { PackageCheck, UtensilsCrossed } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const ORDER_TYPE_SHEET_BASE_HEIGHT = 280

export const SimpleOrderTypeSheet = memo(function SimpleOrderTypeSheet({
  visible,
  onClose,
  isDark,
  primaryColor,
}: {
  visible: boolean
  onClose: () => void
  isDark: boolean
  primaryColor: string
}) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { t } = useTranslation('menu')
  const { bottom: bottomInset } = useSafeAreaInsets()
  // Fetch feature flags only when sheet is visible — defer pattern
  const { orderTypes, selectedType, handleChange: selectType } = useOrderTypeOptions({
    enabled: visible,
  })

  const snapPoints = useMemo(
    () => [ORDER_TYPE_SHEET_BASE_HEIGHT + bottomInset],
    [bottomInset],
  )
  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[900] : colors.white.light }),
    [isDark],
  )
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} pressBehavior="close" />
    ),
    [],
  )
  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const handleSelect = useCallback((value: string) => {
    selectType(value)
    sheetRef.current?.dismiss()
  }, [selectType])

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      onDismiss={onClose}
    >
          <View style={[orderTypeSheetStyles.content, { paddingBottom: bottomInset }]}>
            <Text style={[orderTypeSheetStyles.title, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>
              {t('menu.orderType')}
            </Text>
            {orderTypes.length === 0 && (
              <Text style={{ fontSize: 14, color: isDark ? colors.gray[400] : colors.gray[500], textAlign: 'center', paddingVertical: 16 }}>
                {t('menu.noData')}
              </Text>
            )}
            {orderTypes.map((opt: OrderTypeOption) => {
              const selected = selectedType?.value === opt.value
              const iconColor = selected ? primaryColor : isDark ? colors.gray[400] : colors.gray[500]
              const Icon = opt.value === 'take-out' ? PackageCheck : UtensilsCrossed
              return (
                <TouchableOpacity activeOpacity={0.7}
                  key={opt.value}
                  onPress={() => handleSelect(opt.value)}
                  style={[
                    orderTypeSheetStyles.option,
                    {
                      borderColor: selected ? primaryColor : isDark ? colors.gray[700] : colors.gray[200],
                      backgroundColor: selected ? `${primaryColor}10` : 'transparent',
                    },
                  ]}
                >
                  <Icon size={18} color={iconColor} />
                  <Text style={[orderTypeSheetStyles.optionLabel, { fontWeight: selected ? '600' : '400', color: isDark ? colors.gray[50] : colors.gray[900] }]}>
                    {opt.label}
                  </Text>
                  {selected && (
                    <View style={[orderTypeSheetStyles.radio, { backgroundColor: primaryColor }]}>
                      <View style={orderTypeSheetStyles.radioDot} />
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
    </BottomSheetModal>
  )
})

const orderTypeSheetStyles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white.light,
  },
})
