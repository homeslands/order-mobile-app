/**
 * Cài đặt — gom các tuỳ chọn của app về một chỗ.
 *
 * Trước đây bốn mục này nằm thẳng trong màn Tài khoản (nhóm cuối, ngay trên
 * nút Đăng xuất), làm màn đó dài và trộn lẫn dữ liệu tài khoản với tuỳ chọn
 * app. Giờ màn Tài khoản chỉ còn một dòng "Cài đặt" dẫn vào đây.
 *
 * Không có mục "Độ trong của kính": iOS 26 đã có sẵn núm đó ở Cài đặt hệ
 * thống (Clear ↔ Tinted) và app bám theo lựa chọn ấy — xem hooks/use-glass.ts.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Languages, SunMoon, Trash2, Type } from 'lucide-react-native'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, View, useColorScheme } from 'react-native'

import { FloatingHeader } from '@/components/navigation'
import {
  DeleteAccountSheet,
  FontSizeSheet,
  LanguageSheet,
  ProfileMenuItem,
  ThemeSheet,
  profileCardStyles,
} from '@/components/profile'
import { QUERYKEY, colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { useAuthStore, useUserStore } from '@/stores'
import { useNotificationStore } from '@/stores/notification.store'
import { resetHttpState } from '@/utils/http'

/** Màu chip icon — giữ đúng màu từng mục đã dùng ở màn Tài khoản. */
const ICON_COLORS = {
  teal: '#14b8a6',
  indigo: '#6366f1',
  red: '#ef4444',
} as const

export default function SettingsScreen() {
  const { t } = useTranslation('profile')
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const queryClient = useQueryClient()
  const setLogout = useAuthStore((s) => s.setLogout)
  const removeUserInfo = useUserStore((s) => s.removeUserInfo)

  const theme = useMemo(
    () => ({
      bg: isDark ? colors.background.dark : colors.background.light,
      card: isDark ? colors.card.dark : colors.white.light,
      text: isDark ? colors.gray[50] : colors.gray[900],
      textMuted: isDark ? colors.gray[400] : colors.gray[500],
      divider: isDark ? colors.gray[800] : colors.gray[200],
    }),
    [isDark],
  )

  const [isLangSheetOpen, setIsLangSheetOpen] = useState(false)
  const openLangSheet = useCallback(() => setIsLangSheetOpen(true), [])
  const closeLangSheet = useCallback(() => setIsLangSheetOpen(false), [])

  const [isThemeSheetOpen, setIsThemeSheetOpen] = useState(false)
  const openThemeSheet = useCallback(() => setIsThemeSheetOpen(true), [])
  const closeThemeSheet = useCallback(() => setIsThemeSheetOpen(false), [])

  const [isFontSizeSheetOpen, setIsFontSizeSheetOpen] = useState(false)
  const openFontSizeSheet = useCallback(() => setIsFontSizeSheetOpen(true), [])
  const closeFontSizeSheet = useCallback(
    () => setIsFontSizeSheetOpen(false),
    [],
  )

  const [showDeleteSheet, setShowDeleteSheet] = useState(false)
  const closeDeleteSheet = useCallback(() => setShowDeleteSheet(false), [])

  const handleDeletePress = useCallback(() => {
    Alert.alert(
      t('profile.deleteAccount.title'),
      t('profile.deleteAccount.warning'),
      [
        { text: t('profile.deleteAccount.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteAccount.continue'),
          style: 'destructive',
          onPress: () => setShowDeleteSheet(true),
        },
      ],
    )
  }, [t])

  const handleDeleteSuccess = useCallback(() => {
    resetHttpState()
    queryClient.removeQueries({ queryKey: [QUERYKEY.loyaltyPoints] })
    // Capture token BEFORE removeUserInfo() clears it — avoids race condition
    // where cleanupTokenOnLogout() reads null and skips server unregister
    const capturedToken = useUserStore.getState().deviceToken
    setLogout()
    removeUserInfo()
    useNotificationStore.getState().clearAll()
    router.replace('/(tabs)/home' as never)
    // FCM cleanup runs in background — không block navigation
    void import('@/lib/fcm-token-manager').then(({ cleanupTokenOnLogout }) =>
      Promise.race([
        cleanupTokenOnLogout(capturedToken ?? undefined),
        new Promise<void>((r) => setTimeout(r, 3000)),
      ]).catch(() => {}),
    )
  }, [removeUserInfo, setLogout, router, queryClient])

  const handleBack = useCallback(() => router.back(), [router])

  const primaryColor = isDark ? colors.primary.dark : colors.primary.light
  const divider = (
    <View
      style={[profileCardStyles.divider, { backgroundColor: theme.divider }]}
    />
  )

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: STATIC_TOP_INSET + 76 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[profileCardStyles.card, { backgroundColor: theme.card }]}>
          <ProfileMenuItem
            icon={Languages}
            iconColor={ICON_COLORS.teal}
            title={t('profile.language.title', 'Ngôn ngữ')}
            onPress={openLangSheet}
            textColor={theme.text}
            textMuted={theme.textMuted}
          />
          {divider}
          <ProfileMenuItem
            icon={SunMoon}
            iconColor={ICON_COLORS.indigo}
            title={t('profile.theme.title', 'Giao diện')}
            onPress={openThemeSheet}
            textColor={theme.text}
            textMuted={theme.textMuted}
          />
          {divider}
          <ProfileMenuItem
            icon={Type}
            iconColor={ICON_COLORS.teal}
            title={t('profile.fontSize.title', 'Cỡ chữ')}
            onPress={openFontSizeSheet}
            textColor={theme.text}
            textMuted={theme.textMuted}
          />
        </View>

        {/* Xoá tài khoản tách sang thẻ riêng: nó là hành động không quay lại
            được, không nên nằm sát các tuỳ chọn đổi lúc nào cũng được. */}
        <View style={[profileCardStyles.card, { backgroundColor: theme.card }]}>
          <ProfileMenuItem
            icon={Trash2}
            iconColor={ICON_COLORS.red}
            title={t('profile.deleteAccount.title', 'Xoá tài khoản')}
            onPress={handleDeletePress}
            textColor={theme.text}
            textMuted={theme.textMuted}
          />
        </View>
      </ScrollView>

      <FloatingHeader
        title={t('profile.settings', 'Cài đặt')}
        onBack={handleBack}
      />

      <LanguageSheet
        visible={isLangSheetOpen}
        onClose={closeLangSheet}
        isDark={isDark}
        primaryColor={primaryColor}
      />
      <ThemeSheet
        visible={isThemeSheetOpen}
        onClose={closeThemeSheet}
        isDark={isDark}
        primaryColor={primaryColor}
      />
      <FontSizeSheet
        visible={isFontSizeSheetOpen}
        onClose={closeFontSizeSheet}
        isDark={isDark}
        primaryColor={primaryColor}
      />
      <DeleteAccountSheet
        visible={showDeleteSheet}
        onClose={closeDeleteSheet}
        onSuccess={handleDeleteSuccess}
      />
    </View>
  )
}
