import { colors } from '@/constants'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

type SheetFooterProps = {
  isCurrentApplied: boolean
  isNewSelection: boolean
  onPress: () => void
  isDark: boolean
  primaryColor: string
  bottomInset: number
}

export function SheetFooter({
  isCurrentApplied,
  isNewSelection,
  onPress,
  isDark,
  primaryColor,
  bottomInset,
}: SheetFooterProps) {
  const { t } = useTranslation('voucher')
  return (
    <View style={[styles.footer, { paddingBottom: bottomInset + 4 }]}>
      <Pressable
        onPress={onPress}
        style={[
          styles.footerBtn,
          {
            backgroundColor: isCurrentApplied
              ? colors.destructive.light
              : isNewSelection
                ? primaryColor
                : isDark
                  ? colors.gray[700]
                  : colors.gray[200],
          },
        ]}
      >
        <Text
          style={[
            styles.footerBtnText,
            {
              color:
                isCurrentApplied || isNewSelection
                  ? colors.white.light
                  : isDark
                    ? colors.gray[300]
                    : colors.gray[600],
            },
          ]}
        >
          {isCurrentApplied
            ? t('removeVoucher')
            : isNewSelection
              ? t('applyVoucher')
              : t('close')}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  footerBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: { fontSize: 15, fontWeight: '700' },
})
