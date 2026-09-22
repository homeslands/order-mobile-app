/**
 * Một dòng trong các thẻ danh sách của màn Tài khoản và màn Cài đặt.
 *
 * Tách ra khỏi app/(tabs)/profile/index.tsx khi màn Cài đặt ra đời — hai màn
 * dùng chung đúng dòng này, kể cả các style của thẻ bọc ngoài
 * (`profileCardStyles`), nên gom một chỗ để hai màn không trôi lệch nhau.
 */
import { ChevronRight } from 'lucide-react-native'
import React from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import { Text } from '@/components/ui/text'

export interface ProfileMenuItemProps {
  icon: React.ElementType
  iconColor: string
  title: string
  value?: string
  onPress?: () => void
  textColor: string
  textMuted: string
  variant?: 'primary' | 'default'
  primaryColor?: string
}

export const ProfileMenuItem = React.memo(function ProfileMenuItem({
  icon: Icon,
  iconColor,
  title,
  value,
  onPress,
  textColor,
  textMuted,
  variant = 'default',
  primaryColor,
}: ProfileMenuItemProps) {
  const isPrimary = variant === 'primary'
  const titleColor = isPrimary ? (primaryColor ?? textColor) : textColor
  const iconColorFinal = isPrimary ? (primaryColor ?? iconColor) : iconColor

  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.7}>
      {isPrimary ? (
        <View style={s.menuIconBare}>
          <Icon size={24} color={iconColorFinal} />
        </View>
      ) : (
        <View style={[s.menuIconWrap, { backgroundColor: iconColor }]}>
          <Icon size={18} color="#ffffff" />
        </View>
      )}
      <Text style={[s.menuTitle, s.menuTitleThin, { color: titleColor }]}>
        {title}
      </Text>
      {value ? (
        <Text style={[s.menuValue, { color: textMuted }]}>{value}</Text>
      ) : null}
      {!isPrimary && <ChevronRight size={20} color={textMuted} />}
    </TouchableOpacity>
  )
})

const s = StyleSheet.create({
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuIconBare: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
  },
  menuTitleThin: {
    fontWeight: '400',
  },
  menuValue: {
    fontSize: 15,
    marginRight: 8,
  },
})

/** Thẻ bọc và đường kẻ giữa các dòng — dùng chung cho Tài khoản và Cài đặt. */
export const profileCardStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 46,
  },
})
