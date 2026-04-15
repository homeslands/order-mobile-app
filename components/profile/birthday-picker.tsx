/**
 * Chọn ngày sinh — modal date picker.
 * iOS: Modal custom với DateTimePicker spinner + nút Xác nhận / Huỷ.
 * Android: DateTimePickerAndroid.open() (imperative, không render UI).
 * Dùng @react-native-community/datetimepicker (tương thích iOS 26+).
 */
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker'
import dayjs from 'dayjs'
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'

import { colors } from '@/constants'

export type BirthdayPickerRef = {
  open: () => void
  close: () => void
}

export type ProfileThemeColors = {
  text: string
  textMuted: string
  editBtn: string
}

type Props = {
  value: string // YYYY-MM-DD
  onSelect: (date: string) => void
  /** Màu theme từ trang Profile (Dark/Light). Nếu không truyền sẽ dùng useColorScheme(). */
  themeColors?: ProfileThemeColors
  confirmText?: string
  cancelText?: string
}

function parseToDate(value: string): Date {
  if (value && dayjs(value).isValid()) {
    const d = dayjs(value).toDate()
    if (!Number.isNaN(d.getTime())) return d
  }
  return dayjs().subtract(18, 'year').toDate()
}

function formatDate(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD')
}

export const BirthdayPicker = forwardRef<BirthdayPickerRef, Props>(
  function BirthdayPicker(
    {
      value,
      onSelect,
      themeColors,
      confirmText = 'Xác nhận',
      cancelText = 'Huỷ',
    },
    ref,
  ) {
    const isDark = useColorScheme() === 'dark'
    const theme = themeColors ?? {
      text: isDark ? colors.gray[50] : colors.gray[900],
      textMuted: isDark ? colors.gray[400] : colors.gray[500],
      editBtn: isDark ? '#3D4F66' : colors.border.light,
    }

    const primaryColor = isDark ? colors.primary.dark : colors.primary.light
    const [iosOpen, setIosOpen] = useState(false)
    const [tempDate, setTempDate] = useState(() => parseToDate(value))

    const openPicker = useCallback(() => {
      const initial = parseToDate(value)
      setTempDate(initial)
      if (Platform.OS === 'android') {
        DateTimePickerAndroid.open({
          value: initial,
          mode: 'date',
          maximumDate: new Date(),
          onChange: (event, date) => {
            if (event.type === 'set' && date) {
              onSelect(formatDate(date))
            }
          },
        })
      } else {
        setIosOpen(true)
      }
    }, [value, onSelect])

    const closePicker = useCallback(() => {
      if (Platform.OS === 'android') {
        DateTimePickerAndroid.dismiss('date')
      } else {
        setIosOpen(false)
      }
    }, [])

    useImperativeHandle(ref, () => ({ open: openPicker, close: closePicker }), [
      openPicker,
      closePicker,
    ])

    const handleConfirm = useCallback(() => {
      onSelect(formatDate(tempDate))
      setIosOpen(false)
    }, [tempDate, onSelect])

    const handleCancel = useCallback(() => {
      setIosOpen(false)
    }, [])

    // Android uses imperative API only — no UI to render
    if (Platform.OS !== 'ios') return null

    const sheetBg = isDark ? colors.card.dark : colors.card.light
    const handleBg = isDark ? colors.gray[600] : colors.gray[300]
    const dividerColor = isDark ? colors.gray[700] : colors.gray[200]

    return (
      <Modal
        visible={iosOpen}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <Pressable style={s.backdrop} onPress={handleCancel} />
        <View style={[s.sheet, { backgroundColor: sheetBg }]}>
          <View style={[s.handle, { backgroundColor: handleBg }]} />

          <DateTimePicker
            value={tempDate}
            mode="date"
            display="spinner"
            onChange={(_, date) => { if (date) setTempDate(date) }}
            themeVariant={isDark ? 'dark' : 'light'}
            maximumDate={new Date()}
            style={s.picker}
          />

          <View style={[s.btnRow, { borderTopColor: dividerColor }]}>
            <TouchableOpacity style={s.btn} onPress={handleCancel} hitSlop={8}>
              <Text style={[s.btnText, { color: theme.textMuted }]}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btn} onPress={handleConfirm} hitSlop={8}>
              <Text style={[s.btnText, s.btnConfirm, { color: primaryColor }]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  },
)

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 4,
  },
  picker: {
    width: '100%',
    height: 216,
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  btnText: {
    fontSize: 16,
  },
  btnConfirm: {
    fontWeight: '600',
  },
})
