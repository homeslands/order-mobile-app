import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'

import { colors } from '@/constants'
import { usePickupTimeForUpdateOrder } from '@/hooks/use-pickup-time-for-update-order'

const PICKUP_TIME_OPTIONS = [0, 5, 10, 15, 30, 45, 60] as const

interface PickupTimeChipsInUpdateOrderProps {
  isDark: boolean
  primaryColor: string
}

export const PickupTimeChipsInUpdateOrder = memo(
  function PickupTimeChipsInUpdateOrder({
    isDark,
    primaryColor,
  }: PickupTimeChipsInUpdateOrderProps) {
    const { t } = useTranslation('menu')
    const { shouldRender, selectedValue, handleChange } =
      usePickupTimeForUpdateOrder()

    const getLabel = useCallback(
      (minutes: number) =>
        minutes === 0
          ? t('menu.immediately')
          : `${minutes} ${t('menu.minutes')}`,
      [t],
    )

    if (!shouldRender) return null

    const unselectedBorder = isDark ? colors.gray[700] : colors.gray[200]
    const unselectedText = isDark ? colors.gray[400] : colors.gray[500]

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
      >
        {PICKUP_TIME_OPTIONS.map((minutes) => {
          const isSelected = selectedValue === minutes.toString()
          return (
            <Pressable
              key={minutes}
              onPress={() => handleChange(minutes.toString())}
              style={[
                s.chip,
                isSelected
                  ? { backgroundColor: primaryColor, borderColor: primaryColor }
                  : {
                      backgroundColor: 'transparent',
                      borderColor: unselectedBorder,
                    },
              ]}
            >
              <Text
                style={[
                  s.chipText,
                  { color: isSelected ? colors.white.light : unselectedText },
                ]}
              >
                {getLabel(minutes)}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    )
  },
)

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
})
