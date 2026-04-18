/**
 * GiftCardOrderDetailSheet — ZaloPay-style chi tiết đơn mua thẻ quà tặng.
 * Hero căn giữa → info card → gift cards list (nếu có)
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import dayjs from 'dayjs'
import {
  Check,
  Clipboard as ClipboardIcon,
  Gift,
  ShoppingBag,
  UserRound,
  Users,
} from 'lucide-react-native'
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

import { colors, GiftCardType } from '@/constants'
import { useCardOrderBySlug } from '@/hooks/use-card-order'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { formatCurrency } from '@/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const SNAP_POINTS = ['80%']

const PAYMENT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  COMPLETED: { bg: '#dcfce7', text: '#16a34a' },
  PAID: { bg: '#dcfce7', text: '#16a34a' },
  PENDING: { bg: '#fef9c3', text: '#b45309' },
  FAILED: { bg: '#fee2e2', text: '#dc2626' },
  CANCELLED: { bg: '#fee2e2', text: '#dc2626' },
}

// ─── CopyableInline ───────────────────────────────────────────────────────────

function CopyableInline({
  value,
  primaryColor,
  textColor,
}: {
  value: string
  primaryColor: string
  textColor: string
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    Clipboard.setString(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [value])

  return (
    <View style={ci.row}>
      <Text style={[ci.val, { color: textColor }]} numberOfLines={1} selectable>
        {value}
      </Text>
      <Pressable onPress={handleCopy} hitSlop={10}>
        {copied ? (
          <Check size={13} color="#16a34a" />
        ) : (
          <ClipboardIcon size={13} color={primaryColor} />
        )}
      </Pressable>
    </View>
  )
}

const ci = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  val: { fontSize: 13, fontWeight: '600', maxWidth: 160 },
})

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({
  label,
  subColor,
  children,
}: {
  label: string
  subColor: string
  children: React.ReactNode
}) {
  return (
    <View style={ir.row}>
      <Text style={[ir.label, { color: subColor }]}>{label}</Text>
      <View style={ir.right}>{children}</View>
    </View>
  )
}

const ir = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  label: { fontSize: 13 },
  right: { flexShrink: 1, marginLeft: 12, alignItems: 'flex-end' },
})

// ─── Props ────────────────────────────────────────────────────────────────────

interface GiftCardOrderDetailSheetProps {
  visible: boolean
  orderSlug: string | null
  onClose: () => void
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export const GiftCardOrderDetailSheet = memo(function GiftCardOrderDetailSheet({
  visible,
  orderSlug,
  onClose,
}: GiftCardOrderDetailSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { bottom } = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const { t } = useTranslation('giftCard')

  const { data: order, isPending: isLoading } = useCardOrderBySlug(
    visible ? orderSlug : null,
  )

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

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

  // Derived
  const bg = isDark ? colors.gray[900] : colors.white.light
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]
  const cardBg = isDark ? colors.gray[800] : colors.gray[50]

  const paymentStatusLabelMap = useMemo(
    () => ({
      COMPLETED: t('paymentStatus.completed'),
      PAID: t('paymentStatus.completed'),
      PENDING: t('paymentStatus.pending'),
      FAILED: t('paymentStatus.failed'),
      CANCELLED: t('paymentStatus.cancelled'),
    }),
    [t],
  )

  const paymentMethodLabelMap = useMemo(
    () => ({
      ZALOPAY: t('paymentMethod.zalopay'),
      CASH: t('paymentMethod.cash'),
      VNPAY: t('paymentMethod.vnpay'),
      MOMO: t('paymentMethod.momo'),
      BANKING: t('paymentMethod.banking'),
    }),
    [t],
  )

  const statusCfg = useMemo(() => {
    if (!order) return null
    const key = (order.paymentStatus ?? '').toUpperCase()
    const colors = PAYMENT_STATUS_COLORS[key]
    return colors
      ? {
          ...colors,
          label:
            paymentStatusLabelMap[key as keyof typeof paymentStatusLabelMap] ??
            order.paymentStatus,
        }
      : { bg: cardBg, text: subColor, label: order.paymentStatus }
  }, [order, paymentStatusLabelMap, cardBg, subColor])

  const typeLabel =
    order?.type === GiftCardType.GIFT
      ? t('type.gift')
      : order?.type === GiftCardType.BUY
        ? t('type.buy')
        : t('type.self')

  const TypeIcon =
    order?.type === GiftCardType.GIFT
      ? Users
      : order?.type === GiftCardType.BUY
        ? ShoppingBag
        : UserRound

  const formattedDate = order?.orderDate
    ? dayjs(order.orderDate).format('HH:mm · DD/MM/YYYY')
    : order?.createdAt
      ? dayjs(order.createdAt).format('HH:mm · DD/MM/YYYY')
      : '—'

  const paymentMethodLabel = useMemo(() => {
    if (!order?.paymentMethod) return '—'
    const key = (order.paymentMethod ?? '').toUpperCase()
    return (
      paymentMethodLabelMap[key as keyof typeof paymentMethodLabelMap] ??
      order.paymentMethod
    )
  }, [order?.paymentMethod, paymentMethodLabelMap])

  const giftCards = order?.giftCards ?? []
  const hasGiftCards = giftCards.length > 0 && order?.type === GiftCardType.BUY

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: bg }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? colors.gray[600] : colors.gray[300],
      }}
      onDismiss={onClose}
    >
      <BottomSheetScrollView
        contentContainerStyle={[s.content, { paddingBottom: bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator
            color={primaryColor}
            style={{ paddingVertical: 48 }}
          />
        ) : !order ? (
          <View style={s.emptyWrap}>
            <Gift size={32} color={colors.gray[400]} />
            <Text style={[s.emptyText, { color: subColor }]}>
              {t('orderDetail.notFound')}
            </Text>
          </View>
        ) : (
          <>
            {/* ── Hero ─────────────────────────────────────────────── */}
            <View style={s.hero}>
              <View
                style={[s.heroCircle, { backgroundColor: `${primaryColor}15` }]}
              >
                <Gift size={26} color={primaryColor} />
              </View>
              <Text style={[s.heroTitle, { color: textColor }]}>
                {t('orderDetail.title')}
              </Text>
              <Text style={[s.heroAmount, { color: textColor }]}>
                -{formatCurrency(order.totalAmount)}
              </Text>
              <Text style={[s.heroSub, { color: subColor }]}>
                {order.cardTitle}
              </Text>

              {/* Type badge */}
              <View
                style={[s.typeBadge, { backgroundColor: `${primaryColor}15` }]}
              >
                <TypeIcon size={11} color={primaryColor} />
                <Text style={[s.typeBadgeText, { color: primaryColor }]}>
                  {typeLabel}
                </Text>
              </View>
            </View>

            {/* ── Info card ────────────────────────────────────────── */}
            <View style={[s.card, { backgroundColor: cardBg, borderColor }]}>
              {/* Trạng thái */}
              {statusCfg && (
                <>
                  <InfoRow label={t('orderDetail.status')} subColor={subColor}>
                    <View style={[s.badge, { backgroundColor: statusCfg.bg }]}>
                      <Text style={[s.badgeText, { color: statusCfg.text }]}>
                        {statusCfg.label}
                      </Text>
                    </View>
                  </InfoRow>
                  <View style={[s.divider, { backgroundColor: borderColor }]} />
                </>
              )}

              {/* Ngày đặt hàng */}
              <InfoRow label={t('orderDetail.orderDate')} subColor={subColor}>
                <Text style={[s.rowVal, { color: textColor }]}>
                  {formattedDate}
                </Text>
              </InfoRow>

              <View style={[s.divider, { backgroundColor: borderColor }]} />

              {/* Phương thức TT */}
              <InfoRow
                label={t('orderDetail.paymentMethod')}
                subColor={subColor}
              >
                <Text style={[s.rowVal, { color: textColor }]}>
                  {paymentMethodLabel}
                </Text>
              </InfoRow>

              <View style={[s.divider, { backgroundColor: borderColor }]} />

              {/* Số lượng */}
              <InfoRow label={t('orderDetail.quantity')} subColor={subColor}>
                <Text style={[s.rowVal, { color: textColor }]}>
                  {t('orders.cards', { count: order.quantity })}
                </Text>
              </InfoRow>

              <View style={[s.divider, { backgroundColor: borderColor }]} />

              {/* Mã đơn hàng */}
              <InfoRow label={t('orderDetail.orderCode')} subColor={subColor}>
                <CopyableInline
                  value={order.code || order.slug}
                  primaryColor={primaryColor}
                  textColor={textColor}
                />
              </InfoRow>
            </View>

            {/* ── Gift cards list ───────────────────────────────────── */}
            {hasGiftCards && (
              <>
                <Text style={[s.sectionTitle, { color: subColor }]}>
                  {t('orderDetail.giftCardsSection', {
                    count: giftCards.length,
                  })}
                </Text>
                <View
                  style={[s.card, { backgroundColor: cardBg, borderColor }]}
                >
                  {giftCards.map((gc, i) => (
                    <View key={gc.slug}>
                      <View style={s.gcRow}>
                        <View style={s.gcLeft}>
                          <Text style={[s.gcSerial, { color: subColor }]}>
                            {t('orderSuccess.codeItem.serial')}
                          </Text>
                          <Text
                            style={[s.gcVal, { color: textColor }]}
                            selectable
                          >
                            {gc.serial}
                          </Text>
                        </View>
                        <View style={s.gcRight}>
                          <Text style={[s.gcSerial, { color: subColor }]}>
                            {t('orderSuccess.codeItem.code')}
                          </Text>
                          <Text
                            style={[s.gcVal, { color: textColor }]}
                            selectable
                          >
                            {gc.code}
                          </Text>
                        </View>
                      </View>
                      {i < giftCards.length - 1 && (
                        <View
                          style={[s.divider, { backgroundColor: borderColor }]}
                        />
                      )}
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
})

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },

  // Empty
  emptyWrap: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14 },

  // Hero
  hero: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  heroCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: { fontSize: 14, fontWeight: '500' },
  heroAmount: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heroSub: { fontSize: 13 },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },

  // Card
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth },

  // Rows
  rowVal: { fontSize: 13, fontWeight: '600' },

  // Badge
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Section title
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },

  // Gift card row
  gcRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  gcLeft: { flex: 1, gap: 2 },
  gcRight: { flex: 1, gap: 2, alignItems: 'flex-end' },
  gcSerial: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  gcVal: { fontSize: 13, fontWeight: '700' },
})
