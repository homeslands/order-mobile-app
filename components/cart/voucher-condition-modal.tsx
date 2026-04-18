import { colors } from '@/constants'
import type { IVoucher } from '@/types'
import { showToast } from '@/utils'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { formatCurrencyNative } from 'cart-price-calc'
import dayjs from 'dayjs'
import * as Clipboard from 'expo-clipboard'
import { Copy } from 'lucide-react-native'
import { memo, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'

const CONDITION_SHEET_SNAP = ['60%']

interface VoucherConditionModalProps {
  voucher: IVoucher | null
  onClose: () => void
  isDark: boolean
  primaryColor: string
  bgStyle: { backgroundColor: string }
  indicatorStyle: { backgroundColor: string }
  bottomInset: number
}

export const VoucherConditionModal = memo(function VoucherConditionModal({
  voucher,
  onClose,
  isDark,
  primaryColor,
  bgStyle,
  indicatorStyle,
  bottomInset,
}: VoucherConditionModalProps) {
  const { t: tToast } = useTranslation('toast')
  const sheetRef = useRef<BottomSheetModal>(null)

  useEffect(() => {
    if (voucher) {
      sheetRef.current?.present()
    } else {
      sheetRef.current?.dismiss()
    }
  }, [voucher])

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.3}
        pressBehavior="close"
      />
    ),
    [],
  )

  if (!voucher) return null

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={CONDITION_SHEET_SNAP}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      backgroundStyle={bgStyle}
      handleIndicatorStyle={indicatorStyle}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
    >
      <View style={[condStyles.content, { paddingBottom: bottomInset + 16 }]}>
        <Text
          style={[
            condStyles.header,
            { color: isDark ? colors.gray[50] : colors.gray[900] },
          ]}
        >
          Điều kiện voucher
        </Text>

        <View
          style={[
            condStyles.codeRow,
            {
              borderColor: `${primaryColor}30`,
              backgroundColor: `${primaryColor}08`,
            },
          ]}
        >
          <Text
            style={[
              condStyles.codeLabel,
              { color: isDark ? colors.gray[400] : colors.gray[500] },
            ]}
          >
            Mã giảm giá
          </Text>
          <View style={condStyles.codeRight}>
            <Text style={[condStyles.codeValue, { color: primaryColor }]}>
              {voucher.code}
            </Text>
            <Pressable
              hitSlop={8}
              onPress={() => {
                Clipboard.setStringAsync(voucher.code)
                showToast(tToast('toast.copyCodeSuccess'))
              }}
            >
              <Copy
                size={14}
                color={isDark ? colors.gray[400] : colors.gray[500]}
              />
            </Pressable>
          </View>
        </View>

        <View
          style={[
            condStyles.dateRow,
            {
              borderColor: isDark ? colors.gray[700] : colors.gray[200],
            },
          ]}
        >
          <Text
            style={[
              condStyles.codeLabel,
              { color: isDark ? colors.gray[400] : colors.gray[500] },
            ]}
          >
            HSD
          </Text>
          <Text
            style={[
              condStyles.dateValue,
              { color: isDark ? colors.gray[50] : colors.gray[900] },
            ]}
          >
            {dayjs(voucher.endDate).format('HH:mm DD/MM/YYYY')}
          </Text>
        </View>

        <Text
          style={[
            condStyles.condTitle,
            { color: isDark ? colors.gray[50] : colors.gray[900] },
          ]}
        >
          Điều kiện
        </Text>
        <View style={condStyles.condList}>
          <Text
            style={[
              condStyles.condItem,
              { color: isDark ? colors.gray[300] : colors.gray[700] },
            ]}
          >
            • Giá trị đơn hàng tối thiểu:{' '}
            {formatCurrencyNative(voucher.minOrderValue)}
          </Text>
          <Text
            style={[
              condStyles.condItem,
              { color: isDark ? colors.gray[300] : colors.gray[700] },
            ]}
          >
            •{' '}
            {voucher.isVerificationIdentity
              ? 'Đã có tài khoản trên hệ thống.'
              : 'Không yêu cầu tài khoản.'}
          </Text>
          <Text
            style={[
              condStyles.condItem,
              { color: isDark ? colors.gray[300] : colors.gray[700] },
            ]}
          >
            • Số lượng sử dụng tối đa trên 1 tài khoản:{' '}
            {voucher.numberOfUsagePerUser || 'Không giới hạn'}
          </Text>
          {voucher.voucherProducts?.length > 0 && (
            <Text
              style={[
                condStyles.condItem,
                { color: isDark ? colors.gray[300] : colors.gray[700] },
              ]}
            >
              • Sản phẩm áp dụng:{' '}
              {voucher.voucherProducts
                .map((vp) => vp.product?.name || vp.slug)
                .join(', ')}
            </Text>
          )}
        </View>
      </View>
    </BottomSheetModal>
  )
})

const condStyles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  codeLabel: {
    fontSize: 13,
  },
  codeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeValue: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  condTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  condList: {
    gap: 6,
  },
  condItem: {
    fontSize: 13,
    lineHeight: 20,
  },
})
