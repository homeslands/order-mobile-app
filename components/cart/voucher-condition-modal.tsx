/**
 * Sheet điều kiện voucher.
 *
 * Người dùng mở sheet này thường vì mã KHÔNG áp được, nên nó không chỉ liệt
 * kê điều kiện suông: mỗi dòng đánh dấu đạt hay chưa đạt so với giỏ hàng
 * hiện tại, và lý do cụ thể hiện thành một dải cảnh báo ở đầu.
 *
 * `conditionStatus` và `errorMessage` là tuỳ chọn — nơi gọi nào không có
 * danh sách đã qua processVoucherList thì sheet rơi về dạng liệt kê trung
 * tính, không dấu tích, thay vì hiện sai.
 *
 * Chiều cao theo nội dung (`enableDynamicSizing`) chứ không khoá 60%: danh
 * sách sản phẩm áp dụng dài ngắn rất khác nhau. Bản trước khoá cứng 60% và
 * bọc trong View thường, nên voucher gắn nhiều món thì phần cuối bị cắt và
 * KHÔNG có cách nào đọc tới.
 */
import { colors } from '@/constants'
import type { VoucherConditionStatus } from '@/components/sheet/voucher-validation'
import type { IVoucher } from '@/types'
import { showToast } from '@/utils'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { formatCurrencyNative } from 'cart-price-calc'
import dayjs from 'dayjs'
import * as Clipboard from 'expo-clipboard'
import { AlertTriangle, Check, Copy, X } from 'lucide-react-native'
import { memo, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { GlassSheetBackground } from '@/components/ui/glass-sheet-background'
import { Text } from '@/components/ui/text'

interface VoucherConditionModalProps {
  voucher: IVoucher | null
  onClose: () => void
  isDark: boolean
  primaryColor: string
  indicatorStyle: { backgroundColor: string }
  bottomInset: number
  /** Từ processVoucherList. Thiếu thì các dòng hiện trung tính. */
  conditionStatus?: VoucherConditionStatus
  /** Lý do cụ thể mã chưa dùng được, hiện thành dải cảnh báo ở đầu. */
  errorMessage?: string
}

/** Một dòng điều kiện: đạt, chưa đạt, hoặc thông tin thuần (met undefined). */
const ConditionRow = memo(function ConditionRow({
  met,
  label,
  isDark,
  primaryColor,
}: {
  met?: boolean
  label: string
  isDark: boolean
  primaryColor: string
}) {
  const textColor = isDark ? colors.gray[300] : colors.gray[700]
  const mutedColor = isDark ? colors.gray[500] : colors.gray[400]

  return (
    <View style={s.condRow}>
      <View style={s.condIcon}>
        {met === undefined ? (
          <View style={[s.dot, { backgroundColor: mutedColor }]} />
        ) : met ? (
          <Check size={15} color={primaryColor} />
        ) : (
          <X size={15} color={colors.destructive.light} />
        )}
      </View>
      <Text
        style={[
          s.condText,
          { color: met === false ? colors.destructive.light : textColor },
        ]}
      >
        {label}
      </Text>
    </View>
  )
})

export const VoucherConditionModal = memo(function VoucherConditionModal({
  voucher,
  onClose,
  isDark,
  primaryColor,
  indicatorStyle,
  bottomInset,
  conditionStatus,
  errorMessage,
}: VoucherConditionModalProps) {
  const { t } = useTranslation('voucher')
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

  const handleCopy = useCallback(() => {
    if (!voucher) return
    void Clipboard.setStringAsync(voucher.code)
    showToast(tToast('toast.copyCodeSuccess'))
  }, [voucher, tToast])

  const handleClose = useCallback(() => sheetRef.current?.dismiss(), [])

  if (!voucher) return null

  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const mutedColor = isDark ? colors.gray[400] : colors.gray[500]
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]
  const products = voucher.voucherProducts ?? []

  return (
    <BottomSheetModal
      ref={sheetRef}
      enablePanDownToClose
      // Bật kéo cả thân sheet: trước đây tắt, nên muốn đóng phải trúng đúng
      // cái vạch nhỏ trên cùng.
      enableContentPanningGesture
      enableHandlePanningGesture
      enableDynamicSizing
      backgroundComponent={GlassSheetBackground}
      handleIndicatorStyle={indicatorStyle}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetScrollView
        contentContainerStyle={[s.content, { paddingBottom: bottomInset + 16 }]}
      >
        <View style={s.headerRow}>
          <Text style={[s.title, { color: textColor }]} numberOfLines={2}>
            {voucher.title}
          </Text>
          <Pressable onPress={handleClose} hitSlop={10} style={s.closeBtn}>
            <X size={18} color={mutedColor} />
          </Pressable>
        </View>

        {errorMessage ? (
          <View style={[s.warning, { borderColor: colors.destructive.light }]}>
            <AlertTriangle size={15} color={colors.destructive.light} />
            <Text style={s.warningText}>
              {t('cannotUseReason', { reason: errorMessage })}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            s.infoRow,
            {
              borderColor: `${primaryColor}30`,
              backgroundColor: `${primaryColor}08`,
            },
          ]}
        >
          <Text style={[s.infoLabel, { color: mutedColor }]}>{t('code')}</Text>
          {/* Cả hàng bắt chạm để sao chép, không chỉ cái icon 14px. */}
          <Pressable onPress={handleCopy} hitSlop={8} style={s.infoRight}>
            <Text style={[s.code, { color: primaryColor }]}>
              {voucher.code}
            </Text>
            <Copy size={14} color={mutedColor} />
          </Pressable>
        </View>

        <View style={[s.infoRow, { borderColor }]}>
          <Text style={[s.infoLabel, { color: mutedColor }]}>
            {t('endDate')}
          </Text>
          {/* Cùng thứ tự với hạn dùng trên thẻ voucher. */}
          <Text style={[s.infoValue, { color: textColor }]}>
            {dayjs(voucher.endDate).format('DD/MM/YYYY HH:mm')}
          </Text>
        </View>

        <Text style={[s.sectionTitle, { color: textColor }]}>
          {t('condition')}
        </Text>
        <View style={s.condList}>
          <ConditionRow
            met={conditionStatus?.minOrder}
            isDark={isDark}
            primaryColor={primaryColor}
            label={t('conditionModal.minOrderCondition', {
              value: formatCurrencyNative(voucher.minOrderValue),
            })}
          />
          <ConditionRow
            met={conditionStatus?.identity}
            isDark={isDark}
            primaryColor={primaryColor}
            label={
              voucher.isVerificationIdentity
                ? t('conditionModal.hasAccount')
                : t('conditionModal.noAccount')
            }
          />
          <ConditionRow
            met={conditionStatus?.stock}
            isDark={isDark}
            primaryColor={primaryColor}
            label={t('stockCondition')}
          />
          <ConditionRow
            met={conditionStatus?.expiry}
            isDark={isDark}
            primaryColor={primaryColor}
            label={t('expiryCondition')}
          />
          <ConditionRow
            isDark={isDark}
            primaryColor={primaryColor}
            label={t('conditionModal.usagePerUser', {
              value: voucher.numberOfUsagePerUser || t('unlimited'),
            })}
          />
        </View>

        {products.length > 0 ? (
          <>
            <View style={s.productsHeader}>
              <Text style={[s.sectionTitle, { color: textColor }]}>
                {t('applicableProductsTitle')}
              </Text>
              {conditionStatus?.products === false ? (
                <X size={15} color={colors.destructive.light} />
              ) : conditionStatus?.products ? (
                <Check size={15} color={primaryColor} />
              ) : null}
            </View>
            {/* Từng món một dòng. Trước đây nối bằng dấu phẩy thành một khối
                chữ liền, mắt không quét được khi voucher gắn nhiều món. */}
            <View style={s.condList}>
              {products.map((vp) => (
                <View key={vp.slug} style={s.condRow}>
                  <View style={s.condIcon}>
                    <View style={[s.dot, { backgroundColor: mutedColor }]} />
                  </View>
                  <Text
                    style={[
                      s.condText,
                      { color: isDark ? colors.gray[300] : colors.gray[700] },
                    ]}
                  >
                    {vp.product?.name || vp.slug}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
})

const s = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    paddingTop: 2,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.destructive.light,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  code: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 8,
  },
  productsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  condList: {
    gap: 8,
  },
  condRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  condIcon: {
    width: 16,
    alignItems: 'center',
    paddingTop: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  condText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
})
