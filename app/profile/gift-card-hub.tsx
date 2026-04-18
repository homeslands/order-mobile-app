/**
 * Gift Card & Coin Hub — tổng quan xu và thẻ quà tặng.
 * Route: /profile/gift-card-hub
 *
 * Layout: gradient full-bleed (status bar) → số xu căn giữa
 *         → card trắng/tối bo góc trên phủ lên gradient
 *         → 2 section menu: Xu / Thẻ quà tặng
 */
import {
  ChevronRight,
  Coins,
  Eye,
  EyeOff,
  Gift,
  History,
  ShoppingBag,
  Ticket,
  Wallet,
} from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { useCoinBalance } from '@/hooks/use-coin-balance'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useRunAfterTransition } from '@/hooks/use-run-after-transition'
import { navigateNative } from '@/lib/navigation'
import { formatPoints } from '@/utils'

// ─── Gradient height (header zone) ───────────────────────────────────────────

const HERO_HEIGHT = 260

// ─── Section menu ─────────────────────────────────────────────────────────────

interface MenuItem {
  key: string
  label: string
  icon: typeof Gift
  iconColor: string
  route: string
}

interface MenuSection {
  key: string
  title: string
  items: MenuItem[]
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function GiftCardHubScreen() {
  const { t } = useTranslation('giftCard')
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const insets = useSafeAreaInsets()

  const SECTIONS: MenuSection[] = useMemo(
    () => [
      {
        key: 'coin',
        title: t('hub.sectionCoin'),
        items: [
          {
            key: 'coin-history',
            label: t('hub.coinHistory'),
            icon: Wallet,
            iconColor: '#7C3AED',
            route: '/profile/coin-hub',
          },
        ],
      },
      {
        key: 'gift-card',
        title: t('hub.sectionGiftCard'),
        items: [
          {
            key: 'my-cards',
            label: t('hub.myCards'),
            icon: Gift,
            iconColor: '#4CAF50',
            route: '/profile/gift-cards',
          },
          {
            key: 'redeem',
            label: t('hub.useCard'),
            icon: Ticket,
            iconColor: '#5DA8E8',
            route: '/gift-card/redeem',
          },
          {
            key: 'buy',
            label: t('hub.buy'),
            icon: ShoppingBag,
            iconColor: '#F5A623',
            route: '/(tabs)/gift-card',
          },
          {
            key: 'orders',
            label: t('hub.orderHistory'),
            icon: History,
            iconColor: '#E85D5D',
            route: '/profile/gift-card-orders',
          },
        ],
      },
    ],
    [t],
  )

  const [ready, setReady] = useState(false)
  const [balanceVisible, setBalanceVisible] = useState(true)

  useRunAfterTransition(() => setReady(true), [])

  const { balance, isLoading } = useCoinBalance(ready)

  const bg = isDark ? colors.background.dark : colors.background.light
  const cardBg = isDark ? '#2B3B4C' : '#ffffff'
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? '#8B9BB2' : colors.gray[500]
  const divColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const sectionLabelColor = isDark ? colors.gray[400] : colors.gray[500]

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      {/* ── Solid hero background ────────────────────────────────────────── */}
      <View
        style={[
          s.heroBg,
          { height: HERO_HEIGHT, backgroundColor: primaryColor },
        ]}
      />

      {/* ── Back button ─────────────────────────────────────────────────── */}
      <Pressable
        onPress={navigateNative.back}
        hitSlop={12}
        style={[s.backBtn, { top: STATIC_TOP_INSET + 8 }]}
      >
        <ChevronRight
          size={20}
          color={colors.white.light}
          style={{ transform: [{ rotate: '180deg' }] }}
        />
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* ── Balance zone ────────────────────────────────────────────────── */}
        <View
          style={[
            s.heroZone,
            { height: HERO_HEIGHT, paddingTop: STATIC_TOP_INSET + 44 },
          ]}
        >
          <Text style={s.screenTitle}>{t('hub.title')}</Text>
          <Text style={s.balanceLabelText}>{t('hub.balance')}</Text>

          <View style={s.balanceRow}>
            <Coins size={22} color="rgba(255,255,255,0.8)" />
            {isLoading ? (
              <View style={s.balanceSkeleton} />
            ) : (
              <Text style={s.balanceValue}>
                {balanceVisible ? formatPoints(balance) : '••••••'}
              </Text>
            )}
            <Pressable
              onPress={() => setBalanceVisible((v) => !v)}
              hitSlop={12}
            >
              {balanceVisible ? (
                <EyeOff size={20} color="rgba(255,255,255,0.7)" />
              ) : (
                <Eye size={20} color="rgba(255,255,255,0.7)" />
              )}
            </Pressable>
          </View>
        </View>

        {/* ── Bottom card — bo góc trên, phủ lên gradient ─────────────────── */}
        <View style={[s.bottomCard, { backgroundColor: bg }]}>
          {SECTIONS.map((section) => (
            <View key={section.key} style={s.section}>
              <Text style={[s.sectionLabel, { color: sectionLabelColor }]}>
                {section.title}
              </Text>
              <View style={[s.menuCard, { backgroundColor: cardBg }]}>
                {section.items.map((item, i) => {
                  const Icon = item.icon
                  const isLast = i === section.items.length - 1
                  return (
                    <View key={item.key}>
                      <TouchableOpacity
                        style={s.menuItem}
                        onPress={() =>
                          navigateNative.push(
                            item.route as Parameters<
                              typeof navigateNative.push
                            >[0],
                          )
                        }
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            s.menuIconWrap,
                            { backgroundColor: item.iconColor },
                          ]}
                        >
                          <Icon size={18} color="#ffffff" />
                        </View>
                        <Text style={[s.menuTitle, { color: textColor }]}>
                          {item.label}
                        </Text>
                        <ChevronRight size={20} color={subColor} />
                      </TouchableOpacity>
                      {!isLast && (
                        <View
                          style={[s.menuDivider, { backgroundColor: divColor }]}
                        />
                      )}
                    </View>
                  )
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },

  heroBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },

  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero / balance zone
  heroZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 4,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white.light,
    marginBottom: 12,
  },
  balanceLabelText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    textAlign: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  balanceValue: {
    fontSize: 46,
    fontWeight: '800',
    color: colors.white.light,
    letterSpacing: -1,
  },
  balanceSkeleton: {
    height: 52,
    width: 160,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Bottom card
  bottomCard: {
    paddingTop: 8,
    minHeight: 300,
    gap: 4,
  },

  // Section
  section: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  // Menu card
  menuCard: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuTitle: { flex: 1, fontSize: 16, fontWeight: '400' },
  menuDivider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
})
