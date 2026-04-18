/**
 * BrandSection — phần thông tin thương hiệu TREND Coffee.
 * Title + mô tả + CTA + StoreCarousel với L-bracket corner decorators bo góc.
 */
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View, useColorScheme } from 'react-native'

import { Images } from '@/assets/images'
import { colors } from '@/constants'
import StoreCarousel from './store-carousel'

const STORE_IMAGES = [
  Images.News.Article1_1,
  Images.News.Article1_2,
  Images.News.Article1_3,
  Images.News.Article2_2,
  Images.News.Article2_3,
  Images.News.Article3_2,
  Images.News.Article3_3,
  Images.News.Article3_4,
]

const BRACKET_OFFSET = -2
const BRACKET_SIZE = 38
const BRACKET_THICKNESS = 1.5
const BRACKET_RADIUS = 20

/** L-shaped bracket với bo góc tại điểm gấp. */
function CornerBracket({
  position,
  color,
}: {
  position: 'tl' | 'tr' | 'bl' | 'br'
  color: string
}) {
  const borderStyle: object = {
    tl: {
      borderTopWidth: BRACKET_THICKNESS,
      borderLeftWidth: BRACKET_THICKNESS,
      borderTopLeftRadius: BRACKET_RADIUS,
      top: BRACKET_OFFSET,
      left: BRACKET_OFFSET,
    },
    tr: {
      borderTopWidth: BRACKET_THICKNESS,
      borderRightWidth: BRACKET_THICKNESS,
      borderTopRightRadius: BRACKET_RADIUS,
      top: BRACKET_OFFSET,
      right: BRACKET_OFFSET,
    },
    bl: {
      borderBottomWidth: BRACKET_THICKNESS,
      borderLeftWidth: BRACKET_THICKNESS,
      borderBottomLeftRadius: BRACKET_RADIUS,
      bottom: BRACKET_OFFSET,
      left: BRACKET_OFFSET,
    },
    br: {
      borderBottomWidth: BRACKET_THICKNESS,
      borderRightWidth: BRACKET_THICKNESS,
      borderBottomRightRadius: BRACKET_RADIUS,
      bottom: BRACKET_OFFSET,
      right: BRACKET_OFFSET,
    },
  }[position]

  return (
    <View
      style={[
        {
          position: 'absolute',
          width: BRACKET_SIZE,
          height: BRACKET_SIZE,
          borderColor: color,
        },
        borderStyle,
      ]}
    />
  )
}

export const BrandSection = React.memo(function BrandSection() {
  const { t } = useTranslation('home')
  const isDark = useColorScheme() === 'dark'
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light

  return (
    <View className="mt-6 px-4">
      {/* Title */}
      <Text
        className="mb-3 text-center text-3xl font-bold"
        style={{ color: primaryColor }}
      >
        TREND Coffee
      </Text>

      {/* Description */}
      <Text className="mb-2 text-center text-base leading-7 text-foreground">
        {t('homeDescription')}
      </Text>
      <Text className="mb-5 text-center text-base leading-7 text-muted-foreground">
        {t('homeDescription2')}
      </Text>

      {/* CTA removed — "Tìm hiểu thêm" ẩn, chờ link đích xác định */}

      {/* Store carousel với L-bracket corner decorators */}
      <View style={{ position: 'relative', marginHorizontal: 8 }}>
        <View style={{ borderRadius: 12, overflow: 'hidden', margin: 8 }}>
          <StoreCarousel images={STORE_IMAGES} />
        </View>
        <CornerBracket position="tl" color={primaryColor} />
        <CornerBracket position="tr" color={primaryColor} />
        <CornerBracket position="bl" color={primaryColor} />
        <CornerBracket position="br" color={primaryColor} />
      </View>
    </View>
  )
})
