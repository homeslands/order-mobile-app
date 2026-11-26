/**
 * "Đang xem menu {chi nhánh} · Đổi" — chỉ hiện khi app TỰ chọn chi nhánh
 * (nhiều chi nhánh, lần đầu; xem SelectBranchDropdown). Thay cho việc bật
 * sheet chặn màn: khách thấy menu ngay, vẫn biết đang xem chi nhánh nào và
 * đổi được một chạm. Ẩn khi khách tự chọn chi nhánh hoặc bấm đóng.
 */
import { MapPin, X } from 'lucide-react-native'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native'

import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { useBranchStore } from '@/stores'

export const BranchHint = memo(function BranchHint({
  onChange,
}: {
  /** Mở sheet chọn chi nhánh. */
  onChange: () => void
}) {
  const { t } = useTranslation('menu')
  const isDark = useColorScheme() === 'dark'
  const autoPicked = useBranchStore((s) => s.autoPicked)
  const name = useBranchStore((s) => s.branch?.name)
  const dismiss = useBranchStore((s) => s.dismissBranchHint)

  if (!autoPicked || !name) return null

  const primary = isDark ? colors.primary.dark : colors.primary.light
  const muted = isDark
    ? colors.mutedForeground.dark
    : colors.mutedForeground.light
  const text = isDark ? colors.foreground.dark : colors.foreground.light

  return (
    <View
      style={[
        s.row,
        { backgroundColor: isDark ? colors.card.dark : `${primary}14` },
      ]}
    >
      <MapPin size={16} color={primary} />
      <Text style={[s.label, { color: text }]} numberOfLines={1}>
        {t('menu.viewingBranch', { name })}
      </Text>
      <Pressable onPress={onChange} accessibilityRole="button" hitSlop={10}>
        <Text style={[s.change, { color: primary }]}>
          {t('menu.changeBranch')}
        </Text>
      </Pressable>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={t('menu.dismissBranchHint')}
        hitSlop={12}
        style={s.close}
      >
        <X size={16} color={muted} />
      </Pressable>
    </View>
  )
})

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  label: { flex: 1, fontSize: 13 },
  change: { fontSize: 13, fontWeight: '600' },
  close: { marginLeft: 4 },
})
