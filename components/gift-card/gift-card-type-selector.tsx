import { Lock, UserRound, Users, ShoppingBag } from 'lucide-react-native'
import { memo, useCallback } from 'react'
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { colors } from '@/constants'
import { GiftCardType } from '@/constants/gift-card.constant'

interface TypeOptionProps {
  value: GiftCardType.SELF | GiftCardType.GIFT | GiftCardType.BUY
  selected: boolean
  primaryColor: string
  label: string
  description: string
  icon: React.ReactNode
  disabled?: boolean
  onSelect: (
    value: GiftCardType.SELF | GiftCardType.GIFT | GiftCardType.BUY,
  ) => void
}

const TypeOption = memo(function TypeOption({
  value,
  selected,
  primaryColor,
  label,
  description,
  icon,
  disabled,
  onSelect,
}: TypeOptionProps) {
  const isDark = useColorScheme() === 'dark'
  const handlePress = useCallback(() => onSelect(value), [value, onSelect])

  const borderColor = selected
    ? primaryColor
    : isDark
      ? colors.gray[700]
      : colors.gray[200]
  const bgColor = selected
    ? `${primaryColor}12`
    : isDark
      ? colors.gray[900]
      : colors.white.light
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]

  return (
    <Pressable
      onPress={disabled ? undefined : handlePress}
      style={[
        s.option,
        { borderColor, backgroundColor: bgColor },
        disabled && s.optionDisabled,
      ]}
    >
      <View
        style={[
          s.iconWrap,
          {
            backgroundColor: selected
              ? `${primaryColor}20`
              : isDark
                ? colors.gray[800]
                : colors.gray[100],
          },
        ]}
      >
        {icon}
      </View>
      <View style={s.optionText}>
        <Text style={[s.optionLabel, { color: textColor }]}>{label}</Text>
        <Text style={[s.optionDesc, { color: subColor }]}>{description}</Text>
      </View>
      {disabled ? (
        <Lock size={16} color={isDark ? colors.gray[600] : colors.gray[400]} />
      ) : (
        <View
          style={[
            s.radio,
            { borderColor: selected ? primaryColor : colors.gray[300] },
          ]}
        >
          {selected && (
            <View style={[s.radioDot, { backgroundColor: primaryColor }]} />
          )}
        </View>
      )}
    </Pressable>
  )
})

interface GiftCardTypeSelectorProps {
  value: GiftCardType | null
  primaryColor: string
  availableTypes: (GiftCardType.SELF | GiftCardType.GIFT | GiftCardType.BUY)[]
  onChange: (
    value: GiftCardType.SELF | GiftCardType.GIFT | GiftCardType.BUY,
  ) => void
}

export const GiftCardTypeSelector = memo(function GiftCardTypeSelector({
  value,
  primaryColor,
  availableTypes,
  onChange,
}: GiftCardTypeSelectorProps) {
  const isDark = useColorScheme() === 'dark'
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const { t } = useTranslation('giftCard')

  return (
    <View style={s.container}>
      <Text style={[s.sectionLabel, { color: textColor }]}>
        {t('typeSelector.title')}
      </Text>

      {availableTypes.includes(GiftCardType.SELF) && (
        <TypeOption
          value={GiftCardType.SELF}
          selected={value === GiftCardType.SELF}
          primaryColor={primaryColor}
          label={t('typeSelector.self.label')}
          description={t('typeSelector.self.description')}
          icon={
            <UserRound
              size={20}
              color={
                value === GiftCardType.SELF ? primaryColor : colors.gray[500]
              }
            />
          }
          onSelect={onChange}
        />
      )}

      {availableTypes.includes(GiftCardType.GIFT) && (
        <TypeOption
          value={GiftCardType.GIFT}
          selected={value === GiftCardType.GIFT}
          primaryColor={primaryColor}
          label={t('typeSelector.gift.label')}
          description={t('typeSelector.gift.description')}
          icon={
            <Users
              size={20}
              color={
                value === GiftCardType.GIFT ? primaryColor : colors.gray[500]
              }
            />
          }
          onSelect={onChange}
        />
      )}

      {availableTypes.includes(GiftCardType.BUY) && (
        <TypeOption
          value={GiftCardType.BUY}
          selected={value === GiftCardType.BUY}
          primaryColor={primaryColor}
          label={t('typeSelector.buy.label')}
          description={t('typeSelector.buy.description')}
          icon={
            <ShoppingBag
              size={20}
              color={
                value === GiftCardType.BUY ? primaryColor : colors.gray[500]
              }
            />
          }
          onSelect={onChange}
        />
      )}
    </View>
  )
})

const s = StyleSheet.create({
  container: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  optionDisabled: {
    opacity: 0.45,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
})
