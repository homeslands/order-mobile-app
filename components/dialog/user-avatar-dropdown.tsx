import { LogOut, User } from 'lucide-react-native'
import React from 'react'
import { Image } from 'expo-image'
import { Text, TouchableOpacity, View } from 'react-native'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui'
import { colors } from '@/constants'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface UserAvatarDropdownProps {
  userInfo: {
    firstName?: string
    lastName?: string
    image?: string
  } | null
  onLogoutPress: () => void
  onLoginPress?: () => void
}

/**
 * UserAvatarDropdown Component
 * 
 * Displays user avatar with dropdown menu for user actions.
 * Uses DropdownMenu for smooth animations matching branch select.
 * 
 * @example
 * ```tsx
 * <UserAvatarDropdown 
 *   userInfo={userInfo}
 *   onLogoutPress={handleLogout}
 * />
 * ```
 */
export default function UserAvatarDropdown({
  userInfo,
  onLogoutPress,
  onLoginPress,
}: UserAvatarDropdownProps) {
  const {t} = useTranslation('auth')
  const getInitials = () => {
    if (!userInfo) return 'U'
    const first = userInfo.firstName?.charAt(0) || ''
    const last = userInfo.lastName?.charAt(0) || ''
    return `${first}${last}`.toUpperCase() || 'U'
  }

  const getUserFullName = () => {
    if (!userInfo) return 'User'
    return `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'User'
  }

  // Nếu chưa đăng nhập, hiển thị nút đăng nhập
  if (!userInfo) {
    return (
      <TouchableOpacity
        onPress={onLoginPress}
        className={cn(
          'px-3 py-1.5 rounded-full',
          'bg-primary/10 dark:bg-primary/20',
          'border border-primary/30 dark:border-primary/40',
          'flex-row items-center gap-1.5',
          'active:opacity-80'
        )}
      >
        <User size={16} color={colors.primary.light} />
        <Text className="text-primary text-sm font-medium">
          {t('login.title')}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TouchableOpacity
          className={cn(
            'w-10 h-10 rounded-full overflow-hidden',
            'bg-gray-300 dark:bg-gray-600',
            'items-center justify-center',
            'active:opacity-80'
          )}
        >
          {userInfo.image ? (
            <Image
              source={userInfo.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              className="w-full h-full"
            />
          ) : (
            <Text className="text-gray-700 dark:text-gray-200 font-semibold text-base">
              {getInitials()}
            </Text>
          )}
        </TouchableOpacity>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
        <View className="px-3 py-2">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full overflow-hidden bg-gray-300 dark:bg-gray-600 items-center justify-center">
              {userInfo.image ? (
                <Image
                  source={userInfo.image}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  className="w-full h-full"
                />
              ) : (
                <Text className="text-gray-700 dark:text-gray-200 font-semibold text-base">
                  {getInitials()}
                </Text>
              )}
            </View>
            <View className="flex-1">
              <Text
                className="text-sm font-semibold text-gray-900 dark:text-gray-50"
                numberOfLines={1}
              >
                {getUserFullName()}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Tài khoản
              </Text>
            </View>
          </View>
        </View>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogoutPress}>
          <View className="flex-row items-center gap-3">
            <LogOut size={18} color="#ef4444" />
            <Text className="text-red-600 dark:text-red-400 font-medium text-sm">
              Đăng xuất
            </Text>
          </View>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

