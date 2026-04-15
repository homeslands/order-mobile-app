import { ChevronDown } from 'lucide-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View, useColorScheme } from 'react-native'
import { Dropdown } from 'react-native-element-dropdown'

import { colors } from '@/constants'
import { useOrderTypeOptions, type OrderTypeOption } from '@/hooks'

export default function OrderTypeDropdown() {
  const { t } = useTranslation('menu')
  const [isFocus, setIsFocus] = useState(false)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const { orderTypes, selectedType, handleChange } = useOrderTypeOptions()

  const handleDropdownChange = (item: OrderTypeOption) => {
    handleChange(item.value)
    setIsFocus(false)
  }

  const renderLabel = () => {
    if (selectedType?.value || isFocus) {
      return (
        <Text
          className={`absolute left-3 top-2 z-10 px-2 text-xs ${
            isFocus ? 'text-blue-500' : 'text-gray-600 dark:text-gray-400'
          }`}
          style={{
            backgroundColor: isDark ? colors.gray[900] : colors.white.light,
          }}
        >
          {t('menu.selectOrderType')}
        </Text>
      )
    }
    return null
  }

  return (
    <View className="bg-white dark:bg-gray-800 p-4">
      {renderLabel()}
      <Dropdown
        style={{
          height: 50,
          borderColor: isFocus
            ? '#3b82f6'
            : isDark
              ? colors.gray[700]
              : colors.gray[300],
          borderWidth: 0.5,
          borderRadius: 8,
          paddingHorizontal: 8,
          backgroundColor: isDark ? colors.gray[800] : colors.white.light,
        }}
        placeholderStyle={{
          fontSize: 16,
          color: isDark ? colors.gray[400] : colors.gray[500],
        }}
        selectedTextStyle={{
          fontSize: 16,
          color: isDark ? colors.white.light : colors.gray[900],
        }}
        inputSearchStyle={{
          height: 40,
          fontSize: 16,
          backgroundColor: isDark ? colors.gray[800] : colors.white.light,
          color: isDark ? colors.white.light : colors.gray[900],
          borderRadius: 8,
        }}
        iconStyle={{
          width: 20,
          height: 20,
        }}
        data={orderTypes}
        search={false}
        maxHeight={300}
        labelField="label"
        valueField="value"
        placeholder={t('menu.selectOrderType')}
        value={selectedType?.value || null}
        onFocus={() => setIsFocus(true)}
        onBlur={() => setIsFocus(false)}
        onChange={handleDropdownChange}
        renderLeftIcon={() => (
          <View className="mr-2">
            <ChevronDown
              size={20}
              color={
                isFocus
                  ? '#3b82f6'
                  : isDark
                    ? colors.gray[400]
                    : colors.gray[500]
              }
            />
          </View>
        )}
        containerStyle={{
          backgroundColor: isDark ? colors.gray[800] : colors.white.light,
        }}
        itemTextStyle={{
          color: isDark ? colors.white.light : colors.gray[900],
        }}
        activeColor={isDark ? colors.gray[700] : colors.gray[100]}
      />
    </View>
  )
}
