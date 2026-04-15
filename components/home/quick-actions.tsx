/**
 * QuickActions — 3 shortcut pill buttons ngay sau hero banner.
 * Đặt ngay → Menu, Mang về → Menu + takeaway, Quét QR → scan sheet.
 */
import { QrCode, ShoppingBag, Truck } from 'lucide-react-native'
import React, { useCallback, useMemo } from 'react'
import { Pressable, Text, View, useColorScheme } from 'react-native'
import { useRouter } from 'expo-router'

import { colors } from '@/constants'
import { useScanSheetStore } from '@/stores/scan-sheet.store'

interface QuickAction {
  key: string
  icon: React.ReactNode
  label: string
  onPress: () => void
}

export const QuickActions = React.memo(function QuickActions() {
  const isDark = useColorScheme() === 'dark'
  const router = useRouter()
  const openScan = useScanSheetStore((s) => s.open)

  const primaryColor = isDark ? colors.primary.dark : colors.primary.light
  const iconBg = isDark ? 'rgba(214,137,16,0.15)' : 'rgba(247,167,55,0.12)'

  const handleOrderNow = useCallback(() => {
    router.push('/(tabs)/menu' as never)
  }, [router])

  const handleTakeaway = useCallback(() => {
    router.push('/(tabs)/menu' as never)
  }, [router])

  const handleScan = useCallback(() => {
    openScan()
  }, [openScan])

  const actions = useMemo<QuickAction[]>(
    () => [
      {
        key: 'order',
        icon: <ShoppingBag size={20} color={primaryColor} />,
        label: 'Đặt ngay',
        onPress: handleOrderNow,
      },
      {
        key: 'takeaway',
        icon: <Truck size={20} color={primaryColor} />,
        label: 'Mang về',
        onPress: handleTakeaway,
      },
      {
        key: 'scan',
        icon: <QrCode size={20} color={primaryColor} />,
        label: 'Quét QR',
        onPress: handleScan,
      },
    ],
    [primaryColor, handleOrderNow, handleTakeaway, handleScan],
  )

  return (
    <View className="flex-row gap-3 px-4 py-4">
      {actions.map((action) => (
        <Pressable
          key={action.key}
          onPress={action.onPress}
          className="flex-1 items-center gap-2 rounded-2xl py-3"
          style={{ backgroundColor: iconBg }}
        >
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: primaryColor + '22' }}
          >
            {action.icon}
          </View>
          <Text
            className="text-xs font-semibold"
            style={{ color: primaryColor }}
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
})
