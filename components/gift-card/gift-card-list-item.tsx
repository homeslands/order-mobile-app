import { Image } from 'expo-image'
import { Coins, Gift, Plus } from 'lucide-react-native'
import { memo, useCallback } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors } from '@/constants'
import { IGiftCard } from '@/types'
import { capitalizeFirst, formatCurrency, formatPoints } from '@/utils'
import { getProductImageUrl } from '@/utils/product-image-url'
import { useTranslation } from 'react-i18next'

export const GIFT_CARD_ITEM_HEIGHT = 128
export const GIFT_CARD_IMAGE_SIZE = 128

interface GiftCardListItemProps {
  item: IGiftCard
  primaryColor: string
  isDark: boolean
  /** true khi thẻ này đang được chọn trong giỏ */
  inCart: boolean
  onSelect: (item: IGiftCard) => void
}

export const GiftCardListItem = memo(
  function GiftCardListItem({
    item,
    primaryColor,
    isDark,
    inCart,
    onSelect,
  }: GiftCardListItemProps) {
    const handleSelect = useCallback(() => onSelect(item), [item, onSelect])
    const imageUrl = getProductImageUrl(item.image)
    const { t } = useTranslation('giftCard')

    const cardBg = isDark ? colors.gray[900] : colors.white.light
    const titleColor = isDark ? colors.gray[50] : colors.gray[900]
    const priceColor = isDark ? colors.gray[200] : colors.gray[800]
    const imgBg = isDark ? colors.gray[800] : colors.gray[100]

    return (
      <View style={s.wrapper}>
        <View
          style={[
            s.card,
            {
              backgroundColor: cardBg,
              borderColor: inCart
                ? primaryColor
                : isDark
                  ? colors.gray[700]
                  : colors.gray[100],
              borderWidth: inCart ? 1.5 : 1,
            },
            !item.isActive && s.cardInactive,
          ]}
        >
          {/* Image */}
          <View style={s.imageWrap}>
            <View style={[s.imageInner, { backgroundColor: imgBg }]}>
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={s.image}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={s.imageFallback}>
                  <Gift size={32} color={colors.gray[400]} />
                </View>
              )}
              {!item.isActive && (
                <View style={s.inactiveOverlay}>
                  <Text style={s.inactiveText}>{t('unavailable')}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Content */}
          <View style={s.content}>
            <View style={s.topInfo}>
              <Text style={[s.title, { color: titleColor }]} numberOfLines={2}>
                {capitalizeFirst(item.title)}
              </Text>
              <View style={s.pointsBadge}>
                <Coins size={11} color={primaryColor} />
                <Text style={[s.pointsText, { color: primaryColor }]}>
                  {formatPoints(item.points)}
                </Text>
              </View>
            </View>

            <View style={s.footer}>
              <Text style={[s.price, { color: priceColor }]}>
                {formatCurrency(item.price)}
              </Text>

              {inCart ? (
                /* Badge "Đã chọn" thay thế nút + */
                <View
                  style={[s.selectedBadge, { backgroundColor: primaryColor }]}
                >
                  <Text
                    style={[s.selectedBadgeText, { color: colors.white.light }]}
                  >
                    {t('selected')}
                  </Text>
                </View>
              ) : (
                /* Nút + khi chưa có trong giỏ */
                <Pressable
                  onPress={handleSelect}
                  disabled={!item.isActive}
                  style={[
                    s.addBtn,
                    {
                      backgroundColor: item.isActive
                        ? primaryColor
                        : colors.gray[300],
                    },
                  ]}
                >
                  <Plus
                    size={18}
                    color={colors.white.light}
                    strokeWidth={2.5}
                  />
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>
    )
  },
  (prev, next) =>
    prev.item.slug === next.item.slug &&
    prev.item.title === next.item.title &&
    prev.item.price === next.item.price &&
    prev.item.points === next.item.points &&
    prev.item.isActive === next.item.isActive &&
    prev.item.image === next.item.image &&
    prev.item.version === next.item.version &&
    prev.inCart === next.inCart &&
    prev.primaryColor === next.primaryColor &&
    prev.isDark === next.isDark &&
    prev.onSelect === next.onSelect,
)

const s = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardInactive: { opacity: 0.6 },
  imageWrap: {
    width: GIFT_CARD_IMAGE_SIZE,
    height: GIFT_CARD_IMAGE_SIZE,
    padding: 8,
    flexShrink: 0,
  },
  imageInner: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveText: {
    color: colors.white.light,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  topInfo: {
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pointsText: { fontSize: 12, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: { fontSize: 15, fontWeight: '700' },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
})
