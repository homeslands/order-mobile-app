import { Search, SlidersHorizontal, X } from 'lucide-react-native'
import React, { memo } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { colors } from '@/constants/colors.constant'

export type CatalogChipData = { slug: string; name: string }

type SpecialChipKey = 'isTopSell' | 'isNewProduct'

// Chips extracted as memo — won't re-render when searchText changes
const CatalogChips = memo(function CatalogChips({
  catalogs,
  selectedCatalog,
  isNewProduct,
  isTopSell,
  primaryColor,
  chipBg,
  chipColor,
  allLabel,
  specialChipLabels,
  onCatalogSelect,
  onSpecialFilterSelect,
}: {
  catalogs: CatalogChipData[]
  selectedCatalog: string | undefined
  isNewProduct: boolean | undefined
  isTopSell: boolean | undefined
  primaryColor: string
  chipBg: string
  chipColor: string
  allLabel: string
  specialChipLabels: { isTopSell: string; isNewProduct: string }
  onCatalogSelect: (slug: string | undefined) => void
  onSpecialFilterSelect: (key: SpecialChipKey) => void
}) {
  const specialActive = { isNewProduct: !!isNewProduct, isTopSell: !!isTopSell }
  const hasSpecial = specialActive.isNewProduct || specialActive.isTopSell
  const allActive = !selectedCatalog && !hasSpecial

  const SPECIAL_CHIPS: { key: SpecialChipKey; label: string }[] = [
    { key: 'isTopSell', label: specialChipLabels.isTopSell },
    { key: 'isNewProduct', label: specialChipLabels.isNewProduct },
  ]

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={filterStyles.chipScroll}
      keyboardShouldPersistTaps="always"
    >
      {/* Tất cả */}
      <Pressable
        onPress={() => {
          onCatalogSelect(undefined)
        }}
        style={[
          filterStyles.chip,
          { backgroundColor: allActive ? primaryColor : chipBg },
        ]}
      >
        <Text
          style={[
            filterStyles.chipText,
            allActive ? filterStyles.chipTextActive : { color: chipColor },
          ]}
        >
          {allLabel}
        </Text>
      </Pressable>

      {/* Special chips */}
      {SPECIAL_CHIPS.map(({ key, label }) => {
        const active = specialActive[key]
        return (
          <Pressable
            key={key}
            onPress={() => onSpecialFilterSelect(key)}
            style={[
              filterStyles.chip,
              { backgroundColor: active ? primaryColor : chipBg },
            ]}
          >
            <Text
              style={[
                filterStyles.chipText,
                active ? filterStyles.chipTextActive : { color: chipColor },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        )
      })}

      {/* Catalog chips */}
      {catalogs.map((c) => {
        const sel = selectedCatalog === c.slug
        return (
          <Pressable
            key={c.slug}
            onPress={() => onCatalogSelect(c.slug)}
            style={[
              filterStyles.chip,
              sel
                ? { backgroundColor: primaryColor }
                : { backgroundColor: chipBg },
            ]}
          >
            <Text
              style={[
                filterStyles.chipText,
                sel ? filterStyles.chipTextActive : { color: chipColor },
              ]}
              numberOfLines={1}
            >
              {c.name.charAt(0).toUpperCase() + c.name.slice(1)}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
})

export const MenuFilterBar = memo(function MenuFilterBar({
  searchText,
  onSearchChange,
  onSearchClear,
  catalogs,
  selectedCatalog,
  onCatalogSelect,
  isNewProduct,
  isTopSell,
  onSpecialFilterSelect,
  currentMinPrice,
  currentMaxPrice,
  primaryColor,
  isDark,
  onOpenPriceSheet,
  searchPlaceholder,
  allLabel,
  specialChipLabels,
}: {
  searchText: string
  onSearchChange: (t: string) => void
  onSearchClear: () => void
  catalogs: CatalogChipData[]
  selectedCatalog: string | undefined
  onCatalogSelect: (slug: string | undefined) => void
  isNewProduct: boolean | undefined
  isTopSell: boolean | undefined
  onSpecialFilterSelect: (key: SpecialChipKey) => void
  currentMinPrice: number
  currentMaxPrice: number
  primaryColor: string
  isDark: boolean
  onOpenPriceSheet: () => void
  searchPlaceholder: string
  allLabel: string
  specialChipLabels: { isTopSell: string; isNewProduct: string }
}) {
  const chipBg = isDark ? colors.gray[800] : colors.gray[100]
  const chipColor = isDark ? colors.gray[300] : colors.gray[600]
  const hasPriceFilter = currentMinPrice > 0 || currentMaxPrice < 300_000

  return (
    <View style={filterStyles.container}>
      {/* Row 1 — search + filter icon */}
      <View style={filterStyles.searchRow}>
        <View style={filterStyles.searchWrap}>
          <View style={filterStyles.searchIconWrap}>
            <Search
              size={15}
              color={isDark ? colors.gray[400] : colors.gray[500]}
            />
          </View>
          <TextInput
            value={searchText}
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder}
            placeholderTextColor={isDark ? colors.gray[500] : colors.gray[400]}
            style={[
              filterStyles.searchInput,
              {
                backgroundColor: isDark ? colors.gray[800] : colors.gray[100],
                color: isDark ? colors.gray[50] : colors.gray[900],
                paddingRight: searchText ? 36 : 12,
                fontFamily: 'BeVietnamPro_400Regular',
              },
            ]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <Pressable
              onPress={onSearchClear}
              style={filterStyles.clearBtn}
              hitSlop={8}
            >
              <X
                size={15}
                color={isDark ? colors.gray[400] : colors.gray[500]}
              />
            </Pressable>
          )}
        </View>

        {/* Price filter trigger */}
        <Pressable
          onPress={onOpenPriceSheet}
          style={[
            filterStyles.filterBtn,
            { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] },
            hasPriceFilter && { borderColor: primaryColor, borderWidth: 1.5 },
          ]}
        >
          <SlidersHorizontal
            size={16}
            color={
              hasPriceFilter
                ? primaryColor
                : isDark
                  ? colors.gray[400]
                  : colors.gray[500]
            }
          />
          {hasPriceFilter && (
            <View
              style={[
                filterStyles.activeDot,
                { backgroundColor: primaryColor },
              ]}
            />
          )}
        </Pressable>
      </View>

      {/* Row 2 — catalog chips (memo: won't rebuild on searchText change) */}
      <CatalogChips
        catalogs={catalogs}
        selectedCatalog={selectedCatalog}
        isNewProduct={isNewProduct}
        isTopSell={isTopSell}
        primaryColor={primaryColor}
        chipBg={chipBg}
        chipColor={chipColor}
        allLabel={allLabel}
        specialChipLabels={specialChipLabels}
        onCatalogSelect={onCatalogSelect}
        onSpecialFilterSelect={onSpecialFilterSelect}
      />
    </View>
  )
})

const filterStyles = StyleSheet.create({
  container: {
    gap: 6,
    paddingBottom: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  searchWrap: {
    flex: 1,
  },
  searchIconWrap: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  searchInput: {
    height: 38,
    borderRadius: 10,
    paddingLeft: 36,
    fontSize: 14,
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  chipScroll: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.white.light,
    fontWeight: '600',
  },
})
