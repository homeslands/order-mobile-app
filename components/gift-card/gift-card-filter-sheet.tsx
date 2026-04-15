/**
 * Gift card filter bottom sheet.
 * Pattern: Modal + GestureHandlerRootView + BottomSheet (same as price-sheet).
 *
 * Filters:
 *   - Trạng thái: Tất cả / Khả dụng / Đã dùng / Hết hạn
 *   - Từ ngày / Đến ngày: react-native-date-picker modal (scroll picker)
 *
 * Local state only — committed to parent via onApply.
 * Re-mounts each open (parent renders null when !visible) → reads value prop fresh.
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import dayjs from 'dayjs'
import { ArrowRight, CalendarDays, X } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import DatePicker from 'react-native-date-picker'
import {
  TouchableOpacity as GHTouchable,
} from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, GiftCardUsageStatus } from '@/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GiftCardFilter {
  status: GiftCardUsageStatus | null // null = tất cả
  fromDate: Date | null
  toDate: Date | null
}

export const DEFAULT_GIFT_CARD_FILTER: GiftCardFilter = {
  status: null,
  fromDate: null,
  toDate: null,
}

export function isFilterActive(f: GiftCardFilter): boolean {
  return f.status !== null || f.fromDate !== null || f.toDate !== null
}

// ─── Constants ────────────────────────────────────────────────────────────────


const SNAP_POINTS = ['55%']

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  value: GiftCardFilter
  onClose: () => void
  onApply: (v: GiftCardFilter) => void
  primaryColor: string
  isDark: boolean
}

export const GiftCardFilterSheet = memo(function GiftCardFilterSheet({
  visible,
  value,
  onClose,
  onApply,
  primaryColor,
  isDark,
}: Props) {
  const insets = useSafeAreaInsets()
  const sheetRef = useRef<BottomSheetModal>(null)

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])
  const { t } = useTranslation('giftCard')
  const { t: tCommon } = useTranslation('common')

  const STATUS_OPTIONS = useMemo(() => [
    { label: tCommon('common.all'), value: null },
    { label: t('status.available'), value: GiftCardUsageStatus.AVAILABLE },
    { label: t('status.used'), value: GiftCardUsageStatus.USED },
    { label: t('status.expired'), value: GiftCardUsageStatus.EXPIRED },
  ], [t, tCommon])

  // Local state — initialized from value on mount (sheet remounts each open)
  const [localStatus, setLocalStatus] = useState<GiftCardUsageStatus | null>(value.status)
  const [localFromDate, setLocalFromDate] = useState<Date | null>(value.fromDate)
  const [localToDate, setLocalToDate] = useState<Date | null>(value.toDate)

  const [fromPickerOpen, setFromPickerOpen] = useState(false)
  const [toPickerOpen, setToPickerOpen] = useState(false)

  const bg = isDark ? colors.gray[900] : colors.white.light
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const chipBg = isDark ? colors.gray[800] : colors.gray[100]
  const dateBg = isDark ? colors.gray[800] : colors.gray[50]
  const dateBorder = isDark ? colors.gray[700] : colors.gray[200]

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  )

  const handleApply = useCallback(() => {
    onApply({ status: localStatus, fromDate: localFromDate, toDate: localToDate })
    sheetRef.current?.dismiss()
  }, [localStatus, localFromDate, localToDate, onApply])

  const handleReset = useCallback(() => {
    onApply(DEFAULT_GIFT_CARD_FILTER)
    sheetRef.current?.dismiss()
  }, [onApply])

  return (
        <BottomSheetModal
          ref={sheetRef}
          snapPoints={SNAP_POINTS}
          enablePanDownToClose
          enableDynamicSizing={false}
          enableContentPanningGesture={false}
          enableHandlePanningGesture
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: bg }}
          handleIndicatorStyle={{ backgroundColor: isDark ? colors.gray[600] : colors.gray[300] }}
          onDismiss={onClose}
        >
          <View style={[fs.content, { paddingBottom: insets.bottom + 16 }]}>

            {/* ── Top group ──────────────────────────────────────────────── */}
            <View>
              <Text style={[fs.title, { color: textColor }]}>{t('filter.title')}</Text>

              {/* Status */}
              <Text style={[fs.sectionLabel, { color: subColor }]}>{t('filter.statusLabel')}</Text>
              <View style={fs.chipRow}>
                {STATUS_OPTIONS.map((opt) => {
                  const active = localStatus === opt.value
                  return (
                    <View key={String(opt.value)} style={fs.chipWrap}>
                      <GHTouchable
                        onPress={() => setLocalStatus(opt.value)}
                        activeOpacity={0.7}
                        style={[
                          fs.chip,
                          { backgroundColor: active ? primaryColor : chipBg },
                        ]}
                      >
                        <Text style={[
                          fs.chipText,
                          {
                            color: active
                              ? colors.white.light
                              : isDark ? colors.gray[300] : colors.gray[700],
                            fontWeight: active ? '700' : '500',
                          },
                        ]}>
                          {opt.label}
                        </Text>
                      </GHTouchable>
                    </View>
                  )
                })}
              </View>

              {/* Divider */}
              <View style={[fs.divider, { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }]} />

              {/* Date range */}
              <Text style={[fs.sectionLabel, { color: subColor }]}>{t('filter.dateRange')}</Text>

              <View style={fs.dateRangeRow}>
                {/* From */}
                <View style={fs.datePickerWrap}>
                  <GHTouchable
                    onPress={() => setFromPickerOpen(true)}
                    activeOpacity={0.7}
                    style={[fs.datePicker, { backgroundColor: dateBg, borderColor: localFromDate ? primaryColor : dateBorder }]}
                  >
                    <CalendarDays size={13} color={localFromDate ? primaryColor : subColor} />
                    <View style={fs.datePickerText}>
                      <Text style={[fs.datePickerHint, { color: subColor }]}>{t('filter.fromDate')}</Text>
                      <Text style={[fs.datePickerVal, { color: localFromDate ? textColor : subColor }]}>
                        {localFromDate ? dayjs(localFromDate).format('DD/MM/YYYY') : '––/––/––––'}
                      </Text>
                    </View>
                    {localFromDate && (
                      <GHTouchable onPress={() => setLocalFromDate(null)} hitSlop={10}>
                        <X size={12} color={subColor} />
                      </GHTouchable>
                    )}
                  </GHTouchable>
                </View>

                {/* Arrow */}
                <ArrowRight size={16} color={subColor} />

                {/* To */}
                <View style={fs.datePickerWrap}>
                  <GHTouchable
                    onPress={() => setToPickerOpen(true)}
                    activeOpacity={0.7}
                    style={[fs.datePicker, { backgroundColor: dateBg, borderColor: localToDate ? primaryColor : dateBorder }]}
                  >
                    <CalendarDays size={13} color={localToDate ? primaryColor : subColor} />
                    <View style={fs.datePickerText}>
                      <Text style={[fs.datePickerHint, { color: subColor }]}>{t('filter.toDate')}</Text>
                      <Text style={[fs.datePickerVal, { color: localToDate ? textColor : subColor }]}>
                        {localToDate ? dayjs(localToDate).format('DD/MM/YYYY') : '––/––/––––'}
                      </Text>
                    </View>
                    {localToDate && (
                      <GHTouchable onPress={() => setLocalToDate(null)} hitSlop={10}>
                        <X size={12} color={subColor} />
                      </GHTouchable>
                    )}
                  </GHTouchable>
                </View>
              </View>
            </View>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <View style={fs.footer}>
              <View style={fs.btnWrap}>
                <GHTouchable
                  onPress={handleReset}
                  activeOpacity={0.8}
                  style={[fs.btn, { backgroundColor: chipBg }]}
                >
                  <Text style={[fs.btnText, { color: isDark ? colors.gray[50] : colors.gray[700] }]}>
                    {tCommon('common.reset')}
                  </Text>
                </GHTouchable>
              </View>
              <View style={fs.btnWrap}>
                <GHTouchable
                  onPress={handleApply}
                  activeOpacity={0.8}
                  style={[fs.btn, { backgroundColor: primaryColor }]}
                >
                  <Text style={[fs.btnText, { color: colors.white.light }]}>{t('filter.apply')}</Text>
                </GHTouchable>
              </View>
            </View>
          </View>

          {/* Modal date pickers — rendered inside BottomSheet so they layer above it */}
          <DatePicker
            modal
            open={fromPickerOpen}
            date={localFromDate ?? new Date()}
            mode="date"
            maximumDate={localToDate ?? new Date()}
            onConfirm={(d) => { setLocalFromDate(d); setFromPickerOpen(false) }}
            onCancel={() => setFromPickerOpen(false)}
            confirmText={tCommon('confirm')}
            cancelText={tCommon('cancel')}
            theme={isDark ? 'dark' : 'light'}
          />
          <DatePicker
            modal
            open={toPickerOpen}
            date={localToDate ?? new Date()}
            mode="date"
            minimumDate={localFromDate ?? undefined}
            maximumDate={new Date()}
            onConfirm={(d) => { setLocalToDate(d); setToPickerOpen(false) }}
            onCancel={() => setToPickerOpen(false)}
            confirmText={tCommon('confirm')}
            cancelText={tCommon('cancel')}
            theme={isDark ? 'dark' : 'light'}
          />
        </BottomSheetModal>
  )
})

// ─── Styles ───────────────────────────────────────────────────────────────────

const fs = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  // Status chips — single row, equal width
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  chipWrap: { flex: 1 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13 },
  divider: { height: 1, marginBottom: 20 },
  // Date range — side by side with arrow in middle
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  datePickerWrap: { flex: 1 },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 52,
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  datePickerText: { flex: 1, gap: 2 },
  datePickerHint: { fontSize: 10, fontWeight: '500' },
  datePickerVal: { fontSize: 13, fontWeight: '600' },
  // Footer buttons — equal width via View wrapper (GHTouchable doesn't flex reliably)
  footer: { flexDirection: 'row', gap: 10 },
  btnWrap: { flex: 1 },
  btn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700' },
})
