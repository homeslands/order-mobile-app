import { Search, X } from 'lucide-react-native'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TextInput, TouchableOpacity, View } from 'react-native'

import { useDebouncedInput } from '@/hooks'
import { useProductNameFilter, useSetMenuFilter } from '@/stores/selectors'

export default function ProductNameSearch() {
  const productName = useProductNameFilter()
  const setMenuFilter = useSetMenuFilter()
  const { t } = useTranslation('menu')

  const {
    inputValue,
    setInputValue,
    debouncedInputValue,
  } = useDebouncedInput({
    defaultValue: productName || '',
    delay: 500,
  })

  // Sau khi debounce xong thì mới lưu vào store
  useEffect(() => {
    setMenuFilter((prev) => ({
      ...prev,
      productName: debouncedInputValue || undefined,
    }))
  }, [debouncedInputValue, setMenuFilter])

  return (
    <View className="relative w-full">
      {/* Search Icon */}
      <View
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: [{ translateY: -8 }],
          zIndex: 10,
        }}
      >
        <Search size={16} color="#6b7280" />
      </View>

      {/* Text Input */}
      <TextInput
        placeholder={t('menu.searchProduct', 'Tìm kiếm sản phẩm')}
        placeholderTextColor="#9ca3af"
        className="w-full h-[50px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
        value={inputValue}
        onChangeText={setInputValue}
        style={{
          paddingLeft: 36,
          paddingRight: inputValue ? 36 : 12,
          paddingVertical: 0,
          fontSize: 15,
          fontFamily: 'BeVietnamPro_400Regular',
        }}
      />

      {/* Clear Button */}
      {inputValue ? (
        <TouchableOpacity
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: [{ translateY: -8 }],
            zIndex: 10,
          }}
          onPress={() => setInputValue('')}
        >
          <X size={16} color="#6b7280" />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
