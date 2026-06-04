import { colors } from '@/constants'
import {
  type OrderTypeOption,
  useOrderTypeOptions,
} from '@/hooks/use-order-type-options'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { PackageCheck, Truck, UtensilsCrossed } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'

const ORDER_TYPE_SHEET_BASE_HEIGHT = 320

const ORDER_TYPE_ICONS = {
  'take-out': PackageCheck,
  delivery: Truck,
} as const

const ORDER_TYPE_SUBTITLES: Record<string, string> = {
  'at-table': 'Thưởng thức tại cửa hàng',
  'take-out': 'Đặt để mang đi',
  delivery: 'Giao đến địa chỉ của bạn',
}

export const SimpleOrderTypeSheet = memo(function SimpleOrderTypeSheet({
  visible,
  onClose,
  onDeliverySelected,
  isDark,
  primaryColor,
}: {
  visible: boolean
  onClose: () => void
  onDeliverySelected?: () => void
  isDark: boolean
  primaryColor: string
}) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { t } = useTranslation('menu')
  const { bottom: bottomInset } = useSafeAreaInsets()
  const {
    orderTypes,
    selectedType,
    handleChange: selectType,
  } = useOrderTypeOptions({
    enabled: visible,
  })

  const snapPoints = useMemo(
    () => [ORDER_TYPE_SHEET_BASE_HEIGHT + bottomInset],
    [bottomInset],
  )
  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.card.dark : colors.white.light }),
    [isDark],
  )
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  )
  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const handleSelect = useCallback(
    (value: string) => {
      selectType(value)
      sheetRef.current?.dismiss()
      if (value === 'delivery') onDeliverySelected?.()
    },
    [selectType, onDeliverySelected],
  )

  const iconBg = isDark ? 'rgba(255,255,255,0.06)' : colors.gray[100]
  const mutedColor = isDark ? colors.gray[400] : colors.gray[500]
  const labelColor = isDark ? colors.gray[50] : colors.gray[900]
  const radioRingColor = isDark ? colors.border.dark : colors.gray[300]

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
      <View
        style={[orderTypeSheetStyles.content, { paddingBottom: bottomInset }]}
      >
        <Text
          style={[orderTypeSheetStyles.title, { color: labelColor }]}
        >
          {t('menu.orderType')}
        </Text>
        {orderTypes.length === 0 && (
          <Text
            style={{
              fontSize: 14,
              color: mutedColor,
              textAlign: 'center',
              paddingVertical: 16,
            }}
          >
            {t('menu.noData')}
          </Text>
        )}
        {orderTypes.map((opt: OrderTypeOption) => {
          const selected = selectedType?.value === opt.value
          const Icon = ORDER_TYPE_ICONS[opt.value as keyof typeof ORDER_TYPE_ICONS] ?? UtensilsCrossed
          const iconColor = selected ? primaryColor : mutedColor

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              key={opt.value}
              onPress={() => handleSelect(opt.value)}
              style={[
                orderTypeSheetStyles.option,
                {
                  borderColor: selected
                    ? primaryColor
                    : isDark
                      ? colors.border.dark
                      : colors.gray[200],
                  backgroundColor: selected
                    ? `${primaryColor}10`
                    : 'transparent',
                },
              ]}
            >
              {/* Icon with background */}
              <View
                style={[
                  orderTypeSheetStyles.iconWrap,
                  {
                    backgroundColor: selected
                      ? `${primaryColor}20`
                      : iconBg,
                  },
                ]}
              >
                <Icon size={20} color={iconColor} />
              </View>

              {/* Label + subtitle */}
              <View style={orderTypeSheetStyles.textBlock}>
                <Text
                  style={[
                    orderTypeSheetStyles.optionLabel,
                    {
                      fontWeight: selected ? '600' : '400',
                      color: labelColor,
                    },
                  ]}
                >
                  {opt.label}
                </Text>
                <Text
                  style={[
                    orderTypeSheetStyles.optionSubtitle,
                    { color: mutedColor },
                  ]}
                >
                  {ORDER_TYPE_SUBTITLES[opt.value]}
                </Text>
              </View>

              {/* Always-visible radio ring */}
              <View
                style={[
                  orderTypeSheetStyles.radio,
                  {
                    borderColor: selected ? primaryColor : radioRingColor,
                    backgroundColor: selected ? primaryColor : 'transparent',
                  },
                ]}
              >
                {selected && <View style={orderTypeSheetStyles.radioDot} />}
              </View>
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 15,
  },
  optionSubtitle: {
    fontSize: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
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
