/**
 * GiftCardDetailSheet — bottom sheet chi tiết thẻ quà tặng.
 * snap: 70% | header đồng bộ với LoyaltyPointDetailSheet
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import dayjs from 'dayjs'
import { Check, Clock, Coins, Copy, Gift } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Clipboard,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, GiftCardUsageStatus } from '@/constants'
import { useUserGiftCardBySlug } from '@/hooks/use-gift-cards'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useRedeemGiftCard } from '@/hooks/use-redeem-gift-card'
import { useUserStore } from '@/stores'
import { formatPoints } from '@/utils'
import { showErrorToast, showToast } from '@/utils/toast'

// ─── Constants ────────────────────────────────────────────────────────────────

const SNAP_POINTS = ['70%']

// ─── Copy row ─────────────────────────────────────────────────────────────────

function CopyRow({
  label,
  value,
  primaryColor,
  isDark,
}: {
  label: string
  value: string
  primaryColor: string
  isDark: boolean
}) {
  const [copied, setCopied] = useState(false)
  const subColor  = isDark ? colors.gray[400] : colors.gray[500]
  const textColor = isDark ? colors.gray[50]  : colors.gray[900]
  const rowBg     = isDark ? colors.gray[800] : colors.gray[50]
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]

  const handleCopy = useCallback(() => {
    Clipboard.setString(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [value])

  return (
    <View style={[cr.row, { backgroundColor: rowBg, borderColor }]}>
      <View style={cr.left}>
        <Text style={[cr.label, { color: subColor }]}>{label}</Text>
        <Text style={[cr.value, { color: textColor }]} selectable>{value}</Text>
      </View>
      <Pressable
        onPress={handleCopy}
        hitSlop={8}
        style={[cr.btn, { backgroundColor: copied ? (isDark ? colors.success.bgDark : colors.success.bgLight) : `${primaryColor}15` }]}
      >
        {copied
          ? <Check size={14} color={isDark ? colors.success.dark : colors.success.light} />
          : <Copy size={14} color={primaryColor} />}
      </Pressable>
    </View>
  )
}

const cr = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  left:  { flex: 1, gap: 2 },
  label: { fontSize: 11, fontWeight: '500' },
  value: { fontSize: 14, fontWeight: '600', letterSpacing: 0.4 },
  btn:   { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
})

// ─── Props ────────────────────────────────────────────────────────────────────

interface GiftCardDetailSheetProps {
  visible: boolean
  giftCardSlug: string | null
  onClose: () => void
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export const GiftCardDetailSheet = memo(function GiftCardDetailSheet({
  visible,
  giftCardSlug,
  onClose,
}: GiftCardDetailSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { bottom } = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const userSlug = useUserStore((s) => s.userInfo?.slug)
  const { t } = useTranslation('giftCard')

  const { data: card, isLoading } = useUserGiftCardBySlug(
    visible ? userSlug : null,
    visible ? giftCardSlug : null,
  )

  const { mutate: redeem, isPending: isRedeeming } = useRedeemGiftCard()

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} pressBehavior="close" />
    ),
    [],
  )

  const handleRedeem = useCallback(() => {
    if (!card || !userSlug) return
    redeem(
      { serial: card.serial, code: card.code, userSlug },
      {
        onSuccess: (res) => {
          showToast(t('redeem.success.pointsValue', { points: formatPoints(res.result.cardPoints) }))
          onClose()
        },
        onError: (err: Error) => {
          const code = (err as Error & { response?: { data?: { statusCode?: number } } })?.response?.data?.statusCode
          showErrorToast(code ?? 0)
        },
      },
    )
  }, [card, userSlug, redeem, onClose, t])

  // Derived
  const bg         = isDark ? colors.gray[900] : colors.white.light
  const textColor  = isDark ? colors.gray[50]  : colors.gray[900]
  const subColor   = isDark ? colors.gray[400] : colors.gray[500]
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]
  const sectionBg  = isDark ? colors.gray[800] : colors.gray[50]

  const isAvailable = card?.status === GiftCardUsageStatus.AVAILABLE

  const statusCfg = useMemo(() => {
    if (!card) return null
    if (card.status === GiftCardUsageStatus.AVAILABLE)
      return { bg: isDark ? colors.success.bgDark : colors.success.bgLight, text: isDark ? colors.success.dark : colors.success.light, label: t('status.available') }
    if (card.status === GiftCardUsageStatus.USED)
      return { bg: isDark ? colors.gray[700] : colors.gray[200], text: isDark ? colors.gray[400] : colors.gray[500], label: t('status.used') }
    return { bg: isDark ? 'rgba(127,29,29,0.25)' : '#fee2e2', text: isDark ? colors.destructive.dark : colors.destructive.light, label: t('status.expired') }
  }, [card, isDark, t])

  const formattedCreated = card?.createdAt
    ? dayjs(card.createdAt).format('HH:mm · DD/MM/YYYY')
    : null

  const [nowMs] = useState(() => Date.now())
  const expiryLine = (() => {
    if (!card?.expiredAt) return null
    const days = Math.max(0, Math.floor((new Date(card.expiredAt).getTime() - nowMs) / 86_400_000))
    const date = dayjs(card.expiredAt).format('DD/MM/YYYY')
    return isAvailable && days > 0 ? `${date} · còn ${days} ngày` : date
  })()

  return (
        <BottomSheetModal
          ref={sheetRef}
          snapPoints={SNAP_POINTS}
          enablePanDownToClose
          enableDynamicSizing={false}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: bg }}
          handleIndicatorStyle={{ backgroundColor: isDark ? colors.gray[600] : colors.gray[300] }}
          onDismiss={onClose}
        >
          <BottomSheetScrollView
            contentContainerStyle={[s.content, { paddingBottom: isAvailable ? 16 : bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <ActivityIndicator color={primaryColor} style={{ paddingVertical: 48 }} />
            ) : !card ? (
              <View style={s.emptyWrap}>
                <Gift size={32} color={colors.gray[400]} />
                <Text style={[s.emptyText, { color: subColor }]}>{t('detail.notFound')}</Text>
              </View>
            ) : (
              <>
                {/* Header — đồng bộ với LoyaltyPointDetailSheet */}
                <View style={s.header}>
                  <View style={[s.iconCircle, { backgroundColor: `${primaryColor}15` }]}>
                    <Gift size={18} color={primaryColor} />
                  </View>
                  <View style={s.headerMid}>
                    <Text style={[s.headerTitle, { color: textColor }]} numberOfLines={1}>
                      {card.cardName}
                    </Text>
                    {formattedCreated && (
                      <Text style={[s.headerSub, { color: subColor }]}>{formattedCreated}</Text>
                    )}
                  </View>
                  {statusCfg && (
                    <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
                      <Text style={[s.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
                    </View>
                  )}
                </View>

                {/* Points box — đồng bộ với loyalty point box */}
                <View style={[s.box, { backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}25` }]}>
                  <View style={s.boxRow}>
                    <Coins size={15} color={primaryColor} />
                    <Text style={[s.boxPoints, { color: primaryColor }]}>
                      +{formatPoints(card.cardPoints)} xu
                    </Text>
                  </View>
                  {expiryLine && (
                    <View style={s.boxSubRow}>
                      <Clock size={11} color={subColor} />
                      <Text style={[s.boxSub, { color: subColor }]}>
                        {t('detail.expiresAt')}: {expiryLine}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Serial & Code */}
                <View style={s.codeSection}>
                  <Text style={[s.codeSectionTitle, { color: subColor }]}>
                    {t('detail.codeSection')}
                  </Text>
                  <CopyRow label={t('detail.serial')} value={card.serial} primaryColor={primaryColor} isDark={isDark} />
                  <CopyRow label={t('detail.code')} value={card.code} primaryColor={primaryColor} isDark={isDark} />
                </View>

                {/* Used-at info */}
                {card.usedAt && (
                  <View style={[s.section, { backgroundColor: sectionBg, borderColor }]}>
                    <View style={s.infoRow}>
                      <Text style={[s.infoLabel, { color: subColor }]}>{t('detail.usedAt')}</Text>
                      <Text style={[s.infoVal, { color: textColor }]}>
                        {dayjs(card.usedAt).format('HH:mm · DD/MM/YYYY')}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </BottomSheetScrollView>

          {/* Redeem button — chỉ khi available */}
          {isAvailable && card && (
            <View style={[s.footer, { paddingBottom: bottom + 12 }]}>
              <Pressable
                onPress={handleRedeem}
                disabled={isRedeeming}
                style={[s.redeemBtn, { backgroundColor: primaryColor, opacity: isRedeeming ? 0.7 : 1 }]}
              >
                {isRedeeming
                  ? <ActivityIndicator color={colors.white.light} />
                  : <Text style={s.redeemBtnText}>{t('detail.redeemNow')}</Text>}
              </Pressable>
            </View>
          )}
        </BottomSheetModal>
  )
})

const s = StyleSheet.create({
  content:   { paddingHorizontal: 20, paddingTop: 4, gap: 14 },
  emptyWrap: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14 },
  // Header — shared pattern
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle:  { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerMid:   { flex: 1, gap: 3 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub:   { fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText:  { fontSize: 11, fontWeight: '700' },
  // Points box — shared pattern
  box:      { borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  boxRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  boxPoints: { fontSize: 20, fontWeight: '800' },
  boxSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  boxSub:   { fontSize: 12 },
  // Code section
  codeSection:      { gap: 8 },
  codeSectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  // Info section
  section:   { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 13 },
  infoVal:   { fontSize: 13, fontWeight: '600' },
  // Footer
  footer:       { paddingHorizontal: 20, paddingTop: 12 },
  redeemBtn:    { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  redeemBtnText: { fontSize: 16, fontWeight: '700', color: colors.white.light },
})
