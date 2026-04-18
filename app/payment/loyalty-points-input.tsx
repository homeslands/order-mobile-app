import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'

import { colors } from '@/constants'
import {
  useApplyLoyaltyPoint,
  useCancelReservationForOrder,
} from '@/hooks/use-loyalty-point'
import { formatCurrency, showErrorToastMessage } from '@/utils'

interface LoyaltyPointsInputProps {
  orderSlug: string
  orderTotal: number
  userTotalPoints: number
  currentPointsUsed: number
  isDark: boolean
  primaryColor: string
  onApplied: () => void
  onCancelled: () => void
  onResetRef?: React.MutableRefObject<() => void>
}

const QUICK_PRESETS = [1_000, 2_000, 3_000, 5_000, 10_000, 50_000]

const PresetChip = memo(function PresetChip({
  value,
  label,
  isActive,
  primaryColor,
  chipBg,
  chipBorderColor,
  subColor,
  onPress,
}: {
  value: number
  label: string
  isActive: boolean
  primaryColor: string
  chipBg: string
  chipBorderColor: string
  subColor: string
  onPress: (v: number) => void
}) {
  const handlePress = useCallback(() => onPress(value), [onPress, value])
  const chipStyle = useMemo(
    () => ({
      borderColor: isActive ? primaryColor : chipBorderColor,
      backgroundColor: isActive ? `${primaryColor}15` : chipBg,
    }),
    [isActive, primaryColor, chipBorderColor, chipBg],
  )
  return (
    <Pressable onPress={handlePress} style={[s.chip, chipStyle]}>
      <Text style={[s.chipText, { color: isActive ? primaryColor : subColor }]}>
        {label}
      </Text>
    </Pressable>
  )
})

const LoyaltyPointsInput = memo(function LoyaltyPointsInput({
  orderSlug,
  orderTotal,
  userTotalPoints,
  currentPointsUsed,
  isDark,
  primaryColor,
  onApplied,
  onCancelled,
  onResetRef,
}: LoyaltyPointsInputProps) {
  const { t } = useTranslation('payment')
  const cardBg = isDark ? colors.gray[800] : colors.white.light
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const inputBg = isDark ? colors.gray[700] : colors.gray[50]
  const chipBg = isDark ? colors.gray[700] : colors.gray[100]
  const chipBorderColor = isDark ? colors.gray[600] : colors.gray[200]

  const maxUsablePoints = useMemo(
    () => Math.min(userTotalPoints, Math.max(0, orderTotal)),
    [userTotalPoints, orderTotal],
  )

  // Presets nhỏ hơn max; "Tối đa" chip xử lý case max riêng
  const quickPresets = useMemo(
    () => QUICK_PRESETS.filter((v) => v < maxUsablePoints),
    [maxUsablePoints],
  )

  const [inputValue, setInputValue] = useState(() =>
    currentPointsUsed > 0 ? String(currentPointsUsed) : '',
  )
  const [isApplying, setIsApplying] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const inputRef = useRef<TextInput>(null)

  const { mutate: applyPoints } = useApplyLoyaltyPoint()
  const { mutate: cancelReservation } = useCancelReservationForOrder()

  useEffect(() => {
    if (onResetRef) {
      onResetRef.current = () => setInputValue('')
    }
  }, [onResetRef])

  const parsedPoints = useMemo(() => {
    const n = parseInt(inputValue, 10)
    return isNaN(n) || n < 0 ? 0 : n
  }, [inputValue])

  const clampedPoints = Math.min(parsedPoints, maxUsablePoints)
  const isApplied = currentPointsUsed > 0
  const hasPoints = userTotalPoints > 0
  const canApply = clampedPoints > 0 && clampedPoints !== currentPointsUsed

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleInputChange = useCallback((text: string) => {
    setInputValue(text.replace(/[^0-9]/g, ''))
  }, [])

  const handleInputBlur = useCallback(() => {
    if (parsedPoints > maxUsablePoints) {
      setInputValue(String(maxUsablePoints))
    }
  }, [parsedPoints, maxUsablePoints])

  const handleApply = useCallback(() => {
    const points = Math.min(parsedPoints, maxUsablePoints)
    if (points <= 0 || isApplying) return
    setIsApplying(true)
    applyPoints(
      { orderSlug, pointsToUse: points },
      {
        onSuccess: () => {
          setIsApplying(false)
          onApplied()
        },
        onError: () => {
          setIsApplying(false)
          showErrorToastMessage(t('loyaltyPoints.cannotApply'))
        },
      },
    )
  }, [
    parsedPoints,
    maxUsablePoints,
    isApplying,
    orderSlug,
    applyPoints,
    onApplied,
    t,
  ])

  const handleCancel = useCallback(() => {
    if (isCancelling) return
    setIsCancelling(true)
    cancelReservation(orderSlug, {
      onSuccess: () => {
        setIsCancelling(false)
        setInputValue('')
        onCancelled()
      },
      onError: () => {
        setIsCancelling(false)
        showErrorToastMessage(t('loyaltyPoints.cannotCancel'))
      },
    })
  }, [isCancelling, orderSlug, cancelReservation, onCancelled, t])

  const handlePreset = useCallback((value: number) => {
    setInputValue(String(value))
    inputRef.current?.blur()
  }, [])

  const handleUseMax = useCallback(
    (_?: number) => {
      setInputValue(String(maxUsablePoints))
      inputRef.current?.blur()
    },
    [maxUsablePoints],
  )

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: textColor }]}>
          {t('loyaltyPoints.title')}
        </Text>
        <View style={[s.badge, { backgroundColor: `${primaryColor}20` }]}>
          <Text style={[s.badgeText, { color: primaryColor }]}>
            {t('loyaltyPoints.points', {
              value: userTotalPoints.toLocaleString('vi-VN'),
            })}
          </Text>
        </View>
      </View>

      <View style={[s.divider, { backgroundColor: borderColor }]} />

      <View style={s.body}>
        {!hasPoints ? (
          <Text
            style={[
              s.hint,
              { color: subColor, textAlign: 'center', paddingVertical: 4 },
            ]}
          >
            {t('loyaltyPoints.noPoints')}
          </Text>
        ) : (
          <>
            {/* Quick chips — bao gồm "Tối đa" ở cuối */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.chipsScroll}
              contentContainerStyle={s.chipsContent}
            >
              {quickPresets.map((v) => (
                <PresetChip
                  key={v}
                  value={v}
                  label={v >= 1_000 ? `${v / 1_000}K` : String(v)}
                  isActive={clampedPoints === v}
                  primaryColor={primaryColor}
                  chipBg={chipBg}
                  chipBorderColor={chipBorderColor}
                  subColor={subColor}
                  onPress={handlePreset}
                />
              ))}

              {/* Chip "Tối đa" */}
              {maxUsablePoints > 0 && (
                <PresetChip
                  value={maxUsablePoints}
                  label={t('loyaltyPoints.max')}
                  isActive={clampedPoints === maxUsablePoints}
                  primaryColor={primaryColor}
                  chipBg={chipBg}
                  chipBorderColor={chipBorderColor}
                  subColor={subColor}
                  onPress={handleUseMax}
                />
              )}
            </ScrollView>

            {/* Input row */}
            <View style={s.inputRow}>
              <TextInput
                ref={inputRef}
                style={[
                  s.input,
                  { backgroundColor: inputBg, color: textColor, borderColor },
                ]}
                value={inputValue}
                onChangeText={handleInputChange}
                onBlur={handleInputBlur}
                placeholder={t('loyaltyPoints.enterPoints')}
                placeholderTextColor={subColor}
                keyboardType="number-pad"
                returnKeyType="done"
              />
              <Pressable
                onPress={handleApply}
                disabled={!canApply || isApplying}
                style={[
                  s.applyBtn,
                  {
                    backgroundColor: canApply
                      ? primaryColor
                      : isDark
                        ? colors.gray[600]
                        : colors.gray[300],
                  },
                ]}
              >
                {isApplying ? (
                  <ActivityIndicator size="small" color={colors.white.light} />
                ) : (
                  <Text style={s.applyBtnText}>{t('loyaltyPoints.apply')}</Text>
                )}
              </Pressable>
            </View>

            {/* Hủy — hiện rõ khi đang dùng điểm */}
            {isApplied && (
              <Pressable
                onPress={handleCancel}
                disabled={isCancelling}
                style={[
                  s.cancelRow,
                  { borderColor: isDark ? colors.gray[700] : colors.gray[200] },
                ]}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color={subColor} />
                ) : (
                  <>
                    <Text style={[s.cancelRowText, { color: subColor }]}>
                      {t('loyaltyPoints.using')}{' '}
                      <Text style={{ fontWeight: '700', color: textColor }}>
                        {t('loyaltyPoints.points', {
                          value: currentPointsUsed.toLocaleString('vi-VN'),
                        })}
                      </Text>
                    </Text>
                    <Text
                      style={[
                        s.cancelRowAction,
                        {
                          color: isDark
                            ? colors.destructive.dark
                            : colors.destructive.light,
                        },
                      ]}
                    >
                      {t('loyaltyPoints.cancel')}
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Hint */}
            <Text style={[s.hint, { color: subColor }]}>
              {t('loyaltyPoints.maxHint', {
                amount: formatCurrency(maxUsablePoints),
              })}
            </Text>
          </>
        )}
      </View>
    </View>
  )
})

export default LoyaltyPointsInput

const s = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 15, fontWeight: '700' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 13, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth },
  body: { padding: 16, gap: 12 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  applyBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 82,
  },
  applyBtnText: { fontSize: 14, fontWeight: '700', color: colors.white.light },
  cancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelRowText: { fontSize: 13 },
  cancelRowAction: { fontSize: 13, fontWeight: '700' },
  chipsScroll: { marginHorizontal: -16 },
  chipsContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
})
