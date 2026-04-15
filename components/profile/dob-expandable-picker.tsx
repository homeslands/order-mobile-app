/**
 * Date of birth picker:
 * - iOS: xổ xuống inline với animation (spinner).
 * - Android: dùng DateTimePickerAndroid.open() (dialog hệ thống) vì Android
 *   spinner không bị clip bởi overflow:hidden, tự hiện khi render.
 * Dùng @react-native-community/datetimepicker (tương thích iOS 26+).
 */
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker'
import { colors } from '@/constants'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

dayjs.extend(customParseFormat)

const PICKER_HEIGHT = 216
const ANIM_DURATION = 220

/** Chuẩn hóa dob từ API (DD/MM/YYYY hoặc YYYY-MM-DD) sang YYYY-MM-DD */
function normalizeDob(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return ''
  const ddmmyyyy = dayjs(value, 'DD/MM/YYYY', true)
  const yyyymmdd = dayjs(value, 'YYYY-MM-DD', true)
  if (ddmmyyyy.isValid()) return ddmmyyyy.format('YYYY-MM-DD')
  if (yyyymmdd.isValid()) return yyyymmdd.format('YYYY-MM-DD')
  return ''
}

/** Ngày mặc định an toàn để tránh "Date value out of bounds" */
function getSafeDate(value: string): Date {
  const normalized = normalizeDob(value) || value
  if (normalized && dayjs(normalized).isValid()) {
    const d = dayjs(normalized).toDate()
    if (!Number.isNaN(d.getTime())) return d
  }
  return dayjs().subtract(25, 'year').toDate()
}

/** Format dob để hiển thị (chấp nhận DD/MM/YYYY hoặc YYYY-MM-DD) */
function formatDobForDisplay(value: string | null | undefined): string {
  const normalized = normalizeDob(value) || value
  if (!normalized || !dayjs(normalized).isValid()) return ''
  return dayjs(normalized).format('DD/MM/YYYY')
}

export type DobExpandablePickerTheme = {
  bg: string
  editBtn: string
  text: string
  textMuted: string
}

type Props = {
  value: string // DD/MM/YYYY hoặc YYYY-MM-DD
  onSelect: (date: string) => void
  theme?: DobExpandablePickerTheme
  placeholder?: string
}

export function DobExpandablePicker({
  value,
  onSelect,
  theme,
  placeholder,
}: Props) {
  const { t } = useTranslation('profile')
  const resolvedPlaceholder = placeholder ?? t('profile.enterDob')
  const isDark = useColorScheme() === 'dark'
  const defaultTheme: DobExpandablePickerTheme = useMemo(
    () => ({
      bg: isDark ? colors.gray[700] : colors.gray[100],
      editBtn: isDark ? colors.gray[700] : colors.gray[200],
      text: isDark ? colors.gray[50] : colors.gray[900],
      textMuted: isDark ? colors.gray[400] : colors.gray[500],
    }),
    [isDark],
  )
  const finalTheme = theme ?? defaultTheme

  const [expanded, setExpanded] = useState(false)
  const progress = useSharedValue(0)
  const safeDate = getSafeDate(value)

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: ANIM_DURATION,
    })
  }, [expanded, progress])

  const handleDateChange = useCallback(
    (_: unknown, d?: Date) => {
      if (d) onSelect(dayjs(d).format('YYYY-MM-DD'))
    },
    [onSelect],
  )

  const handlePress = useCallback(() => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: safeDate,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event, d) => {
          if (event.type === 'set' && d) {
            onSelect(dayjs(d).format('YYYY-MM-DD'))
          }
        },
      })
    } else {
      setExpanded((e) => !e)
    }
  }, [safeDate, onSelect])

  const animatedStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      height: interpolate(progress.value, [0, 1], [0, PICKER_HEIGHT]),
      opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.5, 1]),
      overflow: 'hidden' as const,
    }
  })

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.touchable,
          { backgroundColor: finalTheme.bg, borderColor: finalTheme.editBtn },
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.text,
            { color: value ? finalTheme.text : finalTheme.textMuted },
          ]}
        >
          {formatDobForDisplay(value) || resolvedPlaceholder}
        </Text>
      </TouchableOpacity>
      {Platform.OS === 'ios' && expanded && (
        <Animated.View style={[styles.pickerWrap, animatedStyle]}>
          <View style={styles.pickerInner}>
            <DateTimePicker
              mode="date"
              value={safeDate}
              display="spinner"
              onChange={handleDateChange}
              themeVariant={isDark ? 'dark' : 'light'}
              maximumDate={new Date()}
              style={styles.picker}
            />
          </View>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  touchable: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
  },
  pickerWrap: {
    marginTop: 8,
    alignItems: 'center',
  },
  pickerInner: {
    height: PICKER_HEIGHT,
    alignItems: 'center',
  },
  picker: {
    width: '100%',
    height: PICKER_HEIGHT,
  },
})
