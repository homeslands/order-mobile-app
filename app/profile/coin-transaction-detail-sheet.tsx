/**
 * CoinTransactionDetailSheet — ZaloPay-style chi tiết giao dịch xu.
 * - Hero: icon + loại + số xu (không có dòng số dư)
 * - IN + GIFT_CARD: hiển thị panel thẻ quà tặng (ảnh, tên, serial)
 * - OUT + CARD_ORDER: hiển thị mã đơn # + button xem chi tiết đơn thẻ
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
  ShoppingCart,
  TrendingDown,
  TrendingUp,
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

import { colors, PointTransactionObjectType, PointTransactionType } from '@/constants'
import { useUserGiftCardBySlug } from '@/hooks/use-gift-cards'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useUserStore } from '@/stores'
import type { IPointTransaction } from '@/types'
import { formatPoints } from '@/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const SNAP_POINTS = ['70%']

const TYPE_CFG = {
  [PointTransactionType.IN]: {
    color: '#16a34a',
    darkColor: colors.success.dark,
    bgL: colors.success.iconBgLight,
    bgD: colors.success.iconBgDark,
    prefix: '+',
    Icon: TrendingUp,
  },
  [PointTransactionType.OUT]: {
    color: colors.destructive.dark,
    darkColor: colors.destructive.light,
    bgL: '#fee2e2',
    bgD: '#7f1d1d',
    prefix: '-',
    Icon: TrendingDown,
  },
} as const

const OBJECT_TYPE_ICON: Record<string, typeof Gift> = {
  [PointTransactionObjectType.GIFT_CARD]: Gift,
  [PointTransactionObjectType.CARD_ORDER]: ShoppingBag,
  [PointTransactionObjectType.ORDER]: ShoppingCart,
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
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleCopy = useCallback(() => {
    Clipboard.setString(value)
    setCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => {
      setCopied(false)
      copyTimerRef.current = null
    }, 1500)
  }, [value])
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  return (
    <View style={ci.row}>
      <Text style={[ci.val, { color: textColor }]} numberOfLines={1}>{value}</Text>
      <Pressable onPress={handleCopy} hitSlop={10}>
        {copied
          ? <Check size={13} color={colors.success.light} />
          : <ClipboardIcon size={13} color={primaryColor} />}
      </Pressable>
    </View>
  )
}

const ci = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  val: { fontSize: 13, fontWeight: '600' },
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
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16 },
  label: { fontSize: 13 },
  right: { flexShrink: 1, marginLeft: 12, alignItems: 'flex-end' },
})

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  transaction: IPointTransaction
  onClose: () => void
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export const CoinTransactionDetailSheet = memo(function CoinTransactionDetailSheet({
  visible,
  transaction,
  onClose,
}: Props) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { bottom } = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const { t } = useTranslation('profile')
  // const router = useRouter()
  const userSlug = useUserStore((s) => s.userInfo?.slug)

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} pressBehavior="close" />
    ),
    [],
  )

  // Normalize to lowercase for robust API value comparison
  const txType = transaction.type?.toLowerCase()
  const txObjType = transaction.objectType?.toLowerCase()

  const isIn = txType === PointTransactionType.IN
  const isOut = txType === PointTransactionType.OUT
  const isGiftCardIn = isIn && txObjType === PointTransactionObjectType.GIFT_CARD
  const isOutCardOrder = isOut && txObjType === PointTransactionObjectType.CARD_ORDER

  // Fetch gift card only for IN + GIFT_CARD
  const { data: giftCard, isLoading: isLoadingCard } = useUserGiftCardBySlug(
    isGiftCardIn && visible ? userSlug : null,
    isGiftCardIn && visible ? transaction.objectSlug : null,
  )

  const cfg = isOut
    ? TYPE_CFG[PointTransactionType.OUT]
    : TYPE_CFG[PointTransactionType.IN]

  const typeColor   = isDark ? cfg.darkColor : cfg.color
  const iconBg      = isDark ? cfg.bgD : cfg.bgL
  const bg          = isDark ? colors.gray[900] : colors.white.light
  const textColor   = isDark ? colors.gray[50]  : colors.gray[900]
  const subColor    = isDark ? colors.gray[400] : colors.gray[500]
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]
  const cardBg      = isDark ? colors.gray[800] : colors.gray[50]

  const ObjectIcon = OBJECT_TYPE_ICON[txObjType] ?? ShoppingCart

  const formattedDate = useMemo(
    () => transaction.createdAt
      ? dayjs(transaction.createdAt).format('HH:mm · DD/MM/YYYY')
      : '—',
    [transaction.createdAt],
  )

  const typeLabel = useMemo(() => {
    const map: Record<string, string> = {
      [PointTransactionType.IN]:  'profile.coin.typeIn',
      [PointTransactionType.OUT]: 'profile.coin.typeOut',
    }
    const key = map[txType]
    return key ? t(key) : transaction.type
  }, [txType, transaction.type, t])

  // const handleViewOrder = useCallback(() => {
  //   onClose()
  //   if (txObjType === PointTransactionObjectType.CARD_ORDER) {
  //     router.push(`/gift-card/order-success/${transaction.objectSlug}` as never)
  //   } else if (txObjType === PointTransactionObjectType.ORDER && transaction.objectSlug) {
  //     navigateNative.push(`/order/${transaction.objectSlug}` as Parameters<typeof navigateNative.push>[0])
  //   } else {
  //     router.push('/profile/history' as never)
  //   }
  // }, [onClose, router, transaction.objectSlug, txObjType])

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

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
            contentContainerStyle={[s.content, { paddingBottom: isOutCardOrder ? bottom + 80 : bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Hero ─────────────────────────────────────────────────── */}
            <View style={s.hero}>
              <View style={[s.heroCircle, { backgroundColor: iconBg }]}>
                <ObjectIcon size={26} color={typeColor} />
              </View>
              <Text style={[s.heroTypeLabel, { color: typeColor }]}>{typeLabel}</Text>
              <Text style={[s.heroAmount, { color: typeColor }]}>
                {cfg.prefix}{formatPoints(transaction.points)} {t('profile.coin.unit')}
              </Text>
            </View>

            {/* ── Desc ─────────────────────────────────────────────────── */}
            {!!transaction.desc && (
              <Text style={[s.desc, { color: textColor }]}>{transaction.desc}</Text>
            )}

            {/* ── Info card ────────────────────────────────────────────── */}
            <View style={[s.card, { backgroundColor: cardBg, borderColor }]}>
              <InfoRow label={t('profile.coin.transactionDate')} subColor={subColor}>
                <Text style={[s.rowVal, { color: textColor }]}>{formattedDate}</Text>
              </InfoRow>

              {/* Mã đơn — chỉ hiện cho OUT type */}
              {isOut && !!transaction.objectSlug && (
                <>
                  <View style={[s.divider, { backgroundColor: borderColor }]} />
                  <InfoRow label={t('profile.coin.orderCode')} subColor={subColor}>
                    <View style={s.orderCodeRow}>
                      <Text style={[s.rowVal, { color: textColor }]}>
                        #{transaction.objectSlug}
                      </Text>
                      {/* <Pressable onPress={handleViewOrder} hitSlop={8}>
                        <Text style={[s.viewDetailLink, { color: primaryColor }]}>
                          {t('profile.coin.viewOrder')}
                        </Text>
                      </Pressable> */}
                    </View>
                  </InfoRow>
                </>
              )}
            </View>

            {/* ── Gift card panel — chỉ hiện cho IN + GIFT_CARD ─────────── */}
            {isGiftCardIn && (
              <View style={[s.card, { backgroundColor: cardBg, borderColor }]}>
                {isLoadingCard ? (
                  <ActivityIndicator color={primaryColor} style={{ paddingVertical: 20 }} />
                ) : giftCard ? (
                  <>
                    <InfoRow label={t('profile.coin.giftCardName')} subColor={subColor}>
                      <Text style={[s.rowVal, { color: textColor }]} numberOfLines={2}>
                        {giftCard.cardName}
                      </Text>
                    </InfoRow>
                    <View style={[s.divider, { backgroundColor: borderColor }]} />
                    <InfoRow label="Serial" subColor={subColor}>
                      <CopyableInline
                        value={giftCard.serial}
                        primaryColor={primaryColor}
                        textColor={textColor}
                      />
                    </InfoRow>
                  </>
                ) : null}
              </View>
            )}
          </BottomSheetScrollView>

          {/* ── View order button — chỉ hiện cho OUT + CARD_ORDER ──────── */}
          {isOutCardOrder && (
            <View style={[s.footer, { paddingBottom: bottom + 12, borderTopColor: borderColor }]}>
              {/* <Pressable
                onPress={handleViewOrder}
                style={[s.viewOrderBtn, { backgroundColor: primaryColor }]}
              >
                <Text style={s.viewOrderText}>{t('profile.coin.viewOrder')}</Text>
                <ArrowRight size={16} color={colors.white.light} />
              </Pressable> */}
            </View>
          )}
    </BottomSheetModal>
  )
})

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },

  // Hero — no balance row
  hero:          { alignItems: 'center', paddingVertical: 20, gap: 6 },
  heroCircle:    { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTypeLabel: { fontSize: 13, fontWeight: '600' },
  heroAmount:    { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },

  // Desc
  desc: { fontSize: 14, fontWeight: '500', textAlign: 'center', paddingHorizontal: 8, lineHeight: 20 },

  // Info card
  card:    { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth },
  rowVal:  { fontSize: 13, fontWeight: '600' },

  // Order code row
  orderCodeRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // viewDetailLink: { fontSize: 12, fontWeight: '600' },

  // Footer button
  footer:        { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  // viewOrderBtn:  { height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  // viewOrderText: { fontSize: 15, fontWeight: '700', color: colors.white.light },
})
