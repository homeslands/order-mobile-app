import { colors } from '@/constants'
import { BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { Search, Ticket } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

type SearchHeaderProps = {
  code: string
  onChangeCode: (v: string) => void
  onSearch: () => void
  isDark: boolean
  primaryColor: string
}

export function SearchHeader({
  code,
  onChangeCode,
  onSearch,
  isDark,
  primaryColor,
}: SearchHeaderProps) {
  return (
    <View style={styles.fixedHeader}>
      <Text
        style={[
          styles.title,
          { color: isDark ? colors.gray[50] : colors.gray[900] },
        ]}
      >
        Mã giảm giá
      </Text>
      <View style={styles.inputRow}>
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] },
          ]}
        >
          <Ticket
            size={20}
            color={isDark ? colors.gray[400] : colors.gray[500]}
          />
          <BottomSheetTextInput
            value={code}
            onChangeText={onChangeCode}
            placeholder="Nhập mã voucher"
            placeholderTextColor={isDark ? colors.gray[600] : colors.gray[400]}
            autoCapitalize="sentences"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={onSearch}
            style={[
              styles.input,
              { color: isDark ? colors.gray[50] : colors.gray[900] },
            ]}
          />
        </View>
        <Pressable
          onPress={onSearch}
          disabled={!code.trim()}
          style={[
            styles.searchBtn,
            {
              backgroundColor: code.trim()
                ? primaryColor
                : isDark
                  ? colors.gray[700]
                  : colors.gray[200],
            },
          ]}
        >
          <Search
            size={18}
            color={
              code.trim()
                ? colors.white.light
                : isDark
                  ? colors.gray[500]
                  : colors.gray[400]
            }
          />
        </Pressable>
      </View>
      <Text
        style={[
          styles.note,
          { color: isDark ? colors.gray[400] : colors.gray[500] },
        ]}
      >
        Áp dụng tối đa 1 mã / đơn hàng
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  fixedHeader: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[300],
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.5,
    padding: 0,
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { fontSize: 12, fontStyle: 'italic', marginTop: 8 },
})
