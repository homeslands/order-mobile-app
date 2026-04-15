import type { TFunction } from 'i18next'
import { Gift, Home, Menu, User } from 'lucide-react-native'
import React, { useCallback, useMemo } from 'react'
import { Text, View } from 'react-native'

import { NativeGesturePressable } from './native-gesture-pressable'

const PILL_PADDING = 6

type TabState = {
  isHomeActive: boolean
  isMenuActive: boolean
  isGiftCardActive: boolean
  isProfileActive: boolean
}

type Colors = {
  primary: string
  mutedForeground: string
  background: string
}

type TabRoutes = {
  home: string
  menu: string
  giftCard: string
  profile: string
}

type TabBarPillProps = {
  t: TFunction<'tabs'>
  colors: Colors
  tabState: TabState
  tabRoutes: TabRoutes
}

/**
 * Pill tab bar thuần props → không subscribe store, không re-render khi cart đổi.
 * Chỉ re-render khi parent (Layout) re-render do pathname/theme đổi.
 */
const TabBarPill = React.memo(function TabBarPill({
  t,
  colors,
  tabState,
  tabRoutes,
}: TabBarPillProps) {
  const { primary, mutedForeground, background } = colors
  const getColor = useCallback((active: boolean) => (active ? primary : mutedForeground), [primary, mutedForeground])

  const items = useMemo(
    () => [
      { Icon: Home, active: tabState.isHomeActive, href: tabRoutes.home, label: t('tabs.home', 'Trang chủ') },
      { Icon: Menu, active: tabState.isMenuActive, href: tabRoutes.menu, label: t('tabs.menu', 'Thực đơn') },
      { Icon: Gift, active: tabState.isGiftCardActive, href: tabRoutes.giftCard, label: t('tabs.giftCard', 'Thẻ quà') },
      { Icon: User, active: tabState.isProfileActive, href: tabRoutes.profile, label: t('tabs.profile', 'Tài khoản') },
    ],
    [tabState, tabRoutes, t],
  )

  return (
    <View
      className="rounded-full flex-1 flex-row items-center"
      style={{
        backgroundColor: background,
        paddingHorizontal: PILL_PADDING,
        paddingVertical: 8,
        shadowColor: mutedForeground,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.01,
        shadowRadius: 16,
        elevation: 24,
      }}
    >
      {items.map(({ Icon, active, href, label }) => (
        <NativeGesturePressable
          key={label}
          navigation={{ type: 'replace', href }}
          hapticStyle="light"
          className="flex-1 items-center justify-center py-1"
        >
          <View className="items-center justify-center" style={{ zIndex: 1 }}>
            <Icon color={getColor(active)} size={20} />
          </View>
          <Text className="text-[10px] mt-0.5 font-medium" style={{ color: getColor(active), zIndex: 1 }}>
            {label}
          </Text>
        </NativeGesturePressable>
      ))}
    </View>
  )
})

export { TabBarPill }
export type { TabBarPillProps, TabState, Colors, TabRoutes }
