import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { Bike, PackageCheck, UtensilsCrossed } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors } from '@/constants'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'

const SNAP_POINTS = [300]

export const SimpleOrderTypeSheetInUpdateOrder = memo(
  function SimpleOrderTypeSheetInUpdateOrder({
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
    const selectedType = useOrderFlowStore(
      (s) => s.updatingData?.updateDraft?.type as OrderTypeEnum | undefined,
    )
    const setDraftType = useOrderFlowStore((s) => s.setDraftType)

    const orderTypes = useMemo(
      () => [
        { value: OrderTypeEnum.AT_TABLE, label: t('menu.dineIn') },
        { value: OrderTypeEnum.TAKE_OUT, label: t('menu.takeAway') },
        { value: OrderTypeEnum.DELIVERY, label: t('menu.delivery') },
      ],
      [t],
    )

    const bgStyle = useMemo(
      () => ({
        backgroundColor: isDark ? colors.gray[900] : colors.white.light,
      }),
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
      if (visible) {
        sheetRef.current?.present()
      } else {
        sheetRef.current?.dismiss()
      }
    }, [visible])

    const handleSelect = useCallback(
      (value: OrderTypeEnum) => {
        setDraftType(value)
        sheetRef.current?.dismiss()
      },
      [setDraftType],
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
        onDismiss={onClose}
      >
        <View style={s.content}>
          <Text
            style={[
              s.title,
              { color: isDark ? colors.gray[50] : colors.gray[900] },
            ]}
          >
            {t('menu.orderType')}
          </Text>
          {orderTypes.map((opt) => {
            const selected = selectedType === opt.value
            const iconColor = selected
              ? primaryColor
              : isDark
                ? colors.gray[400]
                : colors.gray[500]
            const Icon =
              opt.value === OrderTypeEnum.TAKE_OUT
                ? PackageCheck
                : opt.value === OrderTypeEnum.DELIVERY
                  ? Bike
                  : UtensilsCrossed
            return (
              <Pressable
                key={opt.value}
                onPress={() => handleSelect(opt.value)}
                style={[
                  s.option,
                  {
                    borderColor: selected
                      ? primaryColor
                      : isDark
                        ? colors.gray[700]
                        : colors.gray[200],
                    backgroundColor: selected
                      ? `${primaryColor}10`
                      : 'transparent',
                  },
                ]}
              >
                <Icon size={18} color={iconColor} />
                <Text
                  style={[
                    s.optionLabel,
                    {
                      fontWeight: selected ? '600' : '400',
                      color: isDark ? colors.gray[50] : colors.gray[900],
                    },
                  ]}
                >
                  {opt.label}
                </Text>
                {selected && (
                  <View style={[s.radio, { backgroundColor: primaryColor }]}>
                    <View style={s.radioDot} />
                  </View>
                )}
              </Pressable>
            )
          })}
        </View>
      </BottomSheetModal>
    )
  },
)

const s = StyleSheet.create({
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
