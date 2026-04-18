import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import i18n from 'i18next'
import { Check } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg'

import { colors } from '@/constants'
import { useUpdateLanguage } from '@/hooks'
import { useUserStore } from '@/stores'
import { showToast } from '@/utils'

const FLAG_W = 36
const FLAG_H = 24

const FlagVN = memo(function FlagVN() {
  const star =
    'M15,4.5 L16.23,8.3 L20.23,8.3 L17,10.65 L18.23,14.45 L15,12.1 L11.77,14.45 L13,10.65 L9.77,8.3 L13.77,8.3 Z'
  return (
    <Svg width={FLAG_W} height={FLAG_H} viewBox="0 0 30 20">
      <Defs>
        <ClipPath id="vn">
          <Rect width={30} height={20} rx={2} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#vn)">
        <Rect width={30} height={20} fill="#DA251D" />
        <Path d={star} fill="#FFFF00" />
      </G>
    </Svg>
  )
})

const FlagUK = memo(function FlagUK() {
  return (
    <Svg width={FLAG_W} height={FLAG_H} viewBox="0 0 60 30">
      <Defs>
        <ClipPath id="uk">
          <Rect width={60} height={30} rx={2} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#uk)">
        <Rect width={60} height={30} fill="#012169" />
        <Path d="M0 0L60 30M60 0L0 30" stroke="#fff" strokeWidth={6} />
        <Path d="M0 0L60 30M60 0L0 30" stroke="#C8102E" strokeWidth={4} />
        <Path d="M30 0V30M0 15H60" stroke="#fff" strokeWidth={10} />
        <Path d="M30 0V30M0 15H60" stroke="#C8102E" strokeWidth={6} />
      </G>
    </Svg>
  )
})

const LANGUAGES = [
  { code: 'vi', label: 'Tiếng Việt', Flag: FlagVN },
  { code: 'en', label: 'English', Flag: FlagUK },
] as const

export const LanguageSheet = memo(function LanguageSheet({
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
  const userInfo = useUserStore((s) => s.userInfo)
  const setUserInfo = useUserStore((s) => s.setUserInfo)
  const { mutate: updateLang, isPending } = useUpdateLanguage()
  const currentLang = userInfo?.language ?? i18n.language ?? 'vi'

  const snapPoints = useMemo(() => [180 + bottom], [bottom])
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
    (code: string) => {
      if (code === currentLang || isPending) return
      if (userInfo?.slug) {
        updateLang(
          { userSlug: userInfo.slug, language: code },
          {
            onSuccess: () => {
              // Preserve existing userInfo (branch, role, etc.) — the language
              // endpoint may return a partial object missing the branch field,
              // which would clear userBranchSlug and trigger "branch not selected".
              const current = useUserStore.getState().userInfo
              if (current) setUserInfo({ ...current, language: code })
              i18n.changeLanguage(code)
              showToast(t('profile.language.switched', { lng: code }))
              sheetRef.current?.dismiss()
            },
            onError: () => {
              showToast(t('profile.language.switchFailed', { lng: code }))
            },
          },
        )
      } else {
        i18n.changeLanguage(code)
        showToast(t('profile.language.switched', { lng: code }))
        sheetRef.current?.dismiss()
      }
    },
    [currentLang, isPending, userInfo, updateLang, setUserInfo, t],
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
          {t('profile.language.title', 'Ngôn ngữ')}
        </Text>
        {LANGUAGES.map(({ code, label, Flag }, idx) => {
          const active = currentLang === code
          return (
            <View key={code}>
              {idx > 0 && (
                <View style={[s.divider, { backgroundColor: dividerColor }]} />
              )}
              <TouchableOpacity
                style={s.row}
                onPress={() => handleSelect(code)}
                activeOpacity={0.6}
                disabled={isPending}
              >
                <View style={s.flagWrap}>
                  <Flag />
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
                  {label}
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
  flagWrap: {
    width: FLAG_W,
    height: FLAG_H,
  },
  label: {
    flex: 1,
    fontSize: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: FLAG_W + 14,
  },
})
