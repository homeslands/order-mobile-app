import React from 'react'
import { Text, View } from 'react-native'

interface InfoCardProps {
  icon: React.ComponentType<{
    size: number
    color: string
  }>
  label: string
  value: string
  iconColor?: string
}

export default function InfoCard({
  icon: Icon,
  label,
  value,
  iconColor = '#e50914',
}: InfoCardProps) {
  return (
    <View className="mb-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
      <View className="mb-2 flex-row items-center">
        <View className="mr-3 rounded-lg bg-red-50 p-2 dark:bg-primary/20">
          <Icon size={20} color={iconColor} />
        </View>

        <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {label}
        </Text>
      </View>

      <Text className="ml-12 text-base font-semibold text-gray-900 dark:text-white">
        {value}
      </Text>
    </View>
  )
}
