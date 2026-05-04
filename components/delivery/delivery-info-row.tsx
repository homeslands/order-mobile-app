import { MapPin } from 'lucide-react-native'
import { memo } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { colors } from '@/constants'

interface DeliveryInfoRowProps {
  address: string
  onPress: () => void
  isDark: boolean
}

export const DeliveryInfoRow = memo(function DeliveryInfoRow({
  address,
  onPress,
  isDark,
}: DeliveryInfoRowProps) {
  const hasAddress = !!address

  return (
    <Pressable
      testID="delivery-info-row"
      onPress={onPress}
      style={[
        styles.row,
        {
          borderColor: hasAddress
            ? isDark ? colors.gray[600] : colors.gray[300]
            : isDark ? colors.primary.dark : colors.primary.light,
          borderStyle: hasAddress ? 'solid' : 'dashed',
          backgroundColor: hasAddress
            ? isDark ? colors.gray[800] : colors.gray[50]
            : isDark ? `${colors.primary.dark}15` : `${colors.primary.light}10`,
        },
      ]}
    >
      <MapPin
        size={14}
        color={isDark ? colors.primary.dark : colors.primary.light}
      />
      <Text
        style={[
          styles.text,
          {
            color: hasAddress
              ? isDark ? colors.gray[100] : colors.gray[800]
              : isDark ? colors.primary.dark : colors.primary.light,
          },
        ]}
        numberOfLines={1}
      >
        {hasAddress ? address : 'Chọn địa chỉ giao hàng'}
      </Text>
      {hasAddress && (
        <Text
          style={[
            styles.editLabel,
            { color: isDark ? colors.primary.dark : colors.primary.light },
          ]}
        >
          Sửa
        </Text>
      )}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderRadius: 8,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
})
