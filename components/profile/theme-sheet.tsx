import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { Check, Monitor, Moon, Sun } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import { applyTheme, type ThemeMode, useThemeStore } from '@/stores/theme.store'

const THEME_OPTIONS: {
  mode: ThemeMode
  icon: typeof Sun
  labelKey: string
  fallback: string
}[] = [
  {
    mode: 'light',
    icon: Sun,
    labelKey: 'profile.theme.light',
    fallback: 'Sáng',
  },
  { mode: 'dark', icon: Moon, labelKey: 'profile.theme.dark', fallback: 'Tối' },
  {
    mode: 'system',
    icon: Monitor,
    labelKey: 'profile.theme.system',
    fallback: 'Tự động',
  },
]

export const ThemeSheet = memo(function ThemeSheet({
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
  const currentTheme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  const snapPoints = useMemo(() => [220 + bottom], [bottom])
  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[900] : colors.white.light }),
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
    (mode: ThemeMode) => {
      setTheme(mode)
      applyTheme(mode)
      sheetRef.current?.dismiss()
    },
    [setTheme],
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
        <Text style={[s.title, { color: textColor }]}>
          {t('profile.theme.title', 'Giao diện')}
        </Text>
        {THEME_OPTIONS.map(({ mode, icon: Icon, labelKey, fallback }, idx) => {
          const active = currentTheme === mode
          return (
            <View key={mode}>
              {idx > 0 && (
                <View style={[s.divider, { backgroundColor: dividerColor }]} />
              )}
              <TouchableOpacity
                style={s.row}
                onPress={() => handleSelect(mode)}
                activeOpacity={0.6}
              >
                <View style={s.iconWrap}>
                  <Icon size={20} color={active ? primaryColor : textColor} />
                </View>
                <Text
                  style={[
                    s.label,
                    {
                      color: active ? primaryColor : textColor,
                      fontWeight: active ? '600' : '400',
                    },
                  ]}
                >
                  {t(labelKey, fallback)}
                </Text>
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

const ICON_SIZE = 20

const s = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  iconWrap: {
    width: ICON_SIZE + 16,
    alignItems: 'center',
  },
  label: {
    flex: 1,
    fontSize: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: ICON_SIZE + 16 + 14,
  },
})
