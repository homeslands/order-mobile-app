import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { Image } from 'expo-image'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Images } from '@/assets/images'
import { colors, ROUTE } from '@/constants'
import { navigateNative } from '@/lib/navigation'
import { useUserStore } from '@/stores'
import { getSyncItem, setSyncItem } from '@/utils/storage'

const SNAP_POINTS = ['40%']
const STORAGE_KEY = '@nudge_dob_dismissed'

export const ProfileNudgePopup = memo(function ProfileNudgePopup() {
  const userInfo = useUserStore((s) => s.userInfo)
  const { t } = useTranslation('profile')
  const isDark = useColorScheme() === 'dark'
  const { bottom } = useSafeAreaInsets()
  const sheetRef = useRef<BottomSheetModal>(null)
  const hasPresented = useRef(false)

  const needsDob = !!userInfo && !userInfo.dob

  useEffect(() => {
    if (!needsDob) return
    if (hasPresented.current) return
    if (getSyncItem(STORAGE_KEY) !== null) return
    hasPresented.current = true
    const timer = setTimeout(() => {
      sheetRef.current?.present()
    }, 500)
    return () => clearTimeout(timer)
  }, [needsDob])

  const handleSheetDismiss = useCallback(() => {
    setSyncItem(STORAGE_KEY, '1')
  }, [])

  const handleCTA = useCallback(() => {
    sheetRef.current?.dismiss()
    navigateNative.push(ROUTE.CLIENT_PROFILE_EDIT as never)
  }, [])

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

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={bottom}>
        <View
          style={[
            styles.footer,
            {
              backgroundColor: isDark ? colors.card.dark : '#ffffff',
              borderTopColor: isDark ? colors.border.dark : colors.border.light,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => sheetRef.current?.dismiss()}
            activeOpacity={0.7}
            style={[
              styles.dismissBtn,
              {
                borderColor: isDark ? colors.border.dark : colors.border.light,
              },
            ]}
          >
            <Text
              style={[
                styles.dismissText,
                { color: isDark ? colors.gray[400] : colors.gray[500] },
              ]}
            >
              {t('profile.dobNudge.dismiss')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCTA}
            activeOpacity={0.8}
            style={styles.ctaBtn}
          >
            <Text style={styles.ctaText}>{t('profile.dobNudge.cta')}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetFooter>
    ),
    [bottom, handleCTA, isDark, t],
  )

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.card.dark : '#ffffff' }),
    [isDark],
  )

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      footerComponent={renderFooter}
      backgroundStyle={bgStyle}
      onDismiss={handleSheetDismiss}
    >
      <View style={styles.content}>
        <Image
          source={isDark ? Images.Brand.LogoWhite : Images.Brand.Logo}
          style={styles.logo}
          contentFit="contain"
        />

        <Text
          style={[styles.title, { color: isDark ? colors.gray[50] : colors.gray[900] }]}
        >
          {t('profile.dobNudge.title')}
        </Text>

        <Text
          style={[styles.subtitle, { color: isDark ? colors.gray[400] : colors.gray[500] }]}
        >
          {t('profile.dobNudge.subtitle')}
        </Text>
      </View>
    </BottomSheetModal>
  )
})

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 16,
  },
  logo: {
    width: 110,
    height: 48,
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontFamily: 'BeVietnamPro_600SemiBold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'BeVietnamPro_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: 14,
    fontFamily: 'BeVietnamPro_600SemiBold',
  },
  ctaBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 14,
    fontFamily: 'BeVietnamPro_600SemiBold',
    color: '#ffffff',
  },
})
