/**
 * Trang cập nhật thông tin cá nhân.
 * Header: Huỷ bỏ (quay về thông tin cá nhân), tiêu đề, Xác nhận (mở bottom sheet).
 * Các trường chia theo mục. DOB chọn bằng 3 cuộn ngày-tháng-năm.
 */
import { getProfile, updateProfile } from '@/api/profile'
import {
  ConfirmUpdateProfileBottomSheet,
  type ConfirmUpdateProfileBottomSheetRef,
  DobExpandablePicker,
} from '@/components/profile'
import { Input } from '@/components/ui'
import { colors } from '@/constants/colors.constant'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { useUserStore } from '@/stores'
import type { IUserInfo } from '@/types'
import { showToast } from '@/utils'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Check } from 'lucide-react-native'
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

dayjs.extend(customParseFormat)

/** Chuẩn hóa dob từ API (DD/MM/YYYY hoặc YYYY-MM-DD) sang YYYY-MM-DD */
function normalizeDob(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return ''
  const ddmmyyyy = dayjs(value, 'DD/MM/YYYY', true)
  const yyyymmdd = dayjs(value, 'YYYY-MM-DD', true)
  if (ddmmyyyy.isValid()) return ddmmyyyy.format('YYYY-MM-DD')
  if (yyyymmdd.isValid()) return yyyymmdd.format('YYYY-MM-DD')
  return ''
}


const PROFILE_THEME = {
  light: {
    bg: colors.background.light,
    card: colors.white.light,
    text: colors.foreground.light,
    textMuted: colors.mutedForeground.light,
    editBtn: colors.border.light,
  },
  dark: {
    bg: '#1F2B3E',
    card: '#2B3B4C',
    text: colors.foreground.dark,
    textMuted: '#8B9BB2',
    editBtn: '#3D4F66',
  },
} as const

/** Isolated text field — only this component re-renders on keystroke */
const FormField = React.memo(function FormField({
  label,
  value: initialValue,
  onChangeRef,
  placeholder,
  labelColor,
  editable = true,
  autoCapitalize,
  inputClassName,
  onChange,
}: {
  label: string
  value: string
  onChangeRef: React.MutableRefObject<string>
  placeholder?: string
  labelColor: string
  editable?: boolean
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  inputClassName?: string
  onChange?: () => void
}) {
  const [localValue, setLocalValue] = useState(initialValue)
  const handleChange = useCallback(
    (text: string) => {
      setLocalValue(text)
      onChangeRef.current = text
      onChange?.()
    },
    [onChangeRef, onChange],
  )

  return (
    <View style={editFieldStyles.field}>
      <Text style={[editFieldStyles.label, { color: labelColor }]}>{label}</Text>
      <Input
        value={localValue}
        onChangeText={editable ? handleChange : undefined}
        placeholder={placeholder}
        editable={editable}
        autoCapitalize={autoCapitalize}
        className={inputClassName}
      />
    </View>
  )
})

const editFieldStyles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { fontSize: 12, marginBottom: 6 },
})

function EditHeader({
  title,
  onCancel,
  onConfirm,
  isDirty,
  isDark,
}: {
  title: string
  onCancel: () => void
  onConfirm: () => void
  isDirty: boolean
  isDark: boolean
}) {
  const { t } = useTranslation('profile')
  const pageBg = isDark ? '#1F2B3E' : colors.background.light
  const gradientColors = useMemo(
    () => [pageBg, `${pageBg}E6`, `${pageBg}B0`, `${pageBg}50`, `${pageBg}00`] as const,
    [pageBg],
  )
  const confirmBg = isDirty
    ? isDark ? colors.primary.dark : colors.primary.light
    : isDark ? colors.gray[800] : colors.white.light
  const confirmIconColor = isDirty
    ? '#fff'
    : isDark ? colors.gray[500] : colors.gray[300]

  return (
    <View style={ehStyles.container} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={gradientColors}
          locations={[0, 0.3, 0.62, 0.85, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        style={[ehStyles.row, { paddingTop: STATIC_TOP_INSET + 10 }]}
        pointerEvents="auto"
      >
        <Pressable
          onPress={onCancel}
          hitSlop={8}
          style={[
            ehStyles.cancelBtn,
            { backgroundColor: isDark ? colors.gray[800] : colors.white.light },
            ehStyles.shadow,
          ]}
        >
          <Text style={[ehStyles.cancelText, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>
            {t('profile.cancel')}
          </Text>
        </Pressable>
        <View
          style={[ehStyles.titleAbsolute, { top: STATIC_TOP_INSET + 10 }]}
          pointerEvents="none"
        >
          <Text
            style={[ehStyles.title, { color: isDark ? colors.gray[50] : colors.gray[900] }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        <Pressable
          onPress={isDirty ? onConfirm : undefined}
          hitSlop={8}
          style={[
            ehStyles.circleBtn,
            { backgroundColor: confirmBg },
            ehStyles.shadow,
          ]}
        >
          <Check size={20} color={confirmIconColor} />
        </Pressable>
      </View>
    </View>
  )
}

const ehStyles = StyleSheet.create({
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
  cancelBtn: {
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
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
  title: { fontSize: 17, fontWeight: '700' },
  titleAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

const ProfileEditForm = React.memo(function ProfileEditForm({ userInfo }: { userInfo: IUserInfo }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const theme = PROFILE_THEME[isDark ? 'dark' : 'light']
  const { t } = useTranslation('profile')
  const setUserInfo = useUserStore((state) => state.setUserInfo)

  // Refs hold current form values — no parent re-render on keystroke
  const firstNameRef = useRef(userInfo.firstName ?? '')
  const lastNameRef = useRef(userInfo.lastName ?? '')
  const addressRef = useRef(userInfo.address ?? '')
  const [dob, setDob] = useState(
    normalizeDob(userInfo.dob) || (userInfo.dob ?? ''),
  )
  const dobRef = useRef(dob)

  const [isDirty, setIsDirty] = useState(false)

  const initialValues = useRef({
    firstName: userInfo.firstName ?? '',
    lastName: userInfo.lastName ?? '',
    address: userInfo.address ?? '',
    dob: normalizeDob(userInfo.dob) || (userInfo.dob ?? ''),
  })

  const confirmSheetRef = useRef<ConfirmUpdateProfileBottomSheetRef>(null)

  const { t: tToast } = useTranslation('toast')

  const checkDirty = useCallback(() => {
    const iv = initialValues.current
    setIsDirty(
      firstNameRef.current !== iv.firstName ||
        lastNameRef.current !== iv.lastName ||
        addressRef.current !== iv.address ||
        dobRef.current !== iv.dob,
    )
  }, [])

  const handleDobChange = useCallback((newDob: string) => {
    dobRef.current = newDob
    setDob(newDob)
    const iv = initialValues.current
    setIsDirty(
      firstNameRef.current !== iv.firstName ||
        lastNameRef.current !== iv.lastName ||
        addressRef.current !== iv.address ||
        newDob !== iv.dob,
    )
  }, [])

  const handleCancel = useCallback(() => {
    router.back()
  }, [router])

  const handleConfirmPress = useCallback(() => {
    confirmSheetRef.current?.open()
  }, [])

  const [isUpdating, setIsUpdating] = useState(false)
  const isUpdatingRef = useRef(false)

  const handleConfirmUpdate = useCallback(async () => {
    if (isUpdatingRef.current) return
    isUpdatingRef.current = true
    const payload = {
      firstName: firstNameRef.current,
      lastName: lastNameRef.current,
      address: addressRef.current,
      dob: dobRef.current || userInfo.dob,
    }
    setIsUpdating(true)
    try {
      const res: Awaited<ReturnType<typeof updateProfile>> = await updateProfile(payload)
      if (res?.result) setUserInfo?.(res.result)
      else setUserInfo?.({ ...userInfo, ...payload })
      showToast(tToast('toast.updateProfileSuccess'))
      router.back()
    } catch {
      showToast(tToast('toast.updateProfileFailed'))
    } finally {
      isUpdatingRef.current = false
      setIsUpdating(false)
    }
  }, [userInfo, setUserInfo, router, tToast])

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40, paddingTop: STATIC_TOP_INSET + 76 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Mục: Thông tin cơ bản */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
          {t('profile.generalInfo.basicInfo')}
        </Text>
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <FormField
            label={t('profile.lastName')}
            value={userInfo.lastName ?? ''}
            onChangeRef={lastNameRef}
            placeholder={t('profile.enterLastName')}
            labelColor={theme.textMuted}
            autoCapitalize="words"
            onChange={checkDirty}
          />
          <FormField
            label={t('profile.firstName')}
            value={userInfo.firstName ?? ''}
            onChangeRef={firstNameRef}
            placeholder={t('profile.enterFirstName')}
            labelColor={theme.textMuted}
            autoCapitalize="words"
            onChange={checkDirty}
          />
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textMuted }]}>
              {t('profile.dob')}
            </Text>
            <DobExpandablePicker
              value={dob}
              onSelect={handleDobChange}
              theme={{
                bg: theme.card,
                editBtn: theme.editBtn,
                text: theme.text,
                textMuted: theme.textMuted,
              }}
              placeholder={t('profile.enterDob')}
            />
          </View>
        </View>

        {/* Mục: Số điện thoại & Email (chỉ đọc) */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
          {t('profile.contactInfo.title')}
        </Text>
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textMuted }]}>
              {t('profile.contactInfo.phone')}
            </Text>
            <Input
              value={userInfo.phonenumber ?? ''}
              editable={false}
              className="bg-gray-100 opacity-90 dark:bg-gray-700"
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textMuted }]}>
              {t('profile.contactInfo.email')}
            </Text>
            <Input
              value={userInfo.email ?? ''}
              editable={false}
              className="bg-gray-100 opacity-90 dark:bg-gray-700"
            />
          </View>
        </View>

        {/* Mục: Địa chỉ */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
          {t('profile.addressInfo')}
        </Text>
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <FormField
            label={t('profile.contactInfo.address')}
            value={userInfo.address ?? ''}
            onChangeRef={addressRef}
            placeholder={t('profile.enterAddress')}
            labelColor={theme.textMuted}
            onChange={checkDirty}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmUpdateProfileBottomSheet
        ref={confirmSheetRef}
        onConfirm={handleConfirmUpdate}
        isLoading={isUpdating}
      />

      <EditHeader
        title={t('profile.contactInfo.edit')}
        onCancel={handleCancel}
        onConfirm={handleConfirmPress}
        isDirty={isDirty}
        isDark={isDark}
      />
    </View>
  )
})

export default function ProfileEditScreen() {
  const router = useRouter()
  const userInfo = useUserStore((state) => state.userInfo)
  const setUserInfo = useUserStore((state) => state.setUserInfo)
  const [dataVersion, setDataVersion] = useState(0)

  useEffect(() => {
    if (!userInfo) {
      router.replace('/(tabs)/profile/general-info-placeholder' as never)
      return
    }
    // Lấy dữ liệu mới nhất từ tài khoản để điền mặc định
    let cancelled = false
    const snapshot = {
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      address: userInfo.address,
      dob: userInfo.dob,
    }
    getProfile()
      .then((res) => {
        if (cancelled) return
        if (res?.result) {
          const profile = {
            ...res.result,
            dob: normalizeDob(res.result.dob) || res.result.dob,
            address: res.result.address ?? '',
          }
          setUserInfo(profile)
          // Only force-remount the form when the server returned different data
          // (e.g. edited from another device). Avoids unnecessary unmount/remount
          // on every navigation which would discard any typing already done.
          if (
            profile.firstName !== snapshot.firstName ||
            profile.lastName !== snapshot.lastName ||
            profile.address !== snapshot.address ||
            profile.dob !== snapshot.dob
          ) {
            setDataVersion((v) => v + 1)
          }
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
    // Chỉ fetch khi slug đổi (đổi user); không thêm userInfo để tránh loop khi setUserInfo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo?.slug, router, setUserInfo])

  if (!userInfo) {
    return null
  }

  return (
    <ProfileEditForm
      key={`${userInfo.slug}-${dataVersion}`}
      userInfo={userInfo}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex1: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
  },
  section: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    marginBottom: 6,
  },
})
