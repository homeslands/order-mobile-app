import { MapPin } from 'lucide-react-native'
import { memo, useCallback, useEffect, useState } from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
} from 'react-native'

import { BranchSheet } from './branch-sheet'
import { colors } from '@/constants'
import { useBranch } from '@/hooks'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useBranchStore } from '@/stores'

function SelectBranchDropdown() {
  const [sheetVisible, setSheetVisible] = useState(false)
  const branch = useBranchStore((s) => s.branch)
  const setBranch = useBranchStore((s) => s.setBranch)
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()

  // Fetch ngay khi mount để có thể auto-select.
  // Sheet sẽ dùng cache này — không fetch lại.
  const { data: branchRes } = useBranch()

  // Nếu chưa có branch được lưu, tự động chọn branch đầu tiên trong danh sách.
  useEffect(() => {
    if (branch) return
    const first = branchRes?.result?.[0]
    if (first) setBranch(first)
  }, [branch, branchRes, setBranch])

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
