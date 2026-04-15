/**
 * Redeem Gift Card screen — Nạp thẻ quà tặng.
 * Route: /gift-card/redeem?serial=...&code=...
 */
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Gift, Hash, KeyRound } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { Controller } from 'react-hook-form'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import { FloatingHeader } from '@/components/navigation/floating-header'
import { Input } from '@/components/ui'
import { colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { useRedeemGiftCard } from '@/hooks/use-redeem-gift-card'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useZodForm } from '@/hooks/use-zod-form'
import { useUserStore } from '@/stores'
import { IUseGiftCardResponse } from '@/types'
import { formatPoints, showErrorToast } from '@/utils'

// ─── Schema ───────────────────────────────────────────────────────────────────

const redeemSchema = z.object({
  serial: z.string().min(1, 'Nhập serial thẻ'),
  code: z.string().min(1, 'Nhập mã thẻ'),
})

type RedeemFormValues = z.infer<typeof redeemSchema>

// ─── Success state ────────────────────────────────────────────────────────────

function RedeemSuccess({
  result,
  primaryColor,
  isDark,
  onContinue,
}: {
  result: IUseGiftCardResponse
  primaryColor: string
  isDark: boolean
  onContinue: () => void
}) {
  const { t } = useTranslation('giftCard')
  const textColor  = isDark ? colors.gray[50]  : colors.gray[900]
  const subColor   = isDark ? colors.gray[400] : colors.gray[500]
  const cardBg     = isDark ? colors.gray[900] : colors.white.light
  const borderColor = isDark ? colors.gray[800] : colors.gray[100]
  const rowBg      = isDark ? colors.gray[800] : colors.gray[50]

  return (
    <View style={sc.container}>
      {/* Icon */}
      <View style={sc.iconBlock}>
        <View style={sc.iconCircle}>
          <CheckCircle2 size={44} color="#16a34a" />
        </View>
        <Text style={[sc.title, { color: textColor }]}>{t('redeem.success.title')}</Text>
        <Text style={[sc.subtitle, { color: subColor }]}>{t('redeem.success.subtitle')}</Text>
      </View>

      {/* Points highlight */}
      <View style={[sc.pointsBanner, { backgroundColor: `${primaryColor}12`, borderColor: `${primaryColor}25` }]}>
        <Text style={[sc.pointsLabel, { color: subColor }]}>{t('redeem.success.pointsLabel')}</Text>
        <Text style={[sc.pointsValue, { color: primaryColor }]}>{t('redeem.success.pointsValue', { points: formatPoints(result.cardPoints) })}</Text>
      </View>

      {/* Meta card */}
      <View style={[sc.metaCard, { backgroundColor: cardBg, borderColor }]}>
        {[
          { label: t('redeem.success.cardName'), value: result.cardName },
          { label: t('redeem.success.serial'),   value: result.serial },
          { label: t('redeem.success.usedAt'),   value: new Date(result.usedAt).toLocaleString('vi-VN') },
        ].map((row, i, arr) => (
          <View key={row.label}>
            <View style={[sc.metaRow, { backgroundColor: rowBg }]}>
              <Text style={[sc.metaKey, { color: subColor }]}>{row.label}</Text>
              <Text style={[sc.metaVal, { color: textColor }]}>{row.value}</Text>
            </View>
            {i < arr.length - 1 && <View style={[sc.metaDivider, { backgroundColor: borderColor }]} />}
          </View>
        ))}
      </View>

      <Pressable
        onPress={onContinue}
        style={[sc.continueBtn, { backgroundColor: primaryColor }]}
      >
        <Text style={sc.continueBtnText}>{t('redeem.continueBtn')}</Text>
      </Pressable>
    </View>
  )
}

const sc = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 14 },
  iconBlock: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 14 },
  pointsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  pointsLabel: { fontSize: 14 },
  pointsValue: { fontSize: 26, fontWeight: '800' },
  metaCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  metaDivider: { height: StyleSheet.hairlineWidth },
  metaKey: { fontSize: 13 },
  metaVal: { fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1 },
  continueBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: colors.white.light },
})

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function RedeemGiftCardScreen() {
  const { t } = useTranslation('giftCard')
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const { bottom } = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams<{ serial?: string; code?: string }>()
  const userSlug = useUserStore((s) => s.userInfo?.slug ?? '')

  const [successResult, setSuccessResult] = useState<IUseGiftCardResponse | null>(null)

  const { control, handleSubmit, formState: { errors } } = useZodForm(redeemSchema, {
    defaultValues: {
      serial: params.serial ?? '',
      code: params.code ?? '',
    },
  })

  const { mutate, isPending } = useRedeemGiftCard()

  const onSubmit = useCallback(
    (data: RedeemFormValues) => {
      mutate(
        { serial: data.serial, code: data.code, userSlug },
        {
          onSuccess: (res) => setSuccessResult(res.result),
          onError: (error: Error) => {
            const code = (error as Error & { response?: { data?: { statusCode?: number } } })?.response?.data?.statusCode
            showErrorToast(code ?? 0)
          },
        },
      )
    },
    [mutate, userSlug],
  )

  const handleContinue = useCallback(() => {
    router.replace('/(tabs)/home' as never)
  }, [router])

  const bg        = isDark ? colors.background.dark : colors.background.light
  const cardBg    = isDark ? colors.gray[900]       : colors.white.light
  const textColor = isDark ? colors.gray[50]        : colors.gray[900]
  const subColor  = isDark ? colors.gray[400]       : colors.gray[500]
  const borderColor = isDark ? colors.gray[800]     : colors.gray[100]

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      <FloatingHeader title={t('redeem.title')} 
          disableBlur
        />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: STATIC_TOP_INSET + 72, paddingBottom: bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {successResult ? (
            <RedeemSuccess
              result={successResult}
              primaryColor={primaryColor}
              isDark={isDark}
              onContinue={handleContinue}
            />
          ) : (
            <>
              {/* Hero */}
              <View style={s.hero}>
                <View style={[s.heroIcon, { backgroundColor: `${primaryColor}15` }]}>
                  <Gift size={36} color={primaryColor} />
                </View>
                <Text style={[s.heroTitle, { color: textColor }]}>{t('redeem.heroTitle')}</Text>
                <Text style={[s.heroHint, { color: subColor }]}>
                  {t('redeem.heroHint')}
                </Text>
              </View>

              {/* Form card */}
              <View style={[s.formCard, { backgroundColor: cardBg, borderColor }]}>
                {/* Serial */}
                <View style={s.field}>
                  <View style={s.fieldLabelRow}>
                    <Hash size={13} color={subColor} />
                    <Text style={[s.fieldLabel, { color: subColor }]}>
                      {t('redeem.serialLabel')} <Text style={{ color: colors.destructive.light }}>*</Text>
                    </Text>
                  </View>
                  <Controller
                    control={control}
                    name="serial"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder={t('redeem.serialPlaceholder')}
                        autoCapitalize="characters"
                        error={!!errors.serial}
                      />
                    )}
                  />
                  {!!errors.serial && (
                    <Text style={s.errorText}>{errors.serial.message}</Text>
                  )}
                </View>

                <View style={[s.fieldDivider, { backgroundColor: borderColor }]} />

                {/* Code */}
                <View style={s.field}>
                  <View style={s.fieldLabelRow}>
                    <KeyRound size={13} color={subColor} />
                    <Text style={[s.fieldLabel, { color: subColor }]}>
                      {t('redeem.codeLabel')} <Text style={{ color: colors.destructive.light }}>*</Text>
                    </Text>
                  </View>
                  <Controller
                    control={control}
                    name="code"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder={t('redeem.codePlaceholder')}
                        autoCapitalize="characters"
                        error={!!errors.code}
                      />
                    )}
                  />
                  {!!errors.code && (
                    <Text style={s.errorText}>{errors.code.message}</Text>
                  )}
                </View>
              </View>

              {/* Submit */}
              <Pressable
                onPress={handleSubmit(onSubmit)}
                disabled={isPending}
                style={[s.submitBtn, { backgroundColor: primaryColor, opacity: isPending ? 0.7 : 1 }]}
              >
                {isPending
                  ? <ActivityIndicator color={colors.white.light} />
                  : <Text style={s.submitBtnText}>{t('redeem.submitButton')}</Text>}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 16 },

  // Hero
  hero: { alignItems: 'center', gap: 8, paddingBottom: 4 },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  heroTitle: { fontSize: 20, fontWeight: '800' },
  heroHint: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 16 },

  // Form card
  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  field: { paddingVertical: 14, gap: 8 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fieldLabel: { fontSize: 13, fontWeight: '500' },
  fieldDivider: { height: StyleSheet.hairlineWidth },
  errorText: { fontSize: 11, color: colors.destructive.light },

  // Submit
  submitBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: colors.white.light },
})
