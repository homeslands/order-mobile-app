import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { shouldAutoRemoveVoucher } from '@/components/sheet/voucher-validation'
import { useCartValidation } from '@/hooks/use-cart-validation'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import {
  cartActions,
  useCartItems,
  useCartProductSlugs,
  useCartVoucher,
} from '@/stores/cart.store'
import { showToast } from '@/utils'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StyleSheet, useColorScheme, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

import { type CartDisplayItem, toDisplayItem } from './cart-display-item'
import { CartItemRow } from './cart-item-row'

import { CartEmpty } from './cart-empty'

import { CartFooter } from './cart-footer'
import { CartOrderNote } from './cart-order-note'
import { CartSizeSheet } from './cart-size-sheet'

// ─── List helpers (module-level — 0 allocation per render) ───────────────────


const ItemSeparator = () => <View style={listStyles.separator} />

const listStyles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: STATIC_TOP_INSET + 60, paddingBottom: 200 },
  separator: { height: 10 },
})

// ─── Main Content ────────────────────────────────────────────────────────────

export default function CartContent({ scrollY }: { scrollY?: SharedValue<number> }) {
  const router = useRouter()
  const { t } = useTranslation('menu')
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const rawItems = useCartItems()
  const items = useMemo(() => rawItems.map(toDisplayItem), [rawItems])
  const removeItem = cartActions.removeItem
  // 3.3 — Auto-remove voucher when cart changes make it invalid
  const perfVoucher = useCartVoucher()
  const voucherProducts = perfVoucher?.voucherProducts
  const voucherProductSet = useMemo(
    () => new Set<string>(voucherProducts?.map((vp) => vp.product?.slug).filter((s): s is string => !!s) ?? []),
    [voucherProducts],
  )
  // Stable ref via useShallow — only changes when products added/removed,
  // not on qty/note mutations (vs. inline rawItems.map which allocates per store update).
  const cartProductSlugs = useCartProductSlugs()
  // Stable primitive key — only changes when products are added/removed, not on qty/note changes
  const cartSlugKey = useMemo(() => cartProductSlugs.join(','), [cartProductSlugs])
  const hasMountedRef = useRef(false)
  useEffect(() => {
    // Skip first render — avoid state update before mount completes
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    if (!perfVoucher) return
    const shouldRemove = shouldAutoRemoveVoucher(perfVoucher, voucherProductSet, cartProductSlugs, rawItems)
    if (shouldRemove) {
      cartActions.setVoucher(null)
      showToast('Voucher không còn hợp lệ, đã tự động gỡ')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfVoucher, voucherProductSet, cartSlugKey])

  // ── Cart validation against today's menu (auto, once per day) ──
  const { validate } = useCartValidation()
  const didAutoValidateRef = useRef(false)
  useEffect(() => {
    if (didAutoValidateRef.current || rawItems.length === 0) return
    didAutoValidateRef.current = true
    validate()
  }, [validate, rawItems.length])

  const [sizeSheetItemId, setSizeSheetItemId] = useState<string | null>(null)
  const handleSizePress = useCallback((cartKey: string) => setSizeSheetItemId(cartKey), [])
  const handleSizeClose = useCallback(() => setSizeSheetItemId(null), [])

  const handleBrowse = useCallback(() => {
    router.replace('/(tabs)/menu')
  }, [router])

  const handleDelete = useCallback(
    (cartKey?: string) => {
      if (cartKey) removeItem(cartKey)
    },
    [removeItem],
  )

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (scrollY) scrollY.value = e.nativeEvent.contentOffset.y
    },
    [scrollY],
  )

  const renderItem = useCallback(
    ({ item }: { item: CartDisplayItem }) => (
      <CartItemRow
        item={item}
        primaryColor={primaryColor}
        isDark={isDark}
        onDelete={handleDelete}
        onSizePress={handleSizePress}
      />
    ),
    [primaryColor, isDark, handleDelete, handleSizePress],
  )

  const keyExtractor = useCallback((item: CartDisplayItem) => item.cartKey, [])

  if (items.length === 0) {
    return (
      <CartEmpty
        isDark={isDark}
        onBrowse={handleBrowse}
        browseLabel={t('menu.viewMenu', 'Xem thực đơn')}
        emptyText={t('menu.emptyCart')}
      />
    )
  }

  return (
    <View style={listStyles.root}>
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={() => 'cartItem'}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        contentContainerStyle={listStyles.content}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={ItemSeparator}
        ListFooterComponent={<CartOrderNote isDark={isDark} />}
      />
      <CartFooter
        primaryColor={primaryColor}
        isDark={isDark}
      />
      <CartSizeSheet
        visible={!!sizeSheetItemId}
        itemId={sizeSheetItemId}
        onClose={handleSizeClose}
        isDark={isDark}
        primaryColor={primaryColor}
      />
    </View>
  )
}
