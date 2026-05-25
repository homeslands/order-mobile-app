import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { Check } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text as RNText, View } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import {
  PRESET_SCALE,
  type FontScalePreset,
  useFontScaleStore,
} from '@/stores/font-scale.store'

const PRESETS: {
  preset: FontScalePreset
  labelKey: string
  fallback: string
}[] = [
  { preset: 'small', labelKey: 'profile.fontSize.small', fallback: 'Nhỏ' },
  { preset: 'normal', labelKey: 'profile.fontSize.normal', fallback: 'Vừa' },
  { preset: 'large', labelKey: 'profile.fontSize.large', fallback: 'Lớn' },
]

export const FontSizeSheet = memo(function FontSizeSheet({
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
  const { t } = useTranslation('profile')
  const { bottom } = useSafeAreaInsets()

  const currentPreset = useFontScaleStore((s) => s.preset)
  const setPreset = useFontScaleStore((s) => s.setPreset)

  const snapPoints = useMemo(() => [240 + bottom], [bottom])
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
    (preset: FontScalePreset) => {
      setPreset(preset)
      sheetRef.current?.dismiss()
    },
    [setPreset],
  )

  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const dividerColor = isDark ? colors.gray[700] : colors.gray[200]

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
      <View style={[s.content, { paddingBottom: bottom + 8 }]}>
        <RNText
          maxFontSizeMultiplier={1.0}
          style={[s.title, { color: textColor }]}
        >
          {t('profile.fontSize.title', 'Cỡ chữ')}
        </RNText>

        {PRESETS.map(({ preset, labelKey, fallback }, idx) => {
          const active = currentPreset === preset
          const previewSize = 15 * PRESET_SCALE[preset]

          return (
            <View key={preset}>
              {idx > 0 && (
                <View
                  style={[s.divider, { backgroundColor: dividerColor }]}
                />
              )}
              <TouchableOpacity
                style={s.row}
                onPress={() => handleSelect(preset)}
                activeOpacity={0.6}
              >
                <RNText
                  maxFontSizeMultiplier={1.0}
                  style={[
                    s.label,
                    {
                      color: active ? primaryColor : textColor,
                      fontFamily: active
                        ? 'BeVietnamPro_600SemiBold'
                        : 'BeVietnamPro_400Regular',
                    },
                  ]}
                >
                  {t(labelKey, fallback)}
                </RNText>

                <RNText
                  maxFontSizeMultiplier={1.0}
                  style={[
                    s.preview,
                    {
                      fontSize: previewSize,
                      color: active ? primaryColor : textColor,
                      fontFamily: 'BeVietnamPro_400Regular',
                    },
                  ]}
                >
                  {t('profile.fontSize.preview', 'Văn bản mẫu')}
                </RNText>

                {active && (
                  <Check size={18} color={primaryColor} strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            </View>
          )
        })}
      </View>
    </BottomSheetModal>
  )
})

const s = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: 'BeVietnamPro_700Bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  label: {
    flex: 1,
    fontSize: 15,
  },
  preview: {
    marginRight: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 0,
  },
})
