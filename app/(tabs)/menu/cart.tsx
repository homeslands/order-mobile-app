/**
 * Cart trong menu stack — push từ product detail.
 * Defer shell → content sau transition.
 * Header: back (left) + "Giỏ hàng (N)" (center) + clear all (right).
 * Clear all triggers confirmation bottom sheet (Modal + @gorhom/bottom-sheet).
 *
 * UI & logic ported from perf/cart.tsx, store bridged to order-flow.
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { Stack, useRouter } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity as GHTouchable } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import { FloatingHeader } from '@/components/navigation/floating-header'
import { useRunAfterTransition } from '@/hooks'
import { useOrderFlowStore } from '@/stores'
import { useOrderFlowCartItemCount } from '@/stores/selectors'

const CartContent = lazy(() => import('@/components/cart/cart-content'))

// ─── Clear Confirmation Sheet ────────────────────────────────────────────────

function ClearCartSheet({
  visible,
  onClose,
  onConfirm,
  isDark,
}: {
  visible: boolean
  onClose: () => void
  onConfirm: () => void
  isDark: boolean
}) {
  const insets = useSafeAreaInsets()
  const sheetRef = useRef<BottomSheetModal>(null)
  const { t } = useTranslation('menu')
  const snapPoints = useMemo(() => [220 + insets.bottom], [insets.bottom])

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[900] : colors.white.light }),
    [isDark],
  )
  const handleIndicator = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[600] : colors.gray[300] }),
    [isDark],
  )

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

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const dismissSheet = useCallback(() => sheetRef.current?.dismiss(), [])

  const handleConfirmPress = useCallback(() => {
    onConfirm()
    dismissSheet()
  }, [onConfirm, dismissSheet])

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      activeOffsetY={[-10, 10]}
      failOffsetX={[-5, 5]}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      handleIndicatorStyle={handleIndicator}
      onDismiss={onClose}
    >
          <View style={[confirmStyles.content, { paddingBottom: insets.bottom + 16 }]}>
            <View style={confirmStyles.body}>
              <Trash2 size={32} color={colors.destructive.light} />
              <Text style={[confirmStyles.title, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>
                {t('cart.confirmTitle')}
              </Text>
              <Text style={[confirmStyles.desc, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>
                {t('cart.confirmDesc')}
              </Text>
            </View>

            <View style={confirmStyles.btnRow}>
              <View style={confirmStyles.btnWrap}>
                <GHTouchable
                  onPress={dismissSheet}
                  activeOpacity={0.8}
                  style={[confirmStyles.btn, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] }]}
                >
                  <Text style={[confirmStyles.btnText, { color: isDark ? colors.gray[50] : colors.gray[700] }]}>
                    {t('menu.cancel')}
                  </Text>
                </GHTouchable>
              </View>
              <View style={confirmStyles.btnWrap}>
                <GHTouchable
                  onPress={handleConfirmPress}
                  activeOpacity={0.8}
                  style={[confirmStyles.btn, { backgroundColor: colors.destructive.light }]}
                >
                  <Text style={[confirmStyles.btnText, { color: colors.white.light }]}>
                    {t('cart.clearAll')}
                  </Text>
                </GHTouchable>
              </View>
            </View>
          </View>
    </BottomSheetModal>
  )
}

const confirmStyles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  body: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  desc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 12,
  },
  btnWrap: {
    flex: 1,
  },
  btn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
})

// ─── Clear button (right element cho FloatingHeader) ─────────────────────────

function CartClearBtn({
  itemCount,
  onClearAll,
}: {
  itemCount: number
  onClearAll: () => void
}) {
  if (itemCount === 0) return <View style={clearBtnStyles.placeholder} />
  return (
    <Pressable
      onPress={onClearAll}
      hitSlop={8}
      style={[clearBtnStyles.btn, clearBtnStyles.shadow]}
    >
      <Trash2 size={16} color={colors.white.light} />
    </Pressable>
  )
}

const clearBtnStyles = StyleSheet.create({
  placeholder: { width: 38, height: 38 },
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.destructive.light,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 24,
    elevation: 2,
  },
})

// ─── Skeleton Shell ──────────────────────────────────────────────────────────

function CartShell({ onBack, isDark }: { onBack: () => void; isDark: boolean }) {
  const { t } = useTranslation('menu')
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? colors.background.dark : colors.background.light }}>
      <FloatingHeader title={t('cart.title')} onBack={onBack} disableBlur />
      <View style={{ padding: 16, gap: 12, paddingTop: 80 }}>
        <View style={{ height: 88, borderRadius: 14, backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }} />
        <View style={{ height: 88, borderRadius: 14, backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }} />
      </View>
    </View>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MenuCartScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const itemCount = useOrderFlowCartItemCount()
  const clearCart = useOrderFlowStore((s) => s.clearCart)
  const scrollY = useSharedValue(0)
  const { t } = useTranslation('menu')
  const [contentReady, setContentReady] = useState(false)
  const [clearSheetVisible, setClearSheetVisible] = useState(false)

  const showContent = useCallback(() => setContentReady(true), [])
  useRunAfterTransition(showContent, [], { androidDelayMs: 40 })

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/menu')
  }, [router])

  const handleOpenClearSheet = useCallback(() => setClearSheetVisible(true), [])
  const handleCloseClearSheet = useCallback(() => setClearSheetVisible(false), [])
  const handleConfirmClear = useCallback(() => {
    clearCart()
  }, [clearCart])

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? colors.background.dark : colors.background.light }}>
      <Stack.Screen options={{ statusBarStyle: isDark ? 'light' : 'dark' }} />

      {contentReady ? (
        <>
          <Suspense fallback={<View style={{ flex: 1 }} pointerEvents="none" />}>
            <CartContent scrollY={scrollY} />
          </Suspense>
          <FloatingHeader
            title={`${t('cart.title')}${itemCount > 0 ? ` (${itemCount})` : ''}`}
            onBack={handleBack}
            disableBlur
            rightElement={
              <CartClearBtn
                itemCount={itemCount}
                onClearAll={handleOpenClearSheet}
              />
            }
          />
        </>
      ) : (
        <CartShell onBack={handleBack} isDark={isDark} />
      )}

      <ClearCartSheet
        visible={clearSheetVisible}
        onClose={handleCloseClearSheet}
        onConfirm={handleConfirmClear}
        isDark={isDark}
      />
    </View>
  )
}
