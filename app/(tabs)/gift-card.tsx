/**
 * Tab Gift Card — header kiểu menu, sort giá, cart icon, direct checkout.
 *
 * Perf patterns:
 * - useFocusEffect + InteractionManager.runAfterInteractions → defer fetch
 * - FlashList + overrideItemLayout
 * - renderItem đóng gói giftCardItem để tính cartQty per-item (re-create khi qty thay đổi, chấp nhận được)
 * - GiftCardListItem memoized với custom comparator (re-render chỉ item đang trong giỏ)
 * - useCallback cho tất cả handler
 *
 * UX fixes:
 * #1 — Tap + cùng loại thẻ → increment qty thay vì reset
 * #2 — Card trong giỏ hiện stepper - qty + (trong GiftCardListItem)
 * #3 — Cart badge đếm gift card qty, không phải food order
 * #4 — Cart icon navigate đến /gift-card/checkout nếu đã có item
 * #5 — Chưa login → redirect /auth/login ngay, không add vào store
 * #6 — Replace dialog dùng GiftCardExistsWarningDialog thay Alert.alert
 */
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { ArrowDownNarrowWide, ArrowUpNarrowWide, Gift, ShoppingCart } from 'lucide-react-native'
import React, { startTransition, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image } from 'expo-image'
import {
  InteractionManager,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Images } from '@/assets/images'

import { GiftCardExistsWarningDialog } from '@/components/gift-card/gift-card-exists-warning-dialog'
import { GiftCardListItem, GIFT_CARD_ITEM_HEIGHT, GIFT_CARD_IMAGE_SIZE } from '@/components/gift-card/gift-card-list-item'
import { Skeleton } from '@/components/ui'
import { colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { TabScreenLayout } from '@/components/layout'
import { showErrorToastMessage } from '@/utils/toast'
import { useGiftCards } from '@/hooks/use-gift-cards'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useGiftCardStore, useUserStore } from '@/stores'
import type { IGiftCard } from '@/types'

const ENTRY_FETCH_DELAY_MS = 120
const ITEM_PADDING_BOTTOM = 12
const ITEM_SIZE = GIFT_CARD_ITEM_HEIGHT + ITEM_PADDING_BOTTOM
type SortOrder = 'asc' | 'desc' | null

function overrideItemLayout(layout: { span?: number; size?: number }) {
  layout.size = ITEM_SIZE
}

function keyExtractor(item: IGiftCard) {
  return item.slug
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GiftCardSkeleton() {
  return (
    <View style={sk.wrapper}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={sk.card}>
          {/* imageWrap: 128×128, padding 8 → imageInner 112×112 rounded */}
          <View style={sk.imageWrap}>
            <Skeleton style={sk.imageInner} />
          </View>
          <View style={sk.content}>
            {/* topInfo: title + points stacked */}
            <View style={sk.topInfo}>
              <Skeleton style={sk.title} />
              <Skeleton style={sk.points} />
            </View>
            {/* footer: price + btn */}
            <View style={sk.footer}>
              <Skeleton style={sk.price} />
              <Skeleton style={sk.btn} />
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

const sk = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, gap: 12, marginTop: 12 },
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.gray[100],
  },
  imageWrap: { width: GIFT_CARD_IMAGE_SIZE, height: GIFT_CARD_IMAGE_SIZE, padding: 8 },
  imageInner: { flex: 1, borderRadius: 12 },
  content: { flex: 1, padding: 12, justifyContent: 'space-between' },
  topInfo: { gap: 6 },
  title: { height: 15, width: '75%', borderRadius: 6 },
  points: { height: 12, width: '40%', borderRadius: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { height: 15, width: 80, borderRadius: 6 },
  btn: { height: 34, width: 34, borderRadius: 17 },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function GiftCardScreen() {
  const { t } = useTranslation('giftCard')
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [allowFetch, setAllowFetch] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>(null)
  // Pending card khi user tap + trên thẻ khác — chờ confirm replace
  const [pendingCard, setPendingCard] = useState<IGiftCard | null>(null)

  const giftCardItem = useGiftCardStore((s) => s.giftCardItem)
  const setGiftCardItem = useGiftCardStore((s) => s.setGiftCardItem)
  const clearGiftCard = useGiftCardStore((s) => s.clearGiftCard)

  // ── Defer fetch ──────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | null = null
      const task = InteractionManager.runAfterInteractions(() => {
        timer = setTimeout(() => {
          startTransition(() => setAllowFetch(true))
        }, ENTRY_FETCH_DELAY_MS)
      })
      return () => {
        task.cancel()
        if (timer) clearTimeout(timer)
      }
    }, []),
  )

  const { data, isPending, refetch, isRefetching } = useGiftCards(
    undefined,
    { enabled: allowFetch },
  )

  const items = useMemo(() => {
    const list = data?.items ?? []
    if (!sortOrder) return list
    return [...list].sort((a, b) =>
      sortOrder === 'asc' ? a.price - b.price : b.price - a.price,
    )
  }, [data, sortOrder])

  // ── Handlers ──────────────────────────────────────────────────────────────

  /**
   * Tap + trên một thẻ (nút chỉ hiện khi thẻ chưa có trong giỏ):
   * - Chưa login → redirect login
   * - Giỏ trống → add qty=1 + navigate checkout
   * - Khác loại thẻ → show replace dialog
   */
  const handleSelect = useCallback(
    (item: IGiftCard) => {
      const userInfo = useUserStore.getState().userInfo
      if (!userInfo?.slug) {
        showErrorToastMessage('toast.unloggedIn')
        router.push('/auth/login' as Parameters<typeof router.push>[0])
        return
      }

      if (!giftCardItem) {
        setGiftCardItem({
          id: item.slug,
          slug: item.slug,
          title: item.title,
          image: item.image,
          description: item.description,
          points: item.points,
          price: item.price,
          quantity: 1,
          isActive: item.isActive,
          version: item.version,
        })
        router.push('/gift-card/checkout' as Parameters<typeof router.push>[0])
        return
      }

      // Khác loại thẻ → replace dialog
      setPendingCard(item)
    },
    [giftCardItem, setGiftCardItem, router],
  )

  // #4 — cart icon: nếu đã có item → vào checkout, không thì không làm gì
  const handleCartPress = useCallback(() => {
    if (giftCardItem) {
      router.push('/gift-card/checkout' as Parameters<typeof router.push>[0])
    }
  }, [giftCardItem, router])

  const handleSortToggle = useCallback((order: SortOrder) => {
    setSortOrder((prev) => (prev === order ? null : order))
  }, [])

  // #6 — Replace dialog handlers
  const handleReplace = useCallback(() => {
    if (!pendingCard) return
    clearGiftCard(false)
    setGiftCardItem({
      id: pendingCard.slug,
      slug: pendingCard.slug,
      title: pendingCard.title,
      image: pendingCard.image,
      description: pendingCard.description,
      points: pendingCard.points,
      price: pendingCard.price,
      quantity: 1,
      isActive: pendingCard.isActive,
      version: pendingCard.version,
    })
    setPendingCard(null)
    router.push('/gift-card/checkout' as Parameters<typeof router.push>[0])
  }, [pendingCard, clearGiftCard, setGiftCardItem, router])

  const handleCancelReplace = useCallback(() => {
    setPendingCard(null)
  }, [])

  // ── renderItem — re-create khi giftCardItem thay đổi (để inCart đúng) ──
  const renderItem = useCallback(
    ({ item }: { item: IGiftCard }) => (
      <GiftCardListItem
        item={item}
        primaryColor={primaryColor}
        inCart={giftCardItem?.slug === item.slug}
        onSelect={handleSelect}
      />
    ),
    [primaryColor, handleSelect, giftCardItem],
  )

  // ── Colors ────────────────────────────────────────────────────────────────
  const headerBg = isDark ? colors.gray[900] : colors.white.light
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const chipBg = isDark ? colors.gray[800] : colors.gray[100]
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]

  // #3 — badge = qty thẻ quà tặng, không phải food cart
  const cartBadgeCount = giftCardItem?.quantity ?? 0

  // BAR_HEIGHT(64) + BAR_PADDING(8) + FADE_HEIGHT(120) + insets.bottom
  const listContentStyle = useMemo(
    () => ({ paddingTop: 12, paddingBottom: insets.bottom + 200 }),
    [insets.bottom],
  )

  return (
    <TabScreenLayout>
      {/* Header */}
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: STATIC_TOP_INSET + 12, borderBottomColor: borderColor }]}>
        {/* Title row */}
        <View style={s.titleRow}>
          <Image
            source={isDark ? Images.Brand.LogoWhite : Images.Brand.Logo}
            contentFit="contain"
            style={s.logo}
          />

          {/* #3 #4 — Cart icon: badge = gift card qty, navigate checkout */}
          <View>
            <Pressable
              onPress={handleCartPress}
              hitSlop={8}
              style={[
                s.cartBtn,
                {
                  backgroundColor: isDark ? colors.gray[800] : colors.gray[100],
                  opacity: cartBadgeCount > 0 ? 1 : 0.45,
                },
              ]}
            >
              <ShoppingCart size={20} color={isDark ? colors.gray[50] : colors.gray[900]} />
            </Pressable>
            {cartBadgeCount > 0 && (
              <View style={s.cartBadge}>
                <Text style={s.cartBadgeText}>
                  {cartBadgeCount > 99 ? '99+' : cartBadgeCount}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Filter chips: Giá tăng dần | Giá giảm dần */}
        <View style={s.filterRow}>
          <Pressable
            onPress={() => handleSortToggle('asc')}
            style={[
              s.sortChip,
              {
                backgroundColor: sortOrder === 'asc' ? primaryColor : chipBg,
                borderColor: sortOrder === 'asc' ? primaryColor : borderColor,
              },
            ]}
          >
            <ArrowUpNarrowWide size={14} color={sortOrder === 'asc' ? colors.white.light : subColor} />
            <Text style={[s.sortChipText, { color: sortOrder === 'asc' ? colors.white.light : subColor }]}>
              {t('sortAsc')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSortToggle('desc')}
            style={[
              s.sortChip,
              {
                backgroundColor: sortOrder === 'desc' ? primaryColor : chipBg,
                borderColor: sortOrder === 'desc' ? primaryColor : borderColor,
              },
            ]}
          >
            <ArrowDownNarrowWide size={14} color={sortOrder === 'desc' ? colors.white.light : subColor} />
            <Text style={[s.sortChipText, { color: sortOrder === 'desc' ? colors.white.light : subColor }]}>
              {t('sortDesc')}
            </Text>
          </Pressable>
        </View>

      </View>

      {/* Content */}
      {!allowFetch || isPending ? (
        <GiftCardSkeleton />
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Gift size={48} color={colors.gray[300]} />
          <Text style={[s.emptyText, { color: subColor }]}>Chưa có thẻ quà tặng nào</Text>
        </View>
      ) : (
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          overrideItemLayout={overrideItemLayout}
          contentContainerStyle={listContentStyle}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={primaryColor}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* #6 — Replace warning dialog */}
      {giftCardItem && pendingCard && (
        <GiftCardExistsWarningDialog
          open={!!pendingCard}
          currentCard={{
            slug: giftCardItem.slug,
            title: giftCardItem.title,
            image: giftCardItem.image,
            description: giftCardItem.description ?? '',
            price: giftCardItem.price,
            points: giftCardItem.points,
            isActive: giftCardItem.isActive ?? true,
            version: giftCardItem.version ?? 1,
          }}
          currentQuantity={giftCardItem.quantity}
          newCard={pendingCard}
          newQuantity={1}
          onCancel={handleCancelReplace}
          onReplace={handleReplace}
        />
      )}
    </TabScreenLayout>
  )
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    height: 32,
    width: 120,
  },
  cartBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.destructive.light,
    borderWidth: 1.5,
    borderColor: colors.white.light,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: colors.white.light,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  // lockRow: {
  //   flexDirection: 'row',
  //   gap: 6,
  // },
  // lockChip: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   gap: 4,
  //   paddingHorizontal: 8,
  //   paddingVertical: 4,
  //   borderRadius: 999,
  //   borderWidth: 1,
  // },
  // lockChipText: {
  //   fontSize: 11,
  //   fontWeight: '600',
  // },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: { fontSize: 15 },
})
