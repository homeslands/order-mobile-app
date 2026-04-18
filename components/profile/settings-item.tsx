import { ChevronRight } from 'lucide-react-native'
import React from 'react'
import { Text, View, useColorScheme } from 'react-native'

import { colors } from '@/constants/colors.constant'
import {
  NativeGesturePressable,
  type NativeGesturePressableProps,
} from '@/components/navigation/native-gesture-pressable'

interface SettingsItemProps {
  icon: React.ComponentType<{ size?: number; color?: string }>
  title: string
  subtitle?: string
  subtitleColor?: string
  value?: string
  /** Navigation: push | replace | back — dùng NativeGesturePressable, zero-latency giống Menu */
  navigation?: NativeGesturePressableProps['navigation']
  /** Fallback cho non-navigation actions (logout, etc.) */
  onPress?: () => void
  showChevron?: boolean
  destructive?: boolean
  iconBackgroundColor?: string
}

export function SettingsItem({
  icon: Icon,
  title,
  subtitle,
  subtitleColor,
  value,
  navigation,
  onPress,
  showChevron = true,
  destructive = false,
  iconBackgroundColor,
}: SettingsItemProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const resolvedIconBackground = iconBackgroundColor
    ? iconBackgroundColor
    : destructive
      ? isDark
        ? colors.gray[600]
        : '#fee2e2'
      : isDark
        ? colors.gray[900]
        : colors.gray[600]

  const iconColor = destructive ? colors.destructive.dark : colors.white.light
  const textColor = destructive
    ? colors.destructive.light
    : isDark
      ? colors.white.light
      : '#000000'

  const content = (
    <View className="min-h-[44px] flex-row items-center px-4 py-3">
      <View className="mr-3 h-10 w-10 items-center justify-center">
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: resolvedIconBackground }}
        >
          <Icon size={20} color={iconColor} />
        </View>
      </View>

      <View className="flex-1 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-base" style={{ color: textColor }}>
            {title}
          </Text>
          {subtitle && (
            <Text
              className="mt-0.5 text-sm"
              style={{
                color:
                  subtitleColor ??
                  (isDark ? colors.gray[400] : colors.gray[500]),
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {value && (
          <Text
            className="mr-2 text-sm"
            style={{ color: isDark ? colors.gray[400] : colors.gray[500] }}
          >
            {value}
          </Text>
        )}

        {showChevron && (
          <ChevronRight
            size={20}
            color={
              destructive
                ? colors.destructive.dark
                : isDark
                  ? colors.gray[500]
                  : colors.gray[400]
            }
          />
        )}
      </View>
    </View>
  )

  return (
    <NativeGesturePressable
      navigation={navigation}
      onPress={!navigation ? onPress : undefined}
      className="bg-white dark:bg-gray-800"
    >
      {content}
    </NativeGesturePressable>
  )
}

interface SettingsSectionProps {
  children: React.ReactNode
  header?: string
}

export function SettingsSection({ children, header }: SettingsSectionProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <View className="mb-8">
      {header && (
        <View className="px-4 py-2">
          <Text
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: isDark ? colors.gray[400] : colors.gray[500] }}
          >
            {header}
          </Text>
        </View>
      )}
      <View className="overflow-hidden rounded-2xl bg-white dark:bg-gray-800">
        {React.Children.map(children, (child, index) => {
          if (!React.isValidElement(child)) return child

          return (
            <View key={index}>
              {child}
              {index < React.Children.count(children) - 1 && (
                <View
                  className="ml-16 mr-10 h-px"
                  style={{
                    backgroundColor: isDark
                      ? colors.gray[700]
                      : colors.gray[200],
                    opacity: isDark ? 0.35 : 0.5,
                  }}
                />
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}
