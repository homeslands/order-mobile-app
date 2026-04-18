/**
 * Thông tin cá nhân — UI giống Profile: avatar, 2 nút header, các trường thông tin bên dưới.
 */
import { colors, publicFileURL } from '@/constants'
import { ROUTE } from '@/constants/route.contstant'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { navigateNative } from '@/lib/navigation'
import { useAuthStore, useUserStore } from '@/stores'
import { useLogoutSheetStore } from '@/stores/logout-sheet.store'
import { showToast } from '@/utils'
import { BlurView } from 'expo-blur'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import {
  ChevronLeft,
  Mail,
  MapPin,
  Phone,
  Shield,
  User as UserIcon,
} from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const AVATAR_SIZE = 100
const HEADER_HEIGHT = 240

const PROFILE_THEME = {
  light: {
    bg: colors.background.light,
    card: '#ffffff',
    text: colors.foreground.light,
    textMuted: colors.mutedForeground.light,
    editBtn: colors.border.light,
    divider: 'rgba(0,0,0,0.06)',
    avatarFallback: colors.border.light,
  },
  dark: {
    bg: '#1F2B3E',
    card: '#2B3B4C',
    text: colors.foreground.dark,
    textMuted: '#8B9BB2',
    editBtn: '#3D4F66',
    divider: 'rgba(255,255,255,0.08)',
    avatarFallback: '#2B3B4C',
  },
} as const

const ICON_COLORS = {
  blue: '#5DA8E8',
  red: '#E85D5D',
  green: '#4CAF50',
}

// ─── Header — cart style ──────────────────────────────────────────────────────

const GIHeader = React.memo(function GIHeader({
  onBack,
  onEdit,
  isDark,
  pageBg,
}: {
  onBack: () => void
  onEdit: () => void
  isDark: boolean
  pageBg: string
}) {
  const { t } = useTranslation('profile')
  const gradientColors = useMemo(
    () =>
      [
        pageBg,
        `${pageBg}E6`,
        `${pageBg}B0`,
        `${pageBg}50`,
        `${pageBg}00`,
      ] as const,
    [pageBg],
  )
  return (
    <View style={hStyles.container} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Platform.OS === 'ios' && (
          <BlurView
            intensity={20}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={gradientColors}
          locations={[0, 0.3, 0.62, 0.85, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        style={[hStyles.row, { paddingTop: STATIC_TOP_INSET + 10 }]}
        pointerEvents="auto"
      >
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={[
            hStyles.circleBtn,
            { backgroundColor: isDark ? colors.gray[800] : colors.white.light },
            hStyles.shadow,
          ]}
        >
          <ChevronLeft
            size={20}
            color={isDark ? colors.gray[50] : colors.gray[900]}
          />
        </Pressable>
        <View style={hStyles.circleBtn} />
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={[
            hStyles.editPill,
            { backgroundColor: isDark ? colors.gray[800] : colors.white.light },
            hStyles.shadow,
          ]}
        >
          <Text
            style={[
              hStyles.editText,
              { color: isDark ? colors.gray[50] : colors.gray[900] },
            ]}
          >
            {t('profile.edit', 'Sửa')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
})

const hStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPill: {
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: {
    fontSize: 15,
    fontWeight: '600',
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 24,
    elevation: 2,
  },
})

// ─── Info row ─────────────────────────────────────────────────────────────────

const InfoRow = React.memo(function InfoRow({
  icon: Icon,
  iconColor,
  label,
  value,
  theme,
}: {
  icon: React.ElementType
  iconColor: string
  label: string
  value: string
  theme: (typeof PROFILE_THEME)[keyof typeof PROFILE_THEME]
}) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIconWrap, { backgroundColor: iconColor }]}>
        <Icon size={18} color="#ffffff" />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: theme.textMuted }]}>
          {label}
        </Text>
        <Text
          style={[styles.infoValue, { color: theme.text }]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  )
})

const VerifiableInfoRow = React.memo(function VerifiableInfoRow({
  icon: Icon,
  iconColor,
  label,
  value,
  theme,
  isVerified,
  onVerify,
  verifyLabel,
  successColor,
}: {
  icon: React.ElementType
  iconColor: string
  label: string
  value: string
  theme: (typeof PROFILE_THEME)[keyof typeof PROFILE_THEME]
  isVerified: boolean
  onVerify: () => void
  verifyLabel: string
  successColor: string
}) {
  const { t } = useTranslation('profile')
  return (
    <View style={[styles.infoRow, { alignItems: 'center' }]}>
      <View style={[styles.infoIconWrap, { backgroundColor: iconColor }]}>
        <Icon size={18} color="#ffffff" />
      </View>
      <View style={styles.infoContent}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginBottom: 2,
          }}
        >
          <Text style={[styles.infoLabel, { color: theme.textMuted }]}>
            {label}
          </Text>
          {isVerified && (
            <Text style={[styles.infoLabel, { color: successColor }]}>
              {t('profile.contactInfo.verified')}
            </Text>
          )}
          {!isVerified && (
            <Text style={[styles.infoLabel, { color: '#CA8A04' }]}>
              {t('profile.contactInfo.notVerified')}
            </Text>
          )}
        </View>
        <Text
          style={[styles.infoValue, { color: theme.text }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
      {!isVerified && (
        <TouchableOpacity
          onPress={onVerify}
          hitSlop={8}
          style={[styles.verifyBtn, { borderColor: colors.primary.light }]}
        >
          <Text style={[styles.verifyBtnText, { color: colors.primary.light }]}>
            {verifyLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
})

export default function GeneralInfo() {
  const router = useRouter()
  const { width: screenWidth } = useWindowDimensions()
  const { bottom } = useSafeAreaInsets()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = PROFILE_THEME[isDark ? 'dark' : 'light']
  const { t } = useTranslation('profile')
  const { t: tToast } = useTranslation('toast')

  const userInfo = useUserStore((state) => state.userInfo)
  const setLogout = useAuthStore((state) => state.setLogout)
  const removeUserInfo = useUserStore((state) => state.removeUserInfo)
  const handleBack = useCallback(() => router.back(), [router])
  const handleEdit = useCallback(
    () => router.push('/(tabs)/profile/edit'),
    [router],
  )
  const isLoggingOutRef = useRef(false)
  const openLogoutSheet = useLogoutSheetStore((s) => s.open)

  const handleLogoutConfirm = useCallback(() => {
    isLoggingOutRef.current = true
    setLogout()
    removeUserInfo()
    router.replace('/(tabs)/home' as never)
    showToast(tToast('logoutSuccess', 'Đăng xuất thành công'))
  }, [removeUserInfo, router, setLogout, tToast])

  const handleLogoutPress = useCallback(() => {
    openLogoutSheet(handleLogoutConfirm)
  }, [openLogoutSheet, handleLogoutConfirm])

  const initials = useMemo(() => {
    const first = userInfo?.firstName?.charAt(0) || ''
    const last = userInfo?.lastName?.charAt(0) || ''
    return `${first}${last}`.toUpperCase()
  }, [userInfo?.firstName, userInfo?.lastName])

  useEffect(() => {
    // Khi đăng xuất, handleLogoutConfirm đã gọi router.replace — không gọi back() để tránh lỗi "GO_BACK was not handled"
    if (!userInfo && !isLoggingOutRef.current) {
      router.back()
    }
  }, [userInfo, router])

  if (!userInfo) {
    return null
  }

  const successColor = isDark ? colors.success.dark : colors.success.light

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Avatar tròn giữa */}
      <View
        style={[
          styles.avatarWrap,
          {
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            left: (screenWidth - AVATAR_SIZE) / 2,
            top: STATIC_TOP_INSET + 60,
          },
        ]}
      >
        {userInfo.image ? (
          <Image
            source={{
              uri: /^https?:\/\//i.test(userInfo.image)
                ? userInfo.image
                : `${publicFileURL}/${userInfo.image.replace(/^\//, '')}`,
              width: AVATAR_SIZE * 2,
              height: AVATAR_SIZE * 2,
            }}
            style={styles.avatarImage}
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              { backgroundColor: theme.avatarFallback },
            ]}
          >
            <Text
              style={[styles.avatarFallbackText, { color: theme.textMuted }]}
            >
              {initials || 'U'}
            </Text>
          </View>
        )}
      </View>

      {/* Tên và SĐT dưới avatar */}
      <View
        style={[
          styles.namePhoneWrap,
          { top: STATIC_TOP_INSET + 60 + AVATAR_SIZE + 12 },
        ]}
        pointerEvents="none"
      >
        <View style={styles.nameRow}>
          <Text
            style={[styles.nameText, { color: theme.text }]}
            numberOfLines={1}
          >
            {userInfo.firstName} {userInfo.lastName}
          </Text>
          {(userInfo.isVerifiedEmail || userInfo.isVerifiedPhonenumber) && (
            <Shield size={16} color={successColor} fill={successColor} />
          )}
        </View>
        <Text
          style={[styles.phoneText, { color: theme.textMuted }]}
          numberOfLines={1}
        >
          {userInfo.phonenumber ||
            t('profile.contactInfo.noPhone', 'Chưa cập nhật số điện thoại')}
        </Text>
      </View>

      {/* Các trường thông tin cá nhân */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: HEADER_HEIGHT + STATIC_TOP_INSET + 12,
            paddingBottom: bottom + 40,
          },
        ]}
      >
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
            {t('profile.contactInfo.title', 'Thông tin liên hệ')}
          </Text>

          <InfoRow
            icon={UserIcon}
            iconColor={ICON_COLORS.blue}
            label={t('profile.contactInfo.name', 'Họ và tên')}
            value={
              `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() ||
              t('profile.contactInfo.notUpdated', 'Chưa cập nhật')
            }
            theme={theme}
          />
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          <VerifiableInfoRow
            icon={Phone}
            iconColor={ICON_COLORS.green}
            label={t('profile.contactInfo.phone', 'Số điện thoại')}
            value={
              userInfo.phonenumber ||
              t('profile.contactInfo.notUpdated', 'Chưa cập nhật')
            }
            theme={theme}
            isVerified={!!userInfo.isVerifiedPhonenumber}
            onVerify={() =>
              navigateNative.push(ROUTE.CLIENT_PROFILE_VERIFY_PHONE_NUMBER)
            }
            verifyLabel={t('profile.contactInfo.verify', 'Xác thực')}
            successColor={successColor}
          />
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          <VerifiableInfoRow
            icon={Mail}
            iconColor={ICON_COLORS.red}
            label={t('profile.contactInfo.email', 'Email')}
            value={
              userInfo.email ||
              t('profile.contactInfo.notUpdated', 'Chưa cập nhật')
            }
            theme={theme}
            isVerified={!!userInfo.isVerifiedEmail}
            onVerify={() =>
              navigateNative.push(ROUTE.CLIENT_PROFILE_VERIFY_EMAIL)
            }
            verifyLabel={t('profile.contactInfo.verify', 'Xác thực')}
            successColor={successColor}
          />
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          <InfoRow
            icon={MapPin}
            iconColor={ICON_COLORS.blue}
            label={t('profile.contactInfo.address', 'Địa chỉ')}
            value={
              userInfo.address ||
              t('profile.contactInfo.notUpdated', 'Chưa cập nhật')
            }
            theme={theme}
          />
        </View>

        {userInfo.branch && (
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              {t('profile.contactInfo.branch', 'Chi nhánh đang phục vụ')}
            </Text>
            <Text style={[styles.branchName, { color: theme.text }]}>
              {userInfo.branch.name}
            </Text>
            <Text style={[styles.branchAddress, { color: theme.textMuted }]}>
              {userInfo.branch.address}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.logoutButton,
            {
              backgroundColor: colors.destructive[isDark ? 'dark' : 'light'],
            },
          ]}
          onPress={handleLogoutPress}
        >
          <Text style={styles.logoutText}>
            {t('profile.logout.title', 'Đăng xuất')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <GIHeader
        onBack={handleBack}
        onEdit={handleEdit}
        isDark={isDark}
        pageBg={theme.bg}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  avatarWrap: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 36,
    fontWeight: '700',
  },
  namePhoneWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
  },
  phoneText: {
    fontSize: 15,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '400',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 46,
  },
  branchName: {
    fontSize: 15,
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  branchAddress: {
    fontSize: 13,
    marginTop: 4,
  },
  verifyBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  verifyBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
})
