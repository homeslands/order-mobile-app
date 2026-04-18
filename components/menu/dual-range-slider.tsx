import { useMemo, useRef } from 'react'
import {
  Dimensions,
  PanResponder,
  Text,
  useColorScheme,
  View,
} from 'react-native'

import { colors } from '@/constants/colors.constant'

interface DualRangeSliderProps {
  min: number
  max: number
  step?: number
  value: [number, number]
  onValueChange?: (value: [number, number]) => void
  formatValue?: (value: number) => string
  hideMinMaxLabels?: boolean
  className?: string
}

export default function DualRangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  formatValue = (val) => val.toString(),
  hideMinMaxLabels = false,
  className,
}: DualRangeSliderProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light
  const sliderWidth = Dimensions.get('window').width - 64 // Account for padding
  const trackRef = useRef<View>(null)
  const [minVal, maxVal] = value

  const getPercentage = (val: number) => ((val - min) / (max - min)) * 100

  const getValueFromPosition = (x: number) => {
    const percentage = Math.max(0, Math.min(100, (x / sliderWidth) * 100))
    const rawValue = min + (percentage / 100) * (max - min)
    const steppedValue = Math.round(rawValue / step) * step
    return Math.max(min, Math.min(max, steppedValue))
  }

  const latestRef = useRef({
    minVal,
    maxVal,
    onValueChange,
    getPercentage,
    getValueFromPosition,
  })
  latestRef.current = {
    minVal,
    maxVal,
    onValueChange,
    getPercentage,
    getValueFromPosition,
  }

  const { minPanResponder, maxPanResponder } = useMemo(
    () => ({
      minPanResponder: PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          // Track initial position
        },
        onPanResponderMove: (_, gestureState) => {
          const {
            minVal: currentMin,
            maxVal: currentMax,
            onValueChange: onChange,
            getPercentage: getPct,
            getValueFromPosition: getVal,
          } = latestRef.current
          const currentX = getPct(currentMin) * (sliderWidth / 100)
          const newX = currentX + gestureState.dx
          const newMin = getVal(newX)
          if (newMin < currentMax && newMin >= min) {
            onChange?.([newMin, currentMax])
          }
        },
      }),
      maxPanResponder: PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          // Track initial position
        },
        onPanResponderMove: (_, gestureState) => {
          const {
            minVal: currentMin,
            maxVal: currentMax,
            onValueChange: onChange,
            getPercentage: getPct,
            getValueFromPosition: getVal,
          } = latestRef.current
          const currentX = getPct(currentMax) * (sliderWidth / 100)
          const newX = currentX + gestureState.dx
          const newMax = getVal(newX)
          if (newMax > currentMin && newMax <= max) {
            onChange?.([currentMin, newMax])
          }
        },
      }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const minPosition = getPercentage(minVal)
  const maxPosition = getPercentage(maxVal)

  return (
    <View className={className} style={{ width: sliderWidth }}>
      {/* Track */}
      <View
        ref={trackRef}
        style={{
          height: 8,
          backgroundColor: isDark ? colors.gray[700] : colors.gray[200],
          borderRadius: 4,
          position: 'relative',
          marginVertical: 20,
        }}
      >
        {/* Active Range */}
        <View
          style={{
            position: 'absolute',
            left: `${minPosition}%`,
            width: `${maxPosition - minPosition}%`,
            height: 8,
            backgroundColor: primaryColor,
            borderRadius: 4,
          }}
        />

        {/* Min Thumb */}
        <View
          {...minPanResponder.panHandlers}
          testID="slider-thumb"
          style={{
            position: 'absolute',
            left: `${minPosition}%`,
            width: 24,
            height: 24,
            backgroundColor: isDark ? colors.gray[800] : colors.white.light,
            borderWidth: 2,
            borderColor: primaryColor,
            borderRadius: 12,
            marginLeft: -12,
            marginTop: -8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        />

        {/* Max Thumb */}
        <View
          {...maxPanResponder.panHandlers}
          testID="slider-thumb"
          style={{
            position: 'absolute',
            left: `${maxPosition}%`,
            width: 24,
            height: 24,
            backgroundColor: isDark ? colors.gray[800] : colors.white.light,
            borderWidth: 2,
            borderColor: primaryColor,
            borderRadius: 12,
            marginLeft: -12,
            marginTop: -8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        />
      </View>

      {/* Labels */}
      {!hideMinMaxLabels && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          <Text
            style={{
              color: isDark ? colors.gray[400] : colors.gray[500],
              fontSize: 12,
            }}
          >
            {formatValue(min)}
          </Text>
          <Text
            style={{
              color: isDark ? colors.gray[400] : colors.gray[500],
              fontSize: 12,
            }}
          >
            {formatValue(max)}
          </Text>
        </View>
      )}
    </View>
  )
}
