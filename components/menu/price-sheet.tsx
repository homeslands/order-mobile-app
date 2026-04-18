/**
 * Price filter bottom sheet — Modal portal pattern so it renders above
 * tab bar and system nav bar. Gesture-driven via @gorhom/bottom-sheet.
 *
 * No hooks subscribe to stores — all data passed via props from parent.
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { colors } from '@/constants'
import { TouchableOpacity as GHTouchable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const PRICE_PRESETS = [
  { label: '', min: 0, max: 300_000 },
  { label: '< 40K', min: 0, max: 40_000 },
  { label: '40K – 60K', min: 40_000, max: 60_000 },
  { label: '60K – 80K', min: 60_000, max: 80_000 },
  { label: '> 80K', min: 80_000, max: 300_000 },
] as const

const SNAP_POINTS = [420]

export type PriceFilterSheetLabels = {
  title: string
  reset: string
  from: string
  to: string
  quickSelect: string
  apply: string
  allPrices: string
}

export const PriceFilterSheet = memo(function PriceFilterSheet({
  visible,
  onClose,
  currentMin,
  currentMax,
  primaryColor,
  isDark,
  onSelect,
  labels,
}: {
  visible: boolean
  onClose: () => void
  currentMin: number
  currentMax: number
  primaryColor: string
  isDark: boolean
  onSelect: (min: number, max: number) => void
  labels: PriceFilterSheetLabels
}) {
  const insets = useSafeAreaInsets()
  const sheetRef = useRef<BottomSheetModal>(null)

  const [localMin, setLocalMin] = useState(() =>
    currentMin > 0 ? String(currentMin) : '',
  )
  const [localMax, setLocalMax] = useState(() =>
    currentMax < 300_000 ? String(currentMax) : '',
  )

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[900] : colors.white.light }),
    [isDark],
  )
  const handleIndicator = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[600] : colors.gray[300] }),
    [isDark],
  )

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

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present()
    } else {
      sheetRef.current?.dismiss()
    }
  }, [visible])

  // State reset handled by key prop in parent — remounts when visible changes

  const closeSheet = useCallback(() => sheetRef.current?.dismiss(), [])

  const handlePreset = useCallback((min: number, max: number) => {
    setLocalMin(min > 0 ? String(min) : '')
    setLocalMax(max < 300_000 ? String(max) : '')
  }, [])

  const handleApply = useCallback(() => {
    const min = Math.max(0, Number(localMin) || 0)
    const max = Number(localMax) || 300_000
    onSelect(Math.min(min, max), Math.max(min, max))
    closeSheet()
  }, [localMin, localMax, onSelect, closeSheet])

  const handleReset = useCallback(() => {
    onSelect(0, 300_000)
    setLocalMin('')
    setLocalMax('')
    closeSheet()
  }, [onSelect, closeSheet])

  const inputBg = isDark ? colors.gray[800] : colors.gray[100]
  const inputColor = isDark ? colors.gray[50] : colors.gray[900]
  const labelColor = isDark ? colors.gray[400] : colors.gray[500]

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      activeOffsetY={[-10, 10]}
      failOffsetX={[-5, 5]}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      handleIndicatorStyle={handleIndicator}
      onDismiss={onClose}
    >
      <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        {/* Top section */}
        <View>
          <View style={styles.header}>
            <Text style={[styles.title, { color: inputColor }]}>
              {labels.title}
            </Text>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: labelColor }]}>
                {labels.from}
              </Text>
              <TextInput
                value={localMin}
                onChangeText={setLocalMin}
                placeholder="0"
                placeholderTextColor={labelColor}
                keyboardType="number-pad"
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBg,
                    color: inputColor,
                    fontFamily: 'BeVietnamPro_400Regular',
                  },
                ]}
              />
              <Text style={[styles.suffix, { color: labelColor }]}>đ</Text>
            </View>

            <Text style={[styles.dash, { color: labelColor }]}>–</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: labelColor }]}>
                {labels.to}
              </Text>
              <TextInput
                value={localMax}
                onChangeText={setLocalMax}
                placeholder="300000"
                placeholderTextColor={labelColor}
                keyboardType="number-pad"
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBg,
                    color: inputColor,
                    fontFamily: 'BeVietnamPro_400Regular',
                  },
                ]}
              />
              <Text style={[styles.suffix, { color: labelColor }]}>đ</Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: labelColor }]}>
            {labels.quickSelect}
          </Text>
          <View style={styles.grid}>
            {PRICE_PRESETS.map((p) => {
              const localMinNum = Number(localMin) || 0
              const localMaxNum = Number(localMax) || 300_000
              const isAll = p.min === 0 && p.max === 300_000
              const sel = isAll
                ? localMinNum === 0 && localMaxNum >= 300_000
                : localMinNum === p.min && localMaxNum === p.max

              return (
                <GHTouchable
                  key={p.label || 'all'}
                  onPress={() => handlePreset(p.min, p.max)}
                  activeOpacity={0.7}
                  style={[
                    styles.presetBtn,
                    sel
                      ? { backgroundColor: primaryColor }
                      : { backgroundColor: inputBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetText,
                      sel
                        ? { color: colors.white.light, fontWeight: '700' }
                        : {
                            color: isDark ? colors.gray[300] : colors.gray[700],
                          },
                    ]}
                  >
                    {p.label || labels.allPrices}
                  </Text>
                </GHTouchable>
              )
            })}
          </View>
        </View>

        {/* Footer buttons — pushed to bottom by justifyContent: space-between */}
        <View style={styles.btnRow}>
          <View style={styles.btnWrap}>
            <GHTouchable
              onPress={handleReset}
              activeOpacity={0.8}
              style={[
                styles.btn,
                {
                  backgroundColor: isDark ? colors.gray[700] : colors.gray[100],
                },
              ]}
            >
              <Text
                style={[
                  styles.btnText,
                  { color: isDark ? colors.gray[50] : colors.gray[700] },
                ]}
              >
                {labels.reset}
              </Text>
            </GHTouchable>
          </View>
          <View style={styles.btnWrap}>
            <GHTouchable
              onPress={handleApply}
              activeOpacity={0.8}
              style={[styles.btn, { backgroundColor: primaryColor }]}
            >
              <Text style={[styles.btnText, { color: colors.white.light }]}>
                {labels.apply}
              </Text>
            </GHTouchable>
          </View>
        </View>
      </View>
    </BottomSheetModal>
  )
})

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 20,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingRight: 28,
    fontSize: 15,
    fontWeight: '500',
  },
  suffix: {
    position: 'absolute',
    right: 12,
    bottom: 13,
    fontSize: 13,
    fontWeight: '500',
  },
  dash: {
    fontSize: 18,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  presetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnWrap: {
    flex: 1,
  },
  btn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
})
