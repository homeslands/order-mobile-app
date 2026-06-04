import { MapPin } from 'lucide-react-native'
import { memo, useCallback, useEffect, useState } from 'react'
import { StyleSheet, TouchableOpacity, useColorScheme } from 'react-native'

import { BranchSheet } from './branch-sheet'
import { colors } from '@/constants'
import { useBranch } from '@/hooks'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useBranchStore } from '@/stores'
import { Text } from '@/components/ui/text'

interface SelectBranchDropdownProps {
  /** Khi true: tự mở sheet chọn chi nhánh (lần đầu, chưa có branch).
   *  Nên truyền từ màn hình sau khi animation và interactions đã hoàn tất
   *  (vd: sau allowFetch trong menu screen) để tránh conflict với transition. */
  autoOpen?: boolean
  /** Khi true: mở sheet ngay lập tức (dùng cho CTA button từ empty state).
   *  Caller phải reset về false trong onForceOpenConsumed để tránh re-open. */
  forceOpen?: boolean
  /** Callback để caller reset forceOpen về false sau khi sheet đã được mở. */
  onForceOpenConsumed?: () => void
}

function SelectBranchDropdown({
  autoOpen = false,
  forceOpen = false,
  onForceOpenConsumed,
}: SelectBranchDropdownProps) {
  const [sheetVisible, setSheetVisible] = useState(false)
  const branch = useBranchStore((s) => s.branch)
  const setBranch = useBranchStore((s) => s.setBranch)
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()

  // Fetch ngay khi mount để có thể auto-select.
  // Sheet sẽ dùng cache này — không fetch lại.
  const { data: branchRes } = useBranch()

  useEffect(() => {
    const branches = branchRes?.result
    if (!branches?.length) return

    if (branch) {
      // Re-sync stored branch với API mới nhất.
      // Nếu slug không còn tồn tại (branch đã bị xoá/đổi), silently cập nhật về branch đầu.
      const stillValid = branches.some((b) => b.slug === branch.slug)
      if (stillValid) return
      setBranch(branches[0])
      return
    }

    // autoOpen được truyền từ màn hình sau khi interaction/animation hoàn tất.
    // Đảm bảo present() không conflict với tab transition.
    if (!autoOpen) return
    setBranch(branches[0])
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSheetVisible(true)
  }, [autoOpen, branch, branchRes, setBranch])

  useEffect(() => {
    if (!forceOpen) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSheetVisible(true)
    onForceOpenConsumed?.()
  }, [forceOpen, onForceOpenConsumed])

  const openSheet = useCallback(() => setSheetVisible(true), [])
  const closeSheet = useCallback(() => setSheetVisible(false), [])

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        activeOpacity={0.7}
        onPress={openSheet}
      >
        <MapPin
          size={16}
          color={isDark ? colors.gray[400] : colors.gray[500]}
        />
        <Text
          style={[
            styles.triggerText,
            {
              color: branch?.name
                ? isDark
                  ? colors.gray[50]
                  : colors.gray[900]
                : isDark
                  ? colors.gray[400]
                  : colors.gray[500],
            },
          ]}
          numberOfLines={1}
        >
          {branch?.name ?? 'Chọn chi nhánh'}
        </Text>
      </TouchableOpacity>

      <BranchSheet
        visible={sheetVisible}
        onClose={closeSheet}
        isDark={isDark}
        primaryColor={primaryColor}
      />
    </>
  )
}

export default memo(SelectBranchDropdown)

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 120,
    maxWidth: 180,
  },
  triggerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
})
