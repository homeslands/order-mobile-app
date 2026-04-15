/**
 * Gift Card Checkout — chọn loại + nhập người nhận (GIFT) + xác nhận đặt hàng.
 *
 * Perf:
 * - useRunAfterTransition(-20ms) để defer render form sau transition
 * - Tất cả handler dùng useCallback
 * - RecipientFormItem memo
 *
 * UX fix #7:
 * - SELF mode: qty lấy từ store (khách đã set trên màn hình list)
 * - GIFT mode: qty = sum(recipients.quantity), không cần preset tổng.
 *   Không còn "Còn X thẻ" counter gây nhầm lẫn.
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { Redirect } from 'expo-router'
import { Lock, Plus, ShoppingBag, Unlock, UserRound, Users } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import { GiftCardCartItem } from '@/components/gift-card/gift-card-cart-item'
import { GiftCardTypeSelector } from '@/components/gift-card/gift-card-type-selector'
import { RecipientFormItem } from '@/components/gift-card/recipient-form-item'
import { FloatingHeader } from '@/components/navigation/floating-header'
import { colors, GiftCardType } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { useCreateCardOrder } from '@/hooks/use-card-order'
import { useGiftCardTypeOptions } from '@/hooks/use-gift-card-type-options'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useRunAfterTransition } from '@/hooks/use-run-after-transition'
import { useZodForm } from '@/hooks/use-zod-form'
import { navigateNative, scheduleTransitionTask } from '@/lib/navigation'
import { useGiftCardStore, useUserStore } from '@/stores'
import { capitalizeFirst, formatCurrency, formatPoints, showErrorToastMessage } from '@/utils'

// ─── Schema ──────────────────────────────────────────────────────────────────

const recipientSchema = z.object({
  phone: z
    .string()
    .regex(/^0[0-9]{9,10}$/, 'Số điện thoại không hợp lệ (10-11 số, bắt đầu bằng 0)'),
  name: z.string().optional(),
  quantity: z
    .number({ message: 'Nhập số lượng hợp lệ' })
    .min(1, 'Tối thiểu 1'),
  message: z.string().max(200, 'Tối đa 200 ký tự').optional(),
})

const checkoutSchema = z.object({
  cardOrderType: z.enum([GiftCardType.SELF, GiftCardType.GIFT, GiftCardType.BUY]),
  recipients: z.array(recipientSchema),
})

export type CheckoutFormValues = z.infer<typeof checkoutSchema>

// ─── Summary Row ─────────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  valueColor,
  bold,
}: {
  label: string
  value: string
  valueColor?: string
  bold?: boolean
}) {
  const isDark = useColorScheme() === 'dark'
  const textColor = isDark ? colors.gray[50] : colors.gray[800]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  return (
    <View style={su.row}>
      <Text style={[su.label, { color: subColor }]}>{label}</Text>
      <Text style={[su.value, { color: valueColor ?? textColor }, bold && su.bold]}>
        {value}
      </Text>
    </View>
  )
}

const su = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14 },
  value: { fontSize: 14 },
  bold: { fontWeight: '700', fontSize: 15 },
})

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function GiftCardCheckoutScreen() {
  const { t } = useTranslation('giftCard')
  const { t: tCommon } = useTranslation('common')
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const { bottom } = useSafeAreaInsets()

  const [ready, setReady] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const confirmSheetRef = useRef<BottomSheetModal>(null)

  useRunAfterTransition(() => setReady(true), [], { androidDelayMs: -20 })

  const giftCardItem = useGiftCardStore((s) => s.giftCardItem)
  const clearGiftCard = useGiftCardStore((s) => s.clearGiftCard)
  const userInfo = useUserStore((s) => s.userInfo)

  const { mutate: createOrder, isPending } = useCreateCardOrder()

  const { control, handleSubmit, watch, setValue, formState: { errors } } =
    useZodForm(checkoutSchema, {
      defaultValues: {
        cardOrderType: GiftCardType.SELF,
        recipients: [],
      },
    })

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'recipients',
  })

  const cardOrderType = watch('cardOrderType')
  const recipients = useWatch({ control, name: 'recipients' })

  const { availableTypes, defaultType, lockMap, isLoaded: flagsLoaded, refetch: refetchFlags } = useGiftCardTypeOptions()

  // Auto-switch sang type đầu tiên available khi flags load xong,
  // chỉ switch nếu type hiện tại bị lock — không override lựa chọn của user
  const cardOrderTypeRef = useRef(cardOrderType)
  useEffect(() => {
    cardOrderTypeRef.current = cardOrderType
  }, [cardOrderType])
  useEffect(() => {
    if (!defaultType) return
    if (!availableTypes.includes(cardOrderTypeRef.current as never)) {
      setValue('cardOrderType', defaultType, { shouldValidate: false })
    }
  }, [availableTypes, defaultType, setValue])

  // ── Computed ──────────────────────────────────────────────────────────────

  // SELF: qty từ store (set bằng stepper trên màn hình list)
  // GIFT: qty = sum(recipients.quantity) — tự động, không nhập 2 lần
  const selfQty = giftCardItem?.quantity ?? 0
  const giftQty = useMemo(
    () => recipients.reduce((sum, r) => sum + (r.quantity || 0), 0),
    [recipients],
  )
  const totalQty = cardOrderType === GiftCardType.GIFT ? giftQty : selfQty
  const totalAmount = (giftCardItem?.price ?? 0) * totalQty
  const totalPoints = (giftCardItem?.points ?? 0) * totalQty

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleTypeChange = useCallback(
    (value: GiftCardType.SELF | GiftCardType.GIFT | GiftCardType.BUY) => {
      setValue('cardOrderType', value, { shouldValidate: true })
      if (value === GiftCardType.SELF || value === GiftCardType.BUY) replace([])
    },
    [setValue, replace],
  )

  const handleAddRecipient = useCallback(() => {
    append({ phone: '', name: '', quantity: 1, message: '' })
  }, [append])

  const handleRemoveRecipient = useCallback(
    (index: number) => remove(index),
    [remove],
  )

  const onConfirm = useCallback(
    (data: CheckoutFormValues) => {
      if (data.cardOrderType === GiftCardType.GIFT && data.recipients.length === 0) {
        showErrorToastMessage(t('checkout.error.addRecipient'))
        return
      }

      const orderQty =
        data.cardOrderType === GiftCardType.GIFT
          ? data.recipients.reduce((sum, r) => sum + r.quantity, 0)
          : selfQty

      createOrder(
        {
          customerSlug: userInfo!.slug,
          cardSlug: giftCardItem!.slug,
          cardOrderType: data.cardOrderType,
          quantity: orderQty,
          totalAmount: giftCardItem!.price * orderQty,
          cardVersion: giftCardItem!.version ?? 1,
          receipients:
            data.cardOrderType === GiftCardType.GIFT
              ? data.recipients.map((r) => ({
                  phone: r.phone,
                  name: r.name,
                  quantity: r.quantity,
                  message: r.message,
                }))
              : [],
        },
        {
          onSuccess: (res) => {
            const slug = res.result?.slug
            if (slug) {
              navigateNative.push(
                `/gift-card/checkout/${slug}` as Parameters<typeof navigateNative.push>[0],
              )
              scheduleTransitionTask(() => clearGiftCard(false))
            }
          },
          onError: (error: Error) => {
            const code = (error as Error & { response?: { data?: { code?: number } } })?.response?.data?.code
            if (code === 158806) {
              showErrorToastMessage(t('checkout.error.typeLocked'))
              refetchFlags()
            } else {
              showErrorToastMessage(t('checkout.error.orderFailed'))
            }
          },
        },
      )
      setShowConfirm(false)
    },
    [createOrder, giftCardItem, userInfo, selfQty, refetchFlags, t, clearGiftCard],
  )

  const handlePressConfirm = useCallback(() => setShowConfirm(true), [])
  const handleDismissConfirm = useCallback(() => setShowConfirm(false), [])

  // Sheet mounts only when showConfirm=true — present via ref callback instead of effect

  const renderConfirmBackdrop = useCallback(
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

  const closeConfirmSheet = useCallback(() => confirmSheetRef.current?.dismiss(), [])

  const renderConfirmFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={bottom}>
        <View style={[cs.footer, { backgroundColor: isDark ? colors.gray[900] : colors.white.light, borderTopColor: isDark ? colors.gray[700] : colors.gray[200] }]}>
          <Pressable
            onPress={closeConfirmSheet}
            disabled={isPending}
            style={[cs.cancelBtn, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100], opacity: isPending ? 0.5 : 1 }]}
          >
            <Text style={[cs.cancelText, { color: isDark ? colors.gray[50] : colors.gray[700] }]}>{tCommon('cancel')}</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit(onConfirm)}
            disabled={isPending}
            style={[cs.submitBtn, { backgroundColor: primaryColor, opacity: isPending ? 0.7 : 1 }]}
          >
            {isPending
              ? <ActivityIndicator size="small" color={colors.white.light} />
              : <Text style={cs.submitText}>{t('checkout.confirm.placeOrder')}</Text>
            }
          </Pressable>
        </View>
      </BottomSheetFooter>
    ),
    [isDark, primaryColor, isPending, closeConfirmSheet, handleSubmit, onConfirm, bottom, t, tCommon],
  )

  // ── Colors ────────────────────────────────────────────────────────────────

  const bg = isDark ? colors.background.dark : colors.background.light
  const cardBg = isDark ? colors.gray[900] : colors.white.light
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!giftCardItem) return <Redirect href="/(tabs)/gift-card" />
  if (!userInfo?.slug) return <Redirect href="/auth/login" />

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      <FloatingHeader title={t('checkout.title')} 
          disableBlur
        />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            s.scrollContent,
            { paddingTop: STATIC_TOP_INSET + 64, paddingBottom: bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!ready ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator color={primaryColor} />
            </View>
          ) : (
            <>
              {/* Cart item — quantity + swipe to delete */}
              <GiftCardCartItem
                item={giftCardItem}
                primaryColor={primaryColor}
                isDark={isDark}
                overrideQty={cardOrderType === GiftCardType.GIFT ? giftQty : undefined}
              />

              {/* Lock status strip */}
              {flagsLoaded && (
                <View style={[s.lockRow, { backgroundColor: cardBg }]}>
                  {([
                    { type: 'SELF', label: t('checkout.lockType.self'), Icon: UserRound },
                    { type: 'GIFT', label: t('checkout.lockType.gift'), Icon: Users },
                    { type: 'BUY',  label: t('checkout.lockType.buy'), Icon: ShoppingBag },
                  ] as const).map(({ type, label, Icon }) => {
                    const isLocked = lockMap[type] === true
                    return (
                      <View
                        key={type}
                        style={[
                          s.lockChip,
                          {
                            backgroundColor: isLocked
                              ? isDark ? colors.gray[800] : colors.gray[100]
                              : `${primaryColor}15`,
                            borderColor: isLocked
                              ? isDark ? colors.gray[700] : colors.gray[200]
                              : `${primaryColor}50`,
                          },
                        ]}
                      >
                        <Icon
                          size={12}
                          color={isLocked ? (isDark ? colors.gray[500] : colors.gray[400]) : primaryColor}
                        />
                        <Text style={[s.lockChipText, { color: isLocked ? (isDark ? colors.gray[500] : colors.gray[400]) : primaryColor }]}>
                          {label}
                        </Text>
                        {isLocked
                          ? <Lock size={10} color={isDark ? colors.gray[600] : colors.gray[400]} />
                          : <Unlock size={10} color={primaryColor} />
                        }
                      </View>
                    )
                  })}
                </View>
              )}

              {/* Type selector */}
              <View style={[s.section, { backgroundColor: cardBg }]}>
                {availableTypes.length === 0 ? (
                  <View style={s.allLockedWrap}>
                    <Text style={[s.allLockedText, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>
                      {t('checkout.allLocked')}
                    </Text>
                  </View>
                ) : (
                  <GiftCardTypeSelector
                    value={cardOrderType as GiftCardType}
                    availableTypes={availableTypes}
                    primaryColor={primaryColor}
                    onChange={handleTypeChange}
                  />
                )}
              </View>

              {/* Recipients — GIFT only */}
              {cardOrderType === GiftCardType.GIFT && (
                <View style={[s.section, { backgroundColor: cardBg }]}>
                  <View style={s.sectionHeader}>
                    <Text style={[s.sectionLabel, { color: textColor }]}>
                      {t('checkout.recipientList')}
                    </Text>
                    {/* Tổng qty tự tính từ recipients, không nhập 2 lần */}
                    {giftQty > 0 && (
                      <Text style={[s.giftQtyBadge, { color: primaryColor }]}>
                        {t('orders.cards', { count: giftQty })}
                      </Text>
                    )}
                  </View>

                  <View style={s.recipientList}>
                    {fields.map((field, index) => (
                      <RecipientFormItem
                        key={field.id}
                        index={index}
                        control={control}
                        errors={errors}
                        setValue={setValue}
                        primaryColor={primaryColor}
                        onRemove={handleRemoveRecipient}
                      />
                    ))}
                  </View>

                  <Pressable
                    onPress={handleAddRecipient}
                    style={[s.addRecipientBtn, { borderColor: primaryColor }]}
                  >
                    <Plus size={16} color={primaryColor} />
                    <Text style={[s.addRecipientText, { color: primaryColor }]}>
                      {t('checkout.addRecipient')}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Order summary */}
              {totalQty > 0 && (
                <View style={[s.section, { backgroundColor: cardBg }]}>
                  <Text style={[s.sectionLabel, { color: textColor }]}>{t('checkout.summary')}</Text>
                  <View style={s.summaryRows}>
                    <SummaryRow label={t('checkout.cardPrice')} value={formatCurrency(giftCardItem.price)} />
                    <SummaryRow label={t('checkout.quantity')} value={`× ${totalQty}`} />
                    <View style={[s.summaryDivider, { backgroundColor: borderColor }]} />
                    <SummaryRow
                      label={t('checkout.totalAmount')}
                      value={formatCurrency(totalAmount)}
                      bold
                      valueColor={textColor}
                    />
                    {cardOrderType !== GiftCardType.BUY && (
                      <SummaryRow
                        label={t('checkout.totalPoints')}
                        value={`+${formatPoints(totalPoints)} điểm`}
                        valueColor={primaryColor}
                        bold
                      />
                    )}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky footer */}
      <View
        style={[
          s.footer,
          { paddingBottom: bottom + 16, backgroundColor: bg, borderTopColor: borderColor },
        ]}
      >
        <Pressable
          onPress={handleSubmit(handlePressConfirm)}
          disabled={isPending || !ready || totalQty === 0}
          style={[
            s.confirmBtn,
            { backgroundColor: primaryColor, opacity: (isPending || totalQty === 0) ? 0.5 : 1 },
          ]}
        >
          {isPending ? (
            <ActivityIndicator color={colors.white.light} />
          ) : (
            <Text style={s.confirmBtnText}>
              {totalQty > 0 ? t('checkout.confirmButton', { amount: formatCurrency(totalAmount) }) : t('checkout.addRecipient')}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Confirm bottom sheet — only mount after transition + when user opens */}
      {ready && showConfirm && <BottomSheetModal
              ref={(node) => {
                (confirmSheetRef as React.RefObject<BottomSheetModal | null>).current = node
                node?.present()
              }}
              snapPoints={['65%']}
              enablePanDownToClose
              enableContentPanningGesture={false}
              enableHandlePanningGesture
              enableDynamicSizing={false}
              backdropComponent={renderConfirmBackdrop}
              backgroundStyle={{ backgroundColor: isDark ? colors.gray[900] : colors.white.light }}
              handleIndicatorStyle={{ backgroundColor: isDark ? colors.gray[600] : colors.gray[300] }}
              onDismiss={handleDismissConfirm}
              footerComponent={renderConfirmFooter}
            >
              {/* Header */}
              <View style={[cs.header, { borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] }]}>
                <Text style={[cs.title, { color: textColor }]}>{t('checkout.confirm.title')}</Text>
              </View>

              {/* Scrollable content */}
              <BottomSheetScrollView contentContainerStyle={cs.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Info rows */}
                <View style={cs.infoSection}>
                  <View style={[cs.infoRow, { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }]}>
                    <Text style={[cs.infoLabel, { color: subColor }]}>{t('checkout.confirm.typeLabel')}</Text>
                    <Text style={[cs.infoValue, { color: textColor }]}>
                      {cardOrderType === GiftCardType.SELF
                      ? t('checkout.confirm.typeSelf')
                      : cardOrderType === GiftCardType.GIFT
                        ? t('checkout.confirm.typeGift')
                        : t('checkout.confirm.typeBuy')
                    }
                    </Text>
                  </View>
                  <View style={[cs.infoRow, { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }]}>
                    <Text style={[cs.infoLabel, { color: subColor }]}>{t('checkout.quantity')}</Text>
                    <Text style={[cs.infoValue, { color: textColor }]}>
                      {cardOrderType === GiftCardType.GIFT
                        ? t('checkout.confirm.quantityWithRecipients', { qty: totalQty, count: fields.length })
                        : cardOrderType === GiftCardType.BUY
                          ? t('checkout.confirm.quantityWithCode', { qty: totalQty })
                          : t('checkout.confirm.quantity', { qty: totalQty })}
                    </Text>
                  </View>
                </View>

                {/* Item row */}
                <View style={[cs.itemsSection, { borderTopColor: isDark ? colors.gray[700] : colors.border.light }]}>
                  <View style={cs.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[cs.itemName, { color: textColor }]} numberOfLines={1}>
                        {capitalizeFirst(giftCardItem.title)} × {totalQty}
                      </Text>
                    </View>
                    <Text style={[cs.itemPrice, { color: primaryColor }]}>
                      {formatCurrency(totalAmount)}
                    </Text>
                  </View>
                </View>

                {/* Totals */}
                <View style={[cs.totalsSection, { borderTopColor: isDark ? colors.gray[700] : colors.border.light }]}>
                  <View style={cs.totalRow}>
                    <Text style={[{ fontSize: 13, color: subColor }]}>{t('checkout.cardPrice')}</Text>
                    <Text style={[{ fontSize: 13, color: subColor }]}>{formatCurrency(giftCardItem.price)}</Text>
                  </View>
                  <View style={cs.totalRow}>
                    <Text style={[{ fontSize: 13, color: subColor }]}>{t('checkout.quantity')}</Text>
                    <Text style={[{ fontSize: 13, color: subColor }]}>× {totalQty}</Text>
                  </View>
                  <View style={[cs.totalRow, cs.finalRow, { borderTopColor: isDark ? colors.gray[700] : colors.border.light }]}>
                    <Text style={[cs.finalLabel, { color: textColor }]}>{t('checkout.confirm.totalPayment')}</Text>
                    <Text style={[cs.finalValue, { color: primaryColor }]}>{formatCurrency(totalAmount)}</Text>
                  </View>
                  {cardOrderType !== GiftCardType.BUY && (
                    <View style={cs.totalRow}>
                      <Text style={[{ fontSize: 13, color: subColor }]}>{t('checkout.confirm.pointsEarned')}</Text>
                      <Text style={[{ fontSize: 13, fontWeight: '600', color: primaryColor }]}>
                        +{formatPoints(totalPoints)}
                      </Text>
                    </View>
                  )}
                </View>
              </BottomSheetScrollView>
            </BottomSheetModal>}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 12 },
  loadingWrap: { flex: 1, alignItems: 'center', paddingTop: 40 },
  allLockedWrap: { paddingVertical: 12, alignItems: 'center' },
  allLockedText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  lockRow: {
    flexDirection: 'row',
    gap: 6,
    padding: 12,
    borderRadius: 12,
  },
  lockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  lockChipText: { fontSize: 11, fontWeight: '600' },

  section: {
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: { fontSize: 15, fontWeight: '700' },
  giftQtyBadge: { fontSize: 13, fontWeight: '700' },

  recipientList: { gap: 10 },
  addRecipientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addRecipientText: { fontSize: 14, fontWeight: '600' },

  summaryRows: { gap: 10 },
  summaryDivider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },

  footer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white.light,
  },
})

const cs = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  infoSection: { gap: 8, paddingVertical: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '600' },
  itemsSection: {
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemName: { fontSize: 14, fontWeight: '600' },
  itemPrice: { fontSize: 14, fontWeight: '700' },
  totalsSection: {
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  finalRow: { marginTop: 8, paddingTop: 10, borderTopWidth: 1 },
  finalLabel: { fontSize: 15, fontWeight: '700' },
  finalValue: { fontSize: 20, fontWeight: '800' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600' },
  submitBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 15, fontWeight: '700', color: colors.white.light },
})
