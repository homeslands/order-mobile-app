/**
 * Trạng thái lỗi tải dữ liệu, dùng chung cho các danh sách / số dư.
 *
 * Mất mạng hay hết thời gian chờ không có mã lỗi từ server nên toast toàn cục
 * không hiện (lib/global-error-gate.ts). Không có màn này thì danh sách rỗng
 * trông y như "chưa có gì" — khách tưởng mất đơn, mất tiền.
 */
import { WifiOff } from 'lucide-react-native'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native'

import { Text } from '@/components/ui/text'
import { colors } from '@/constants'

/** Chỉ che bằng màn lỗi khi chưa có dữ liệu nào để xem. */
export function shouldShowQueryError({
  isError,
  hasData,
}: {
  isError: boolean
  hasData: boolean
}): boolean {
  return isError && !hasData
}

/** Số chưa tải được hiện "—" thay vì 0 giả. */
export function formatLoadedValue(
  value: number | undefined,
  format: (n: number) => string,
): string {
  return value === undefined ? '—' : format(value)
}

export const QueryErrorState = memo(function QueryErrorState({
  onRetry,
}: {
  onRetry: () => void
}) {
  const { t } = useTranslation('common')
  const isDark = useColorScheme() === 'dark'
  const primary = isDark ? colors.primary.dark : colors.primary.light

  return (
    <View style={s.wrap}>
      <WifiOff size={48} color={isDark ? colors.gray[600] : colors.gray[400]} />
      <Text
        style={[
          s.title,
          { color: isDark ? colors.gray[50] : colors.gray[900] },
        ]}
      >
        {t('common.loadError.title')}
      </Text>
      <Text
        style={[
          s.desc,
          {
            color: isDark
              ? colors.mutedForeground.dark
              : colors.mutedForeground.light,
          },
        ]}
      >
        {t('common.loadError.description')}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        hitSlop={8}
        style={[s.btn, { borderColor: primary }]}
      >
        <Text style={[s.btnText, { color: primary }]}>
          {t('common.loadError.retry')}
        </Text>
      </Pressable>
    </View>
  )
})

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '600' },
})
