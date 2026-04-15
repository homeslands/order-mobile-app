import { Moon, Settings, Sun } from 'lucide-react-native'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Image } from 'expo-image'
import { Text, TouchableOpacity, useColorScheme, View } from 'react-native'

import { Images } from '@/assets/images'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    Select,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { useThemeStore, useUserStore } from '@/stores'

/**
 * SettingsDropdown Component
 * 
 * Displays a settings dropdown with language and theme selection.
 * 
 * @example
 * ```tsx
 * <SettingsDropdown />
 * ```
 */
export default function SettingsDropdown() {
  const { t, i18n: i18nInstance } = useTranslation('setting')
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const userInfo = useUserStore((s) => s.userInfo)
  const setUserInfo = useUserStore((s) => s.setUserInfo)
  const isDark = useColorScheme() === 'dark'

  // Update language when userInfo changes
  useEffect(() => {
    if (userInfo?.language) {
      i18nInstance.changeLanguage(userInfo.language)
    }
  }, [userInfo?.language, i18nInstance])

  const handleUpdateLanguage = (language: string) => {
    // Update i18n immediately
    i18nInstance.changeLanguage(language)

    // If user is logged in, update userInfo
    if (userInfo) {
      setUserInfo({
        ...userInfo,
        language,
      })
      // TODO: Call API to update language on server if needed
      // Example: updateUserLanguage({ userSlug: userInfo.slug, language })
    }
  }

  const handleUpdateTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    // TODO: Apply theme changes if you have a theme provider
  }

  // Get display labels for current selections
  const getLanguageLabel = () => {
    const currentLang = i18nInstance.language || 'vi'
    return currentLang === 'en' ? 'English' : 'Tiếng Việt'
  }

  const getThemeLabel = () => {
    const currentTheme = theme || 'light'
    return currentTheme === 'light' ? t('setting.light', 'Sáng') : t('setting.dark', 'Tối')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TouchableOpacity
          className={cn(
            'w-10 h-10 items-center justify-center rounded-md',
            'bg-transparent',
            'active:bg-gray-100/50 dark:active:bg-gray-800/50'
          )}
        >
          <Settings size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
        </TouchableOpacity>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" sideOffset={8}>
        <View className="px-3 py-2">
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            {t('setting.title', 'Cài đặt')}
          </Text>
        </View>
        <View className="h-px bg-gray-200 dark:bg-gray-700" />

        {/* Language Selection */}
        <View className="px-3 py-3">
          <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            {t('setting.language', 'Ngôn ngữ')}
          </Text>
          <Select
            value={i18nInstance.language || 'vi'}
            onValueChange={handleUpdateLanguage}
          >
            <Select.Trigger className="w-full h-9">
              <Select.Value
                className="text-sm"
                placeholder={t('setting.selectLanguage', 'Chọn ngôn ngữ')}
              >
                {getLanguageLabel()}
              </Select.Value>
            </Select.Trigger>
            <Select.Content noModal>
              <Select.Item value="en">
                <View className="flex-row items-center">
                  <Image
                    source={Images.Flags.US}
                    className="w-4 h-4 mr-2"
                    contentFit="contain"
                  />
                  <Text className="text-xs">English</Text>
                </View>
              </Select.Item>
              <Select.Item value="vi">
                <View className="flex-row items-center">
                  <Image
                    source={Images.Flags.VI}
                    className="w-4 h-4 mr-2"
                    contentFit="contain"
                  />
                  <Text className="text-xs">Tiếng Việt</Text>
                </View>
              </Select.Item>
            </Select.Content>
          </Select>
        </View>

        <View className="h-px bg-gray-200 dark:bg-gray-700" />

        {/* Theme Selection */}
        <View className="px-3 py-3">
          <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            {t('setting.theme', 'Giao diện')}
          </Text>
          <Select
            value={theme || 'light'}
            onValueChange={(value) => handleUpdateTheme(value as 'light' | 'dark')}
          >
            <Select.Trigger className="w-full h-9">
              <Select.Value
                placeholder={t('setting.selectTheme', 'Chọn giao diện')}
              >
                {getThemeLabel()}
              </Select.Value>
            </Select.Trigger>
            <Select.Content noModal>
              <Select.Item value="light">
                <View className="flex-row items-center">
                  <Sun size={16} color="#6b7280" />
                  <Text className="text-xs ml-2">{t('setting.light', 'Sáng')}</Text>
                </View>
              </Select.Item>
              <Select.Item value="dark">
                <View className="flex-row items-center">
                  <Moon size={16} color="#6b7280" />
                  <Text className="text-xs ml-2">{t('setting.dark', 'Tối')}</Text>
                </View>
              </Select.Item>
            </Select.Content>
          </Select>
        </View>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

