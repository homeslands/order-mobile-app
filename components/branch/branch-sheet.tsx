import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { useLocalSearchParams } from 'expo-router'
import { MapPin } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { colors } from '@/constants'
import { useBranch } from '@/hooks'
import { useBranchStore } from '@/stores'
import type { IBranch } from '@/types'

const SNAP_POINTS = ['40%']

// Tách BranchRow ra memo riêng để chỉ re-render đúng item thay đổi.
const BranchRow = memo(function BranchRow({
  item,
  isSelected,
  onSelect,
  isDark,
  primaryColor,
}: {
  item: IBranch
  isSelected: boolean
  onSelect: (branch: IBranch) => void
  isDark: boolean
  primaryColor: string
}) {
  const pinColor = isDark ? colors.gray[400] : colors.gray[500]
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const mutedColor = isDark ? colors.gray[400] : colors.gray[500]

  const handlePress = useCallback(() => onSelect(item), [item, onSelect])

  return (
    <Pressable
      onPress={handlePress}
      style={[
        s.branchRow,
        {
          borderColor: isSelected
            ? primaryColor
            : isDark
              ? colors.gray[700]
              : colors.gray[200],
          backgroundColor: isSelected ? `${primaryColor}10` : 'transparent',
        },
      ]}
    >
      <View style={s.pinWrap}>
        <MapPin size={18} color={isSelected ? primaryColor : pinColor} />
      </View>
      <View style={s.branchInfo}>
        <Text
          style={[
            s.branchName,
            {
              color: isSelected ? primaryColor : textColor,
              fontWeight: isSelected ? '600' : '400',
            },
          ]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text
          style={[s.branchAddress, { color: mutedColor }]}
          numberOfLines={2}
        >
          {item.addressDetail?.formattedAddress ?? item.address}
        </Text>
      </View>
      {isSelected && (
        <View style={[s.radio, { backgroundColor: primaryColor }]}>
          <View style={s.radioDot} />
        </View>
      )}
    </Pressable>
  )
})

interface BranchSheetProps {
  visible: boolean
  onClose: () => void
  isDark: boolean
  primaryColor: string
}

export const BranchSheet = memo(function BranchSheet({
  visible,
  onClose,
  isDark,
  primaryColor,
}: BranchSheetProps) {
  const { t } = useTranslation('branch')
  const sheetRef = useRef<BottomSheetModal>(null)

  // Trigger đã fetch eager khi mount — sheet dùng cache, không cần lazy flag.
  const { data: branchRes, isLoading } = useBranch()
  const branch = useBranchStore((s) => s.branch)
  const setBranch = useBranchStore((s) => s.setBranch)

  // Sync branch từ URL params (e.g. deep link vào màn hình có ?branch=xxx)
  const { branch: branchSlugParam } = useLocalSearchParams<{
    branch?: string
  }>()
  useEffect(() => {
    if (!branchSlugParam || !branchRes?.result) return
    const found = branchRes.result.find((b) => b.slug === branchSlugParam)
    if (found) setBranch(found)
  }, [branchSlugParam, branchRes, setBranch])

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present()
    } else {
      sheetRef.current?.dismiss()
    }
  }, [visible])

  const handleSelect = useCallback(
    (selected: IBranch) => {
      setBranch(selected)
      sheetRef.current?.dismiss()
    },
    [setBranch],
  )

  const bgStyle = useMemo(
    () => ({
      backgroundColor: isDark ? colors.gray[900] : colors.white.light,
    }),
    [isDark],
  )

  const indicatorStyle = useMemo(
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

  const branches = branchRes?.result ?? []

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      handleIndicatorStyle={indicatorStyle}
      onDismiss={onClose}
    >
      <BottomSheetScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            s.title,
            { color: isDark ? colors.gray[50] : colors.gray[900] },
          ]}
        >
          {t('branch.chooseBranch', 'Chọn chi nhánh')}
        </Text>

        {isLoading && (
          <View style={s.loadingWrap}>
            <ActivityIndicator
              size="small"
              color={isDark ? colors.gray[400] : colors.gray[500]}
            />
            <Text
              style={[
                s.loadingText,
                { color: isDark ? colors.gray[400] : colors.gray[500] },
              ]}
            >
              Đang tải...
            </Text>
          </View>
        )}

        {!isLoading && branches.length === 0 && (
          <Text
            style={[
              s.emptyText,
              { color: isDark ? colors.gray[400] : colors.gray[500] },
            ]}
          >
            {t('branch.noBranches', 'Không có chi nhánh nào')}
          </Text>
        )}

        {branches.map((item) => (
          <BranchRow
            key={item.slug}
            item={item}
            isSelected={branch?.slug === item.slug}
            onSelect={handleSelect}
            isDark={isDark}
            primaryColor={primaryColor}
          />
        ))}
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
})

const s = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 32,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  pinWrap: {
    marginTop: 2,
  },
  branchInfo: {
    flex: 1,
  },
  branchName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  branchAddress: {
    fontSize: 12,
    lineHeight: 16,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white.light,
  },
})
