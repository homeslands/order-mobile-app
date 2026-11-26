/**
 * Product Detail Options — size + ghi chú cho quán.
 *
 * - Một size: chỉ ghi tên size (không phải nút — không có gì để chọn).
 * - Nhiều size: thẻ ghi tên + giá (size rẻ nhất giá đầy đủ, size khác phần chênh).
 * - Ghi chú: chip ghi chú nhanh + ô nhập, cùng sửa `note` trong store
 *   (handleAddToCart đọc note lúc bấm thêm vào giỏ).
 * Số lượng nằm ở footer (ProductPriceFooter).
 */
import { colors } from '@/constants'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { hexToRgba } from '@/lib/utils'
import type { IProductVariant } from '@/types'
import { variantPriceLabels } from '@/utils/product-detail-calc'
import { noteHasChip, toggleNoteChip } from '@/utils/product-note'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native'
import {
  useDetailNote,
  useDetailSetNote,
  useDetailSetSelection,
  useDetailSize,
} from '@/stores/selectors'
import { Text } from '@/components/ui/text'

const styles = StyleSheet.create({
  section: { gap: 10 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: { fontSize: 15, fontWeight: '600' },
  singleSize: { fontSize: 14, fontWeight: '500' },
  sizeRow: { flexDirection: 'row', gap: 8 },
  sizeCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  sizeName: { fontSize: 14, fontWeight: '600' },
  sizePrice: { fontSize: 12 },
  stock: { fontSize: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  noteInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 14,
  },
  divider: { height: StyleSheet.hairlineWidth },
})

/** Thẻ size — subscribe atomic useDetailSize → chỉ re-render khi size đổi */
const SizeCard = React.memo(function SizeCard({
  variant,
  priceLabel,
  onSelect,
}: {
  variant: IProductVariant
  priceLabel: string
  onSelect: (v: IProductVariant) => void
}) {
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const isSelected = useDetailSize() === variant.size.name
  const handlePress = useCallback(() => onSelect(variant), [variant, onSelect])

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      style={[
        styles.sizeCard,
        isSelected
          ? {
              borderColor: primaryColor,
              backgroundColor: hexToRgba(primaryColor, isDark ? 0.16 : 0.1),
            }
          : {
              borderColor: isDark ? colors.gray[700] : colors.gray[200],
              backgroundColor: 'transparent',
            },
      ]}
      {...({ unstable_pressDelay: 0 } as object)}
    >
      <Text
        style={[
          styles.sizeName,
          { color: isDark ? colors.gray[50] : colors.gray[900] },
        ]}
      >
        {variant.size.name}
      </Text>
      <Text
        style={[
          styles.sizePrice,
          { color: isDark ? colors.gray[400] : colors.gray[500] },
        ]}
      >
        {priceLabel}
      </Text>
    </Pressable>
  )
})

/** Chip ghi chú — sáng khi cụm đó đang có trong ghi chú */
const NoteChip = React.memo(function NoteChip({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: boolean
  onToggle: (label: string) => void
}) {
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const handlePress = useCallback(() => onToggle(label), [label, onToggle])

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={[
        styles.chip,
        selected
          ? {
              borderColor: primaryColor,
              backgroundColor: hexToRgba(primaryColor, isDark ? 0.16 : 0.1),
            }
          : {
              borderColor: isDark ? colors.gray[700] : colors.gray[200],
              backgroundColor: 'transparent',
            },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          {
            color: selected
              ? primaryColor
              : isDark
                ? colors.gray[300]
                : colors.gray[700],
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
})

/** Ghi chú cho quán — chỉ phần này re-render khi khách gõ */
const NoteSection = React.memo(function NoteSection({
  title,
  placeholder,
  chips,
}: {
  title: string
  placeholder: string
  chips: string[]
}) {
  const isDark = useColorScheme() === 'dark'
  const note = useDetailNote()
  const setNote = useDetailSetNote()

  const handleToggle = useCallback(
    (chip: string) => setNote(toggleNoteChip(note, chip)),
    [note, setNote],
  )

  return (
    <View style={styles.section}>
      <Text
        style={[
          styles.label,
          { color: isDark ? colors.gray[50] : colors.gray[900] },
        ]}
      >
        {title}
      </Text>
      <View style={styles.chipRow}>
        {chips.map((chip) => (
          <NoteChip
            key={chip}
            label={chip}
            selected={noteHasChip(note, chip)}
            onToggle={handleToggle}
          />
        ))}
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={placeholder}
        placeholderTextColor={isDark ? colors.gray[500] : colors.gray[400]}
        multiline
        maxLength={200}
        textAlignVertical="top"
        style={[
          styles.noteInput,
          {
            borderColor: isDark ? colors.gray[700] : colors.gray[200],
            color: isDark ? colors.gray[50] : colors.gray[900],
          },
        ]}
      />
    </View>
  )
})

export interface ProductDetailOptionsSectionProps {
  productSlug: string
  variants: IProductVariant[]
  isLimit: boolean
  currentStock: number
  defaultStock: number
  sizeLabel: string
  stockLabel: string
  noteTitle: string
  notePlaceholder: string
  noteChips: string[]
}

export const ProductDetailOptionsSection = React.memo(
  function ProductDetailOptionsSection({
    productSlug,
    variants,
    isLimit,
    currentStock,
    defaultStock,
    sizeLabel,
    stockLabel,
    noteTitle,
    notePlaceholder,
    noteChips,
  }: ProductDetailOptionsSectionProps) {
    const isDark = useColorScheme() === 'dark'
    const setSelection = useDetailSetSelection()
    const priceLabels = useMemo(() => variantPriceLabels(variants), [variants])

    const handleSizeChange = useCallback(
      (variant: IProductVariant) => {
        setSelection({
          variant,
          size: variant.size.name,
          price: variant.price,
        })
      },
      [setSelection],
    )

    const initialVariant = useMemo(() => {
      if (variants?.length > 0) {
        return variants.reduce((prev, curr) =>
          prev.price < curr.price ? prev : curr,
        )
      }
      return null
    }, [variants])

    // Auto-select cheapest variant when product or variants change
    const lastAutoSelectedRef = useRef<string | null>(null)
    useEffect(() => {
      if (!initialVariant) return
      const key = `${productSlug}:${initialVariant.slug}`
      if (lastAutoSelectedRef.current === key) return
      lastAutoSelectedRef.current = key
      setSelection({
        variant: initialVariant,
        size: initialVariant.size.name,
        price: initialVariant.price,
        quantity: 1,
      })
    }, [productSlug, initialVariant, setSelection])

    const labelColor = isDark ? colors.gray[50] : colors.gray[900]
    const mutedColor = isDark ? colors.gray[400] : colors.gray[500]

    return (
      <View style={{ gap: 20 }}>
        {variants.length === 1 && (
          <View style={styles.rowBetween}>
            <Text style={[styles.label, { color: labelColor }]}>
              {sizeLabel}
            </Text>
            <Text style={[styles.singleSize, { color: mutedColor }]}>
              {variants[0].size.name}
            </Text>
          </View>
        )}

        {variants.length > 1 && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: labelColor }]}>
              {sizeLabel}
            </Text>
            <View style={styles.sizeRow}>
              {variants.map((v) => (
                <SizeCard
                  key={v.slug}
                  variant={v}
                  priceLabel={priceLabels.get(v.slug) ?? ''}
                  onSelect={handleSizeChange}
                />
              ))}
            </View>
          </View>
        )}

        {isLimit && (
          <Text style={[styles.stock, { color: mutedColor, marginTop: -10 }]}>
            {stockLabel}
            {currentStock}/{defaultStock}
          </Text>
        )}

        <View
          style={[
            styles.divider,
            { backgroundColor: isDark ? colors.gray[700] : colors.gray[200] },
          ]}
        />

        <NoteSection
          title={noteTitle}
          placeholder={notePlaceholder}
          chips={noteChips}
        />
      </View>
    )
  },
)

/** Defer render children sau 1 frame — giảm mount spike khi có nhiều options */
export function DeferredOptionsSection({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (!ready) {
    return (
      fallback ?? (
        <View
          style={{
            minHeight: 120,
            backgroundColor: colors.gray[200],
            borderRadius: 12,
            marginHorizontal: 16,
          }}
        />
      )
    )
  }

  return <>{children}</>
}
