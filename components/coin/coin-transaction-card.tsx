import {
  Clock,
  Gift,
  ShoppingBag,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import {
  colors,
  PointTransactionObjectType,
  PointTransactionType,
} from '@/constants'
import type { IPointTransaction } from '@/types'
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
  [PointTransactionType.IN]: {
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
  [PointTransactionType.OUT]: {
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
}

const FALLBACK_CONFIG = TYPE_CONFIG[PointTransactionType.IN]

const OBJECT_TYPE_ICON: Record<string, typeof Gift> = {
  [PointTransactionObjectType.GIFT_CARD]: Gift,
  [PointTransactionObjectType.CARD_ORDER]: ShoppingBag,
  [PointTransactionObjectType.ORDER]: ShoppingCart,
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CoinTransactionCardProps {
  item: IPointTransaction
  isDark: boolean
  onPress: (item: IPointTransaction) => void
}

function areEqual(
  prev: CoinTransactionCardProps,
  next: CoinTransactionCardProps,
) {
  return (
    prev.item.slug === next.item.slug &&
    prev.item.points === next.item.points &&
    prev.isDark === next.isDark
  )
}

export const CoinTransactionCard = memo(function CoinTransactionCard({
  item,
  isDark,
  onPress,
}: CoinTransactionCardProps) {
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

  const formattedDate = useMemo(
    () =>
      item.createdAt
        ? new Date(item.createdAt).toLocaleDateString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : '—',
    [item.createdAt],
  )

  const typeLabel = useMemo(() => {
    const keyMap: Record<string, string> = {
      [PointTransactionType.IN]: 'profile.coin.typeIn',
      [PointTransactionType.OUT]: 'profile.coin.typeOut',
    }
    const key = keyMap[item.type]
    return key ? t(key) : item.type
  }, [item.type, t])

  const handlePress = useCallback(() => onPress(item), [onPress, item])

  const ObjectIcon = OBJECT_TYPE_ICON[item.objectType] ?? ShoppingCart

  return (
    <Pressable
      onPress={handlePress}
      style={[s.item, { backgroundColor: bg, borderColor }]}
    >
      {/* Top row: icon · type pill · spacer · date */}
      <View style={s.topRow}>
        <View style={[s.iconCircle, { backgroundColor: iconBg }]}>
          <ObjectIcon size={14} color={pillText} />
        </View>
        <View style={[s.typePill, { backgroundColor: pillBg }]}>
          <Text style={[s.typePillText, { color: pillText }]}>{typeLabel}</Text>
        </View>
        <View style={s.spacer} />
        <View style={s.dateRow}>
          <Clock size={10} color={subColor} />
          <Text style={[s.dateText, { color: subColor }]}>{formattedDate}</Text>
        </View>
      </View>

      {/* Desc */}
      <Text style={[s.desc, { color: textColor }]} numberOfLines={2}>
        {item.desc}
      </Text>

      {/* Points */}
      <Text style={[s.pointsText, { color: pointsColor }]}>
        {cfg.prefix}
        {formatPoints(item.points)} {t('profile.coin.unit')}
      </Text>
    </Pressable>
  )
}, areEqual)

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
  spacer: { flex: 1 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dateText: { fontSize: 10 },
  desc: {
    fontSize: 13,
    fontWeight: '500',
  },
  pointsText: {
    fontSize: 15,
    fontWeight: '700',
  },
})
