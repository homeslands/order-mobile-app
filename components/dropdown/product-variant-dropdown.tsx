import { Check, ChevronDown } from 'lucide-react-native'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, TouchableOpacity, useColorScheme, View } from 'react-native'

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui'
import { cn } from '@/lib/utils'
import { IProductVariant } from '@/types'

interface ProductVariantDropdownProps {
  defaultValue?: string
  variant: IProductVariant[]
  onChange: (value: string) => void
}

export default function ProductVariantDropdown({
  variant,
  defaultValue,
  onChange,
}: ProductVariantDropdownProps) {
  const { t } = useTranslation('product')
  const isDark = useColorScheme() === 'dark'

  // Map variants to dropdown options
  const variantOptions = useMemo(() => {
    return variant.map((item) => ({
      slug: item.slug || '',
      name: item.size.name?.[0]?.toUpperCase() + item.size.name?.slice(1) || '',
    }))
  }, [variant])

  // Get selected value - use defaultValue, or first variant's slug
  const selectedValue = useMemo(() => {
    if (defaultValue) {
      return defaultValue
    }
    if (variant.length > 0 && variant[0].slug) {
      return variant[0].slug
    }
    return null
  }, [defaultValue, variant])

  // Get selected variant name for display
  const selectedVariant = useMemo(() => {
    return variantOptions.find((item) => item.slug === selectedValue)
  }, [variantOptions, selectedValue])

  const handleSelectChange = (selectedSlug: string) => {
    onChange(selectedSlug)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <View className="self-start">
          <TouchableOpacity
            className={cn(
              'flex-row items-center gap-2 px-3 py-2 rounded-md',
              'bg-transparent',
              'border border-gray-200 dark:border-gray-700',
              'active:bg-gray-100/50 dark:active:bg-gray-800/50'
            )}
          >
          <ChevronDown size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
          {selectedVariant ? (
            <Text
              className="text-sm font-medium text-gray-900 dark:text-gray-50"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {selectedVariant.name}
            </Text>
          ) : (
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {t('productVariant.selectProductVariantSize', 'Chọn kích thước phân loại')}
            </Text>
          )}
          </TouchableOpacity>
        </View>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-fit" align="start" sideOffset={8}>
        <View className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            {t('productVariant.selectProductVariantSize', 'Chọn kích thước phân loại')}
          </Text>
        </View>
        <View className="max-h-[300px]">
          {variantOptions.length > 0 ? (
            variantOptions.map((item, index) => {
              const isSelected = selectedValue === item.slug
              const isLast = index === variantOptions.length - 1
              return (
                <TouchableOpacity
                  key={item.slug}
                  onPress={() => handleSelectChange(item.slug)}
                  className={cn(
                    'px-4 py-3 flex-row items-center gap-3',
                    !isLast && 'border-b border-gray-100 dark:border-gray-800',
                    isSelected && 'bg-gray-50 dark:bg-gray-800/50',
                    'active:bg-gray-100 dark:active:bg-gray-700'
                  )}
                >
                  <View className="flex-1">
                    <Text
                      className={cn(
                        'text-sm font-medium',
                        isSelected
                          ? 'text-primary dark:text-primary'
                          : 'text-gray-900 dark:text-gray-50'
                      )}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>
                  {isSelected && (
                    <Check size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                  )}
                </TouchableOpacity>
              )
            })
          ) : (
            <View className="px-4 py-8 items-center">
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {t('productVariant.noVariants', 'Không có biến thể nào')}
              </Text>
            </View>
          )}
        </View>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
