/**
 * Gift Card Order Success Screen — hiển thị receipt sau khi thanh toán thành công.
 *
 * Perf patterns:
 * - useRunAfterTransition: defer data fetch cho đến khi animation xong
 * - memo + useCallback cho GiftCardCodeItem
 * - FlashList cho danh sách gift card codes
 */
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  Clock,
  Copy,
  Gift,
  Send,
  Users,
  XCircle,
} from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Clipboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { FloatingHeader } from '@/components/navigation/floating-header'
import { Skeleton } from '@/components/ui'
import { CardOrderStatus, GiftCardType, colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import {
  useCardOrderBySlug,
  useResendGiftCardSms,
} from '@/hooks/use-card-order'
import { useRunAfterTransition } from '@/hooks'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { formatCurrency, formatPoints } from '@/utils'
import { showToast, showErrorToastMessage } from '@/utils/toast'
import type { IGiftCardDetail } from '@/types'
import type { IReceiverGiftCardResponse } from '@/types'

// ─── Gift Card Code Item ───────────────────────────────────────────────────────

interface GiftCardCodeItemProps {
  item: IGiftCardDetail
  index: number
  primaryColor: string
  isDark: boolean
}

const GiftCardCodeItem = memo(function GiftCardCodeItem({
  item,
  index,
  primaryColor,
  isDark,
}: GiftCardCodeItemProps) {
  const { t } = useTranslation('giftCard')
  const [copied, setCopied] = useState(false)

  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]
  const bgColor = isDark ? colors.gray[800] : colors.gray[50]

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleCopy = useCallback(() => {
    Clipboard.setString(`${item.serial} - ${item.code}`)
    setCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => {
      setCopied(false)
      copyTimerRef.current = null
    }, 2000)
  }, [item.serial, item.code])
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  return (
    <View style={[ci.container, { borderColor, backgroundColor: bgColor }]}>
      <View style={ci.row}>
        <View style={[ci.badge, { backgroundColor: `${primaryColor}20` }]}>
          <Text style={[ci.badgeText, { color: primaryColor }]}>
            #{index + 1}
          </Text>
        </View>
        <View style={ci.info}>
          <View style={ci.codeRow}>
            <Text style={[ci.label, { color: subColor }]}>
              {t('orderSuccess.codeItem.serial')}
            </Text>
            <Text style={[ci.value, { color: textColor }]}>{item.serial}</Text>
          </View>
          <View style={ci.codeRow}>
            <Text style={[ci.label, { color: subColor }]}>
              {t('orderSuccess.codeItem.code')}
            </Text>
            <Text
              style={[ci.value, { color: primaryColor, fontWeight: '700' }]}
            >
              {item.code}
            </Text>
          </View>
          {item.expiredAt && (
            <View style={ci.codeRow}>
              <Text style={[ci.label, { color: subColor }]}>
                {t('orderSuccess.codeItem.expiry')}
              </Text>
              <Text style={[ci.value, { color: subColor }]}>
                {new Date(item.expiredAt).toLocaleDateString('vi-VN')}
              </Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={handleCopy}
          hitSlop={8}
          style={[
            ci.copyBtn,
            { backgroundColor: copied ? `${primaryColor}20` : 'transparent' },
          ]}
        >
          <Copy size={16} color={copied ? primaryColor : subColor} />
        </Pressable>
      </View>
    </View>
  )
})

const ci = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  info: { flex: 1, gap: 4 },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: { fontSize: 11, width: 40 },
  value: { fontSize: 13, fontWeight: '500', flex: 1 },
  copyBtn: {
    padding: 6,
    borderRadius: 8,
  },
})

// ─── Recipient Row ─────────────────────────────────────────────────────────────

interface RecipientRowProps {
  item: IReceiverGiftCardResponse
  isDark: boolean
  primaryColor: string
  onResend?: () => void
  isResending?: boolean
}

const RecipientRow = memo(function RecipientRow({
  item,
  isDark,
  primaryColor,
  onResend,
  isResending,
}: RecipientRowProps) {
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]

  return (
    <View style={[rr.container, { borderBottomColor: borderColor }]}>
      <View style={[rr.avatar, { backgroundColor: `${primaryColor}20` }]}>
        <Users size={14} color={primaryColor} />
      </View>
      <View style={rr.info}>
        {item.name ? (
          <Text style={[rr.name, { color: textColor }]}>{item.name}</Text>
        ) : null}
        <Text style={[rr.phone, { color: item.name ? subColor : textColor }]}>
          {item.phone}
        </Text>
        {item.message ? (
          <Text style={[rr.message, { color: subColor }]} numberOfLines={1}>
            "{item.message}"
          </Text>
        ) : null}
      </View>
      <View style={rr.right}>
        <Text style={[rr.qty, { color: primaryColor }]}>×{item.quantity}</Text>
        {onResend && (
          <Pressable
            onPress={onResend}
            disabled={isResending}
            hitSlop={8}
            style={[rr.resendBtn, { backgroundColor: `${primaryColor}15` }]}
          >
            {isResending ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Send size={13} color={primaryColor} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  )
})

const rr = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600' },
  phone: { fontSize: 13 },
  message: { fontSize: 12, fontStyle: 'italic' },
  right: { alignItems: 'center', gap: 6 },
  qty: { fontSize: 15, fontWeight: '700' },
  resendBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

// ─── Status badge ─────────────────────────────────────────────────────────────

function OrderStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('giftCard')
  const isDark = useColorScheme() === 'dark'

  type BadgeConfig = {
    bg: string
    fg: string
    Icon: typeof CheckCircle2
    label: string
  }
  const config: BadgeConfig | null = (() => {
    switch (status) {
      case CardOrderStatus.COMPLETED:
        return {
          bg: isDark ? colors.success.bgDark : colors.success.bgLight,
          fg: isDark ? colors.success.dark : colors.success.light,
          Icon: CheckCircle2,
          label: t('orderStatus.completed'),
        }
      case CardOrderStatus.PENDING:
        return {
          bg: isDark ? colors.warning.bgDark : colors.warning.bgLight,
          fg: isDark ? colors.warning.dark : colors.warning.textLight,
          Icon: Clock,
          label: t('orderStatus.pending'),
        }
      case CardOrderStatus.FAILED:
        return {
          bg: isDark ? 'rgba(127,29,29,0.25)' : '#fee2e2',
          fg: isDark ? colors.destructive.dark : colors.destructive.light,
          Icon: XCircle,
          label: t('orderStatus.failed'),
        }
      case CardOrderStatus.CANCELLED:
        return {
          bg: isDark ? colors.gray[800] : colors.gray[100],
          fg: isDark ? colors.gray[400] : colors.gray[500],
          Icon: XCircle,
          label: t('orderStatus.cancelled'),
        }
      default:
        return null
    }
  })()

  if (!config) return null
  const { bg, fg, Icon, label } = config
  return (
    <View style={[sb.wrap, { backgroundColor: bg }]}>
      <Icon size={12} color={fg} />
      <Text style={[sb.text, { color: fg }]}>{label}</Text>
    </View>
  )
}

const sb = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  text: { fontSize: 12, fontWeight: '700' },
})

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SuccessSkeleton() {
  return (
    <View style={sk.wrapper}>
      <View style={sk.heroCard}>
        <Skeleton style={[sk.circle, { alignSelf: 'center' }]} />
        <Skeleton style={[sk.line, { width: '60%', alignSelf: 'center' }]} />
        <Skeleton style={[sk.line, { width: '40%', alignSelf: 'center' }]} />
      </View>
      <View style={sk.card}>
        <Skeleton style={sk.line} />
        <Skeleton style={[sk.line, { width: '80%' }]} />
        <Skeleton style={[sk.line, { width: '60%' }]} />
      </View>
    </View>
  )
}

const sk = StyleSheet.create({
  wrapper: { padding: 16, gap: 12, marginTop: 8 },
  heroCard: {
    borderRadius: 16,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.gray[100],
    backgroundColor: colors.white.light,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.gray[100],
    backgroundColor: colors.white.light,
  },
  circle: { width: 64, height: 64, borderRadius: 32 },
  line: { height: 16, borderRadius: 6 },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function GiftCardOrderSuccessScreen() {
  const { t } = useTranslation('giftCard')
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const isDark = useColorScheme() === 'dark'
  const { bottom } = useSafeAreaInsets()

  const [allowFetch, setAllowFetch] = useState(false)
  useRunAfterTransition(() => setAllowFetch(true), [])

  const { data: order, isPending } = useCardOrderBySlug(
    allowFetch ? (slug ?? '') : '',
  )

  const isGift = order?.type === GiftCardType.GIFT
  const isBuy = order?.type === GiftCardType.BUY

  const [resendingId, setResendingId] = useState<string | null>(null)
  const { mutate: resendSms } = useResendGiftCardSms()

  const handleResend = useCallback(
    (recipientId: string) => {
      if (!slug) return
      setResendingId(recipientId)
      resendSms(
        { orderSlug: slug, recipientId },
        {
          onSuccess: () => {
            setResendingId(null)
            showToast(t('orderSuccess.resendSmsSuccess'))
          },
          onError: () => {
            setResendingId(null)
            showErrorToastMessage(t('orderSuccess.resendSmsFailed'))
          },
        },
      )
    },
    [slug, resendSms, t],
  )

  const totalPoints = useMemo(() => {
    if (!order) return 0
    return (order.cardPoint ?? 0) * (order.quantity ?? 0)
  }, [order])

  // Colors
  const bg = isDark ? colors.background.dark : colors.background.light
  const cardBg = isDark ? colors.gray[900] : colors.white.light
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]

  const primaryColor = usePrimaryColor()

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      <FloatingHeader title={t('orderSuccess.title')} disableBlur />

      {isPending || !allowFetch ? (
        <View style={{ marginTop: STATIC_TOP_INSET + 56 }}>
          <SuccessSkeleton />
        </View>
      ) : !order ? (
        <View style={[s.empty, { marginTop: STATIC_TOP_INSET + 56 }]}>
          <Text style={[s.emptyText, { color: subColor }]}>
            {t('orderSuccess.notFound')}
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[
              s.scrollContent,
              { paddingTop: STATIC_TOP_INSET + 64, paddingBottom: bottom + 32 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero card  */}
            <View
              style={[s.heroCard, { backgroundColor: cardBg, borderColor }]}
            >
              <View style={s.heroTop}>
                <View
                  style={[
                    s.successIcon,
                    { backgroundColor: `${primaryColor}18` },
                  ]}
                >
                  <CheckCircle2 size={32} color={primaryColor} />
                </View>
                <OrderStatusBadge status={order.paymentStatus} />
              </View>
              <Text style={[s.heroTitle, { color: textColor }]}>
                {order.cardTitle}
              </Text>
              <Text style={[s.heroSub, { color: subColor }]}>
                {t('orderSuccess.orderCode')}{' '}
                <Text style={{ fontWeight: '700', color: textColor }}>
                  {slug}
                </Text>
              </Text>
            </View>

            {/* Order summary */}
            <View style={[s.card, { backgroundColor: cardBg, borderColor }]}>
              <View style={s.cardHeader}>
                <Gift size={16} color={primaryColor} />
                <Text style={[s.cardTitle, { color: textColor }]}>
                  {t('orderSuccess.section.detail')}
                </Text>
              </View>

              <View style={s.infoRows}>
                <View style={s.infoRow}>
                  <Text style={[s.infoKey, { color: subColor }]}>
                    {t('orderSuccess.info.card')}
                  </Text>
                  <Text
                    style={[s.infoVal, { color: textColor }]}
                    numberOfLines={2}
                  >
                    {order.cardTitle}
                  </Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={[s.infoKey, { color: subColor }]}>
                    {t('orderSuccess.info.quantity')}
                  </Text>
                  <Text style={[s.infoVal, { color: textColor }]}>
                    {t('orderSuccess.info.quantityValue', {
                      count: order.quantity,
                    })}
                  </Text>
                </View>
                {!isBuy && (
                  <View style={s.infoRow}>
                    <Text style={[s.infoKey, { color: subColor }]}>
                      {t('orderSuccess.info.points')}
                    </Text>
                    <Text
                      style={[
                        s.infoVal,
                        { color: primaryColor, fontWeight: '700' },
                      ]}
                    >
                      {t('orderSuccess.info.pointsValue', {
                        points: formatPoints(totalPoints),
                      })}
                    </Text>
                  </View>
                )}
                <View style={[s.divider, { backgroundColor: borderColor }]} />
                <View style={s.infoRow}>
                  <Text
                    style={[s.infoKey, { color: subColor, fontWeight: '600' }]}
                  >
                    {t('orderSuccess.info.totalPayment')}
                  </Text>
                  <Text
                    style={[
                      s.infoVal,
                      { color: textColor, fontWeight: '800', fontSize: 16 },
                    ]}
                  >
                    {formatCurrency(order.totalAmount)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Gift card codes (for SELF type) */}
            {!isGift && order.giftCards && order.giftCards.length > 0 && (
              <View style={[s.card, { backgroundColor: cardBg, borderColor }]}>
                <View style={s.cardHeader}>
                  <Gift size={16} color={primaryColor} />
                  <Text style={[s.cardTitle, { color: textColor }]}>
                    {t('orderSuccess.section.codes', {
                      count: order.giftCards.length,
                    })}
                  </Text>
                </View>
                <Text style={[s.cardHint, { color: subColor }]}>
                  {isBuy
                    ? t('orderSuccess.buyHint')
                    : t('orderSuccess.codeHint')}
                </Text>
                <View style={s.codeList}>
                  {order.giftCards.map((gc, idx) => (
                    <GiftCardCodeItem
                      key={gc.slug}
                      item={gc}
                      index={idx}
                      primaryColor={primaryColor}
                      isDark={isDark}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Recipients (for GIFT type) */}
            {isGift && order.receipients && order.receipients.length > 0 && (
              <View style={[s.card, { backgroundColor: cardBg, borderColor }]}>
                <View style={s.cardHeader}>
                  <Users size={16} color={primaryColor} />
                  <Text style={[s.cardTitle, { color: textColor }]}>
                    {t('orderSuccess.section.recipients', {
                      count: order.receipients.length,
                    })}
                  </Text>
                </View>
                <View style={s.recipientList}>
                  {order.receipients.map((r) => (
                    <RecipientRow
                      key={r.slug}
                      item={r}
                      isDark={isDark}
                      primaryColor={primaryColor}
                      onResend={() => handleResend(r.recipientId)}
                      isResending={resendingId === r.recipientId}
                    />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15 },

  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 17, fontWeight: '700' },
  heroSub: { fontSize: 13 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardHint: { fontSize: 12, marginTop: -4 },

  infoRows: { gap: 10 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoKey: { fontSize: 14, flex: 1 },
  infoVal: { fontSize: 14, fontWeight: '500', flex: 1, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },

  codeList: { gap: 8 },
  recipientList: { gap: 0 },
})
