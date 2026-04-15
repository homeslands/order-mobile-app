// components/auth/AuthFormLayout.tsx
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { ScreenContainer } from '@/components/layout'
import { colors } from '@/constants'
import { useColorScheme } from 'react-native'

export function AuthFormLayout({
  title,
  description,
  onBack,
  children,
}: {
  title: string
  description?: string
  onBack?: () => void
  children: React.ReactNode
}) {
  const isDark = useColorScheme() === 'dark'
  const iconColor = isDark ? colors.gray[200] : colors.gray[700]

  return (
    <ScreenContainer edges={['top', 'bottom']} className="flex-1 bg-background">
      {onBack && (
        <View className="px-4 pt-2 pb-1">
          <TouchableOpacity
            onPress={onBack}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <ChevronLeft size={24} color={iconColor} />
          </TouchableOpacity>
        </View>
      )}
      <View className={`px-6 ${onBack ? 'pt-2' : 'pt-8'} pb-6`}>
        <Text className="mb-2 text-3xl font-sans-bold text-foreground">
          {title}
        </Text>
        {description && (
          <Text className="mb-8 text-base font-sans text-muted-foreground">
            {description}
          </Text>
        )}
        {children}
      </View>
    </ScreenContainer>
  )
}
