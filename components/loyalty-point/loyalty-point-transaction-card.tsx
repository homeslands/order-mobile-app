import { Clock, Coins, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react-native'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, LoyaltyPointHistoryType, LoyaltyPointTransactionStatus } from '@/constants'
import type { ILoyaltyPointHistory } from '@/types'
import { formatPoints } from '@/utils'

// ─── Type config ──────────────────────────────────────────────────────────────

interface TypeConfig {
  iconBgLight: string
  iconBgDark: string
  pillBgLight: string
  pillBgDark: string
  pillTextLight: string
  pillTextDark: string
  pointsColorLight: string
  pointsColorDark: string
  prefix: string
  Icon: typeof TrendingUp
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
  [LoyaltyPointHistoryType.ADD]: {
    iconBgLight: '#dcfce7',
    iconBgDark: '#14532d',
    pillBgLight: '#dcfce7',
    pillBgDark: '#14532d',
    pillTextLight: '#16a34a',
    pillTextDark: '#4ade80',
    pointsColorLight: '#16a34a',
    pointsColorDark: '#4ade80',
    prefix: '+',
    Icon: TrendingUp,
  },
  [LoyaltyPointHistoryType.USE]: {
    iconBgLight: '#fee2e2',
    iconBgDark: '#7f1d1d',
    pillBgLight: '#fee2e2',
    pillBgDark: '#7f1d1d',
    pillTextLight: '#dc2626',
    pillTextDark: '#f87171',
    pointsColorLight: '#dc2626',
    pointsColorDark: '#f87171',
    prefix: '-',
    Icon: TrendingDown,
  },
  [LoyaltyPointHistoryType.RESERVE]: {
    iconBgLight: colors.gray[200],
    iconBgDark: colors.gray[700],
    pillBgLight: colors.gray[200],
    pillBgDark: colors.gray[700],
    pillTextLight: colors.gray[500],
    pillTextDark: colors.gray[400],
    pointsColorLight: colors.gray[500],
    pointsColorDark: colors.gray[400],
    prefix: '-',
    Icon: Clock,
  },
  [LoyaltyPointHistoryType.REFUND]: {
    iconBgLight: '#fef9c3',
    iconBgDark: '#713f12',
    pillBgLight: '#fef9c3',
    pillBgDark: '#713f12',
    pillTextLight: '#b45309',
    pillTextDark: '#fbbf24',
    pointsColorLight: '#b45309',
    pointsColorDark: '#fbbf24',
    prefix: '+',
    Icon: RefreshCw,
  },
}

const FALLBACK_CONFIG = TYPE_CONFIG[LoyaltyPointHistoryType.ADD]

// ─── Component ────────────────────────────────────────────────────────────────

interface LoyaltyPointTransactionCardProps {
  item: ILoyaltyPointHistory
  primaryColor: string
  isDark: boolean
  onPress: (item: ILoyaltyPointHistory) => void
}

function areEqual(
  prev: LoyaltyPointTransactionCardProps,
  next: LoyaltyPointTransactionCardProps,
) {
  return (
    prev.item.id === next.item.id &&
    prev.item.status === next.item.status &&
    prev.item.points === next.item.points &&
    prev.isDark === next.isDark &&
    prev.primaryColor === next.primaryColor
  )
}

export const LoyaltyPointTransactionCard = memo(function LoyaltyPointTransactionCard({
  item,
  primaryColor,
  isDark,
  onPress,
}: LoyaltyPointTransactionCardProps) {
  const { t } = useTranslation('profile')

  const cfg = TYPE_CONFIG[item.type] ?? FALLBACK_CONFIG

  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const bg = isDark ? colors.gray[900] : colors.white.light
  const borderColor = isDark ? colors.gray[700] : colors.gray[100]

  const iconBg = isDark ? cfg.iconBgDark : cfg.iconBgLight
  const pillBg = isDark ? cfg.pillBgDark : cfg.pillBgLight
  const pillText = isDark ? cfg.pillTextDark : cfg.pillTextLight
  const pointsColor = isDark ? cfg.pointsColorDark : cfg.pointsColorLight

  const isPending = item.status === LoyaltyPointTransactionStatus.PENDING

  const { formattedDate } = useMemo(() => ({
    formattedDate: item.date
      ? new Date(item.date).toLocaleDateString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—',
  }), [item.date])

  const typeLabel = useMemo(() => {
    const keyMap: Record<string, string> = {
      [LoyaltyPointHistoryType.ADD]: 'profile.points.add',
      [LoyaltyPointHistoryType.USE]: 'profile.points.use',
      [LoyaltyPointHistoryType.RESERVE]: 'profile.points.reserve',
      [LoyaltyPointHistoryType.REFUND]: 'profile.points.refund',
    }
    const key = keyMap[item.type]
    return key ? t(key) : item.type
  }, [item.type, t])

  const handlePress = useCallback(() => onPress(item), [onPress, item])

  const { TypeIcon } = useMemo(() => ({ TypeIcon: cfg.Icon }), [cfg.Icon])

  return (
    <Pressable
      onPress={handlePress}
      style={[s.item, { backgroundColor: bg, borderColor }]}
    >
      {/* Top row */}
      <View style={s.topRow}>
        <View style={[s.iconCircle, { backgroundColor: iconBg }]}>
          <TypeIcon size={14} color={pillText} />
        </View>
        <View style={[s.typePill, { backgroundColor: pillBg }]}>
          <Text style={[s.typePillText, { color: pillText }]}>{typeLabel}</Text>
        </View>
        {isPending && (
          <View style={[s.pendingPill, { backgroundColor: isDark ? colors.gray[700] : colors.gray[200] }]}>
            <Text style={[s.pendingText, { color: subColor }]}>
              {t('profile.points.pending')}
            </Text>
          </View>
        )}
        <View style={s.spacer} />
        <View style={s.dateRow}>
          <Clock size={10} color={subColor} />
          <Text style={[s.dateText, { color: subColor }]}>{formattedDate}</Text>
        </View>
      </View>

      {/* Points */}
      <View style={s.pointsRow}>
        <Coins size={15} color={pointsColor} />
        <Text style={[s.pointsText, { color: pointsColor }]}>
          {cfg.prefix}{formatPoints(item.points)} {t('profile.points.point')}
        </Text>
      </View>

      {/* Balance */}
      <View style={s.infoRow}>
        <Text style={[s.infoLabel, { color: subColor }]}>
          {t('profile.points.lastPoints')}:{' '}
        </Text>
        <Text style={[s.infoVal, { color: textColor }]}>
          {formatPoints(item.lastPoints)} {t('profile.points.point')}
        </Text>
      </View>

      {/* Order slug */}
      {!!item.orderSlug && (
        <View style={s.infoRow}>
          <Text style={[s.infoLabel, { color: subColor }]}>
            {t('profile.points.orderSlug')}:{' '}
          </Text>
          <Text
            style={[s.infoVal, { color: primaryColor }]}
            numberOfLines={1}
          >
            {item.orderSlug}
          </Text>
        </View>
      )}
    </Pressable>
  )
},
areEqual)

const s = StyleSheet.create({
  item: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pendingPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pendingText: {
    fontSize: 10,
    fontWeight: '600',
  },
  spacer: { flex: 1 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dateText: { fontSize: 10 },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pointsText: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: { fontSize: 12 },
  infoVal: { fontSize: 12, fontWeight: '500', flexShrink: 1 },
})
