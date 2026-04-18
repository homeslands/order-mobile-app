import { colors } from '@/constants'
import { ShoppingCart } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

export function CartEmpty({
  isDark,
  onBrowse,
  browseLabel,
  emptyText,
}: {
  isDark: boolean
  onBrowse: () => void
  browseLabel: string
  emptyText: string
}) {
  return (
    <View style={emptyStyles.container}>
      <ShoppingCart
        size={48}
        color={isDark ? colors.gray[600] : colors.gray[300]}
      />
      <Text
        style={[
          emptyStyles.text,
          { color: isDark ? colors.gray[500] : colors.gray[400] },
        ]}
      >
        {emptyText}
      </Text>
      <Pressable onPress={onBrowse} style={emptyStyles.btn}>
        <Text style={emptyStyles.btnText}>{browseLabel}</Text>
      </Pressable>
    </View>
  )
}

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 80,
  },
  text: {
    fontSize: 15,
    fontWeight: '500',
  },
  btn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.white.light,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[700],
  },
})
