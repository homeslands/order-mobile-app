/**
 * Chọn ngày sinh dạng 3 cuộn: ngày, tháng, năm.
 * Dùng BottomSheetModal (không phải BottomSheet) để hiển thị đúng khi màn nằm trong Stack.
 */
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import dayjs from 'dayjs'
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import {
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'

import { colors } from '@/constants'

const ITEM_HEIGHT = 44
const VISIBLE_ITEMS = 5
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS

const MONTHS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
]

function range(start: number, end: number): number[] {
  const arr: number[] = []
  for (let i = start; i <= end; i++) arr.push(i)
  return arr
}

const DAYS = range(1, 31)
const MONTH_OPTIONS = range(1, 12)
const currentYear = new Date().getFullYear()
const YEARS = range(currentYear - 100, currentYear)

export type DateOfBirthWheelPickerRef = {
  open: () => void
  close: () => void
}

type Props = {
  value: string // YYYY-MM-DD
  onSelect: (date: string) => void
}

export const DateOfBirthWheelPicker = forwardRef<DateOfBirthWheelPickerRef, Props>(
  function DateOfBirthWheelPicker({ value, onSelect }, ref) {
    const isDark = useColorScheme() === 'dark'
    const sheetRef = useRef<BottomSheetModal>(null)
    const dayRef = useRef<ScrollView>(null)
    const monthRef = useRef<ScrollView>(null)
    const yearRef = useRef<ScrollView>(null)

    const parsed = useMemo(() => {
      if (value && dayjs(value).isValid()) {
        const d = dayjs(value)
        return { day: d.date(), month: d.month() + 1, year: d.year() }
      }
      const d = dayjs().subtract(18, 'year')
      return { day: 1, month: 1, year: d.year() }
    }, [value])

    const [day, setDay] = useState(parsed.day)
    const [month, setMonth] = useState(parsed.month)
    const [year, setYear] = useState(parsed.year)

    const snapPoints = useMemo(() => [340], [])

    const scrollToIndex = useCallback(
      (scrollRef: React.RefObject<ScrollView | null>, index: number) => {
        const y = Math.max(0, index * ITEM_HEIGHT)
        scrollRef.current?.scrollTo({ y, animated: false })
      },
      [],
    )

    const open = useCallback(() => {
      setDay(parsed.day)
      setMonth(parsed.month)
      setYear(parsed.year)
      sheetRef.current?.present()
      setTimeout(() => {
        scrollToIndex(dayRef, parsed.day - 1)
        scrollToIndex(monthRef, parsed.month - 1)
        scrollToIndex(yearRef, YEARS.indexOf(parsed.year))
      }, 150)
    }, [parsed, scrollToIndex])

    const close = useCallback(() => {
      sheetRef.current?.dismiss()
    }, [])

    useImperativeHandle(ref, () => ({ open, close }), [open, close])

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
          pressBehavior="close"
        />
      ),
      [],
    )

    const handleConfirm = useCallback(() => {
      const daysInMonth = dayjs(`${year}-${month}`).daysInMonth()
      const safeDay = Math.min(day, daysInMonth)
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
      onSelect(dateStr)
      close()
    }, [day, month, year, onSelect, close])

    const onScrollDay = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y
        const index = Math.round(y / ITEM_HEIGHT)
        const clamped = Math.max(0, Math.min(DAYS.length - 1, index))
        setDay(DAYS[clamped])
      },
      [],
    )
    const onScrollMonth = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y
        const index = Math.round(y / ITEM_HEIGHT)
        const clamped = Math.max(0, Math.min(MONTH_OPTIONS.length - 1, index))
        setMonth(MONTH_OPTIONS[clamped])
      },
      [],
    )
    const onScrollYear = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y
        const index = Math.round(y / ITEM_HEIGHT)
        const clamped = Math.max(0, Math.min(YEARS.length - 1, index))
        setYear(YEARS[clamped])
      },
      [],
    )

    const textColor = isDark ? colors.gray[100] : colors.gray[900]
    const mutedColor = isDark ? colors.gray[400] : colors.gray[500]
    const borderColor = isDark ? colors.gray[700] : colors.gray[200]

    const renderWheel = (
      scrollRef: React.RefObject<ScrollView | null>,
      options: (string | number)[],
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
      selectedValue: number | string,
    ) => (
      <ScrollView
        ref={scrollRef}
        style={styles.wheel}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={onScroll}
        onScrollEndDrag={onScroll}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT * 2,
        }}
      >
        {options.map((opt, i) => (
          <View key={i} style={[styles.wheelItem, { height: ITEM_HEIGHT }]}>
            <Text
              style={[
                styles.wheelItemText,
                {
                  color: String(opt) === String(selectedValue) ? textColor : mutedColor,
                  fontWeight: String(opt) === String(selectedValue) ? '600' : '400',
                },
              ]}
              numberOfLines={1}
            >
              {opt}
            </Text>
          </View>
        ))}
      </ScrollView>
    )

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: isDark ? colors.gray[800] : colors.white.light }}
        handleIndicatorStyle={{ backgroundColor: mutedColor }}
        containerStyle={{ zIndex: 99999, elevation: 99999 }}
      >
        <View style={styles.sheetContent}>
          <View style={[styles.wheelRow, { borderBottomColor: borderColor }]}>
            {renderWheel(dayRef, DAYS, onScrollDay, day)}
            {renderWheel(
              monthRef,
              MONTHS,
              onScrollMonth,
              MONTHS[month - 1],
            )}
            {renderWheel(yearRef, YEARS, onScrollYear, year)}
          </View>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: isDark ? colors.primary.dark : colors.primary.light }]}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmBtnText}>Xác nhận</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    )
  },
)

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  wheelRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
    height: WHEEL_HEIGHT,
  },
  wheel: {
    flex: 1,
    maxHeight: WHEEL_HEIGHT,
  },
  wheelItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontSize: 17,
  },
  confirmBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white.light,
  },
})
