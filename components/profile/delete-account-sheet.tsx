import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import { Eye, EyeOff, TriangleAlert } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import { useDeleteAccount } from '@/hooks/use-auth'
import { showErrorToast, showToast } from '@/utils'

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

export const DeleteAccountSheet = memo(function DeleteAccountSheet({
  visible,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation('profile')
  const isDark = useColorScheme() === 'dark'
  const { bottom } = useSafeAreaInsets()
  const sheetRef = useRef<BottomSheetModal>(null)

  const [step, setStep] = useState<1 | 2>(1)
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const CONFIRM_PHRASE = t('profile.deleteAccount.confirmPhrase')
  const isConfirmTextValid =
    confirmText.trim().toUpperCase() === CONFIRM_PHRASE.toUpperCase()

  const { mutate: deleteAccount, isPending } = useDeleteAccount()

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present()
    } else {
      sheetRef.current?.dismiss()
    }
  }, [visible])

  const resetState = useCallback(() => {
    setStep(1)
    setConfirmText('')
    setPassword('')
    setShowPassword(false)
  }, [])

  const handleDismiss = useCallback(() => {
    resetState()
    onClose()
  }, [onClose, resetState])

  const handleContinue = useCallback(() => {
    setStep(2)
  }, [])

  const handleBack = useCallback(() => {
    setStep(1)
    setPassword('')
    setShowPassword(false)
  }, [])

  const handleConfirm = useCallback(() => {
    if (!password.trim()) return
    deleteAccount(password, {
      onSuccess: () => {
        showToast(t('profile.deleteAccount.success'))
        onSuccess()
      },
      onError: (err: unknown) => {
const data = (err as { response?: { data?: { statusCode?: number } } })
          ?.response?.data
        if (data?.statusCode) {
          showErrorToast(data.statusCode)
        } else {
          showToast(t('profile.deleteAccount.error'), 'error')
        }
      },
    })
  }, [password, deleteAccount, t, onSuccess])

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
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
          {step === 1 ? (
            <>
              <Pressable
                onPress={handleDismiss}
                style={[
                  styles.cancelBtn,
                  {
                    borderColor: isDark
                      ? colors.border.dark
                      : colors.border.light,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cancelText,
                    { color: isDark ? colors.gray[400] : colors.gray[600] },
                  ]}
                >
                  {t('profile.deleteAccount.cancel')}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleContinue}
                disabled={!isConfirmTextValid}
                style={[
                  styles.confirmBtn,
                  { opacity: isConfirmTextValid ? 1 : 0.4 },
                ]}
              >
                <Text style={styles.confirmText}>
                  {t('profile.deleteAccount.continue')}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={handleBack}
                disabled={isPending}
                style={[
                  styles.cancelBtn,
                  {
                    borderColor: isDark
                      ? colors.border.dark
                      : colors.border.light,
                    opacity: isPending ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cancelText,
                    { color: isDark ? colors.gray[400] : colors.gray[600] },
                  ]}
                >
                  {t('profile.deleteAccount.back')}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                disabled={isPending || !password.trim()}
                style={[
                  styles.confirmBtn,
                  { opacity: isPending || !password.trim() ? 0.6 : 1 },
                ]}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmText}>
                    {t('profile.deleteAccount.confirm')}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </BottomSheetFooter>
    ),
    [
      bottom,
      handleBack,
      handleContinue,
      handleConfirm,
      handleDismiss,
      isDark,
      isConfirmTextValid,
      isPending,
      password,
      step,
      t,
    ],
  )

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.card.dark : '#ffffff' }),
    [isDark],
  )

  const inputStyle = useMemo(
    () => [
      styles.input,
      {
        backgroundColor: isDark ? colors.background.dark : colors.gray[50],
        borderColor: isDark ? colors.border.dark : colors.border.light,
        color: isDark ? colors.gray[50] : colors.gray[900],
      },
    ],
    [isDark],
  )

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose={!isPending}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      footerComponent={renderFooter}
      backgroundStyle={bgStyle}
      onDismiss={handleDismiss}
    >
      <BottomSheetView style={styles.content}>
        {/* Warning */}
        <View
          style={[
            styles.warningBox,
            {
              backgroundColor: isDark
                ? 'rgba(239,68,68,0.12)'
                : 'rgba(239,68,68,0.08)',
              borderColor: isDark
                ? 'rgba(239,68,68,0.3)'
                : 'rgba(239,68,68,0.2)',
            },
          ]}
        >
          <TriangleAlert size={18} color="#ef4444" style={styles.warningIcon} />
          <Text style={styles.warningText}>
            {t('profile.deleteAccount.warning')}
          </Text>
        </View>

        {step === 1 ? (
          <>
            {/* Step 1: type confirm phrase */}
            <Text
              style={[
                styles.inputLabel,
                { color: isDark ? colors.gray[300] : colors.gray[700] },
              ]}
            >
              {t('profile.deleteAccount.confirmLabel')}
            </Text>
            <BottomSheetTextInput
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder={t('profile.deleteAccount.confirmPlaceholder')}
              placeholderTextColor={
                isDark ? colors.gray[600] : colors.gray[400]
              }
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={isConfirmTextValid ? handleContinue : undefined}
              style={inputStyle}
            />
          </>
        ) : (
          <>
            {/* Step 2: enter password */}
            <Text
              style={[
                styles.inputLabel,
                { color: isDark ? colors.gray[300] : colors.gray[700] },
              ]}
            >
              {t('profile.deleteAccount.passwordLabel')}
            </Text>

            <View style={styles.inputWrap}>
              <BottomSheetTextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('profile.deleteAccount.passwordPlaceholder')}
                placeholderTextColor={
                  isDark ? colors.gray[600] : colors.gray[400]
                }
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleConfirm}
                style={inputStyle}
                editable={!isPending}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                style={styles.eyeBtn}
              >
                {showPassword ? (
                  <EyeOff
                    size={18}
                    color={isDark ? colors.gray[500] : colors.gray[400]}
                  />
                ) : (
                  <Eye
                    size={18}
                    color={isDark ? colors.gray[500] : colors.gray[400]}
                  />
                )}
              </Pressable>
            </View>
          </>
        )}

        <View style={{ paddingBottom: bottom + 80 }} />
      </BottomSheetView>
    </BottomSheetModal>
  )
})

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  warningIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'BeVietnamPro_400Regular',
    color: '#ef4444',
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'BeVietnamPro_400Regular',
    marginBottom: 8,
  },
  inputWrap: {
    position: 'relative',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingRight: 44,
    fontSize: 15,
    fontFamily: 'BeVietnamPro_400Regular',
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontFamily: 'BeVietnamPro_600SemiBold',
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 100,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 14,
    fontFamily: 'BeVietnamPro_600SemiBold',
    color: '#ffffff',
  },
})
