import { Coins } from 'lucide-react-native'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Image } from 'expo-image'
import { ScrollView, Text, useColorScheme, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'

import { Images } from '@/assets/images'
import { colors, PaymentMethod, VOUCHER_TYPE } from '@/constants'
import { IOrder, OrderTypeEnum } from '@/types'
import { capitalizeFirstLetter, formatCurrency, formatDateTimeWithSeconds, formatPoints } from '@/utils'

interface InvoiceProps {
  order: IOrder | undefined
}

export default React.memo(function Invoice({ order }: InvoiceProps) {
  const { t } = useTranslation('menu')
  const isDark = useColorScheme() === 'dark'
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light

  const { originalTotal, discount, voucherDiscount } = useMemo(() => {
    const items = order?.orderItems
    if (!items) return { originalTotal: 0, discount: 0, voucherDiscount: 0 }

    const origTotal = items.reduce(
      (sum, item) => sum + item.variant.price * item.quantity,
      0,
    )
    const disc = items.reduce(
      (sum, item) =>
        sum +
        (item.promotion
          ? item.variant.price * item.quantity * (item.promotion.value / 100)
          : 0),
      0,
    )
    const vDisc =
      order?.voucher?.type === VOUCHER_TYPE.PERCENT_ORDER
        ? (origTotal - disc || 0) * (order.voucher.value / 100)
        : order?.voucher?.type === VOUCHER_TYPE.FIXED_VALUE
          ? order.voucher.value
          : 0

    return { originalTotal: origTotal, discount: disc, voucherDiscount: vDisc }
  }, [order?.orderItems, order?.voucher])

  const loss = order?.loss || 0

  const isPointPayment =
    order?.payment?.paymentMethod === PaymentMethod.POINT

  const isLoyaltyPoint = order && order?.accumulatedPointsToUse > 0

  if (!order) {
    return null
  }

  return (
    <ScrollView
      className="px-3 py-5 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700"
      showsVerticalScrollIndicator={false}
    >
      {/* Logo */}
      <View className="mb-1">
        <View className="flex justify-center items-center">
          <Image
            source={Images.Brand.Logo}
            className="w-52 h-20"
            contentFit="contain"
          />
        </View>
        <Text className="text-sm text-center text-gray-600 dark:text-gray-400 mt-2">
          {order?.invoice?.branchAddress || ''}
        </Text>
        {/* QR Code */}
        <View className="flex justify-center items-center py-4">
          {order?.slug ? (
            <QRCode
              value={order.slug}
              size={128}
              color={isDark ? '#ffffff' : '#000000'}
              backgroundColor={isDark ? '#1f2937' : '#ffffff'}
            />
          ) : (
            <View
              className="w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-md items-center justify-center"
              style={{ borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'dashed' }}
            >
              <Text className="text-xs text-gray-400 dark:text-gray-500">
                QR Code
              </Text>
            </View>
          )}
        </View>
        <Text className="text-xs text-center text-gray-600 dark:text-gray-400">
          <Text>{t('order.slug', 'Mã đơn')}:</Text>{' '}
          <Text>{order?.referenceNumber}</Text>
        </Text>
      </View>

      {/* Invoice info */}
      <View className="flex flex-col gap-2 mt-4">
        <Text className="text-xs text-gray-900 dark:text-gray-50">
          <Text className="font-bold">{t('order.orderTime', 'Thời gian')}</Text>{' '}
          {formatDateTimeWithSeconds(order?.createdAt)}
        </Text>
        {order?.table?.slug && (
          <Text className="text-xs text-gray-900 dark:text-gray-50">
            <Text className="font-bold">{t('order.table', 'Bàn')}:</Text>{' '}
            <Text className="capitalize">{order?.table?.name}</Text>
          </Text>
        )}
        <Text className="text-xs text-gray-900 dark:text-gray-50">
          <Text className="font-bold">{t('order.customer', 'Khách hàng')}:</Text>{' '}
          {order?.owner?.firstName} {order?.owner?.lastName}
        </Text>
        {order?.owner?.slug !== order?.approvalBy?.slug && (
          <Text className="text-xs text-gray-900 dark:text-gray-50">
            <Text className="font-bold">{t('order.cashier', 'Thu ngân')}:</Text>{' '}
            {order?.approvalBy?.firstName} {order?.approvalBy?.lastName}
          </Text>
        )}
        {order?.type === OrderTypeEnum.TAKE_OUT ? (
          <Text className="text-xs text-gray-900 dark:text-gray-50">
            <Text className="font-bold">{t('order.orderType', 'Loại đơn')}:</Text>{' '}
            {t('order.takeAway', 'Mang đi')} -{' '}
            {order?.timeLeftTakeOut === 0
              ? t('menu.immediately', 'Ngay')
              : `${order?.timeLeftTakeOut} ${t('menu.minutes', 'phút')}`}
          </Text>
        ) : order?.type === OrderTypeEnum.DELIVERY ? (
          <>
            <Text className="text-xs text-gray-900 dark:text-gray-50">
              <Text className="font-bold">{t('order.orderType', 'Loại đơn')}:</Text>{' '}
              {t('menu.delivery', 'Giao hàng')}
            </Text>
            <Text className="text-xs text-gray-900 dark:text-gray-50">
              <Text className="font-bold">
                {t('order.deliveryAddress', 'Địa chỉ giao hàng')}:
              </Text>{' '}
              {order?.deliveryTo?.formattedAddress}
            </Text>
            <Text className="text-xs text-gray-900 dark:text-gray-50">
              <Text className="font-bold">
                {t('order.deliveryPhone', 'Số điện thoại giao hàng')}:
              </Text>{' '}
              {order?.deliveryPhone}
            </Text>
          </>
        ) : (
          <Text className="text-xs text-gray-900 dark:text-gray-50">
            <Text className="font-bold">{t('order.orderType', 'Loại đơn')}:</Text>{' '}
            {t('order.dineIn', 'Tại bàn')}
          </Text>
        )}
        {order?.description && (
          <Text className="text-xs text-gray-900 dark:text-gray-50">
            <Text className="font-bold">{t('order.note', 'Ghi chú')}:</Text>{' '}
            {order.description}
          </Text>
        )}
      </View>

      {/* Invoice items */}
      <View className="mt-4">
        {/* Table Header */}
        <View className="flex-row border-b border-dashed border-gray-300 dark:border-gray-600 pb-2 mb-2">
          <View className="flex-[0.35]">
            <Text className="text-xs font-semibold text-gray-900 dark:text-gray-50">
              {t('order.item', 'Sản phẩm')}
            </Text>
          </View>
          <View className="flex-[0.1] items-center">
            <Text className="text-xs font-semibold text-gray-900 dark:text-gray-50">
              {t('order.itemQuantity', 'SL')}
            </Text>
          </View>
          <View className="flex-[0.25] items-end">
            <Text className="text-xs font-semibold text-gray-900 dark:text-gray-50">
              {t('order.unitPrice', 'Đơn giá')}
            </Text>
          </View>
          <View className="flex-[0.1] items-center">
            <Text className="text-xs font-semibold text-gray-900 dark:text-gray-50">
              {t('menu.promotion', 'Khuyến mãi')} (%)
            </Text>
          </View>
          <View className="flex-[0.2] items-end">
            <Text className="text-xs font-semibold text-gray-900 dark:text-gray-50">
              {t('order.grandTotal', 'Thành tiền')}
            </Text>
          </View>
        </View>

        {/* Table Body */}
        {order?.orderItems.map((item) => (
          <View key={item.slug}>
            <View className="flex-row border-b border-dashed border-gray-200 dark:border-gray-700 pb-2 mb-2">
              <View className="flex-[0.35]">
                <Text className="text-xs text-gray-900 dark:text-gray-50">
                  {item?.variant?.product?.name}{' '}
                  <Text className="uppercase">
                    ({capitalizeFirstLetter(item?.variant?.size?.name)})
                  </Text>
                </Text>
              </View>
              <View className="flex-[0.1] items-center">
                <Text className="text-xs text-gray-900 dark:text-gray-50">
                  {item?.quantity}
                </Text>
              </View>
              <View className="flex-[0.25] items-end">
                <Text className="text-xs text-gray-900 dark:text-gray-50">
                  {formatCurrency(item?.variant?.price || 0)}
                </Text>
              </View>
              <View className="flex-[0.1] items-center">
                <Text className="text-xs text-gray-900 dark:text-gray-50">
                  {item?.promotion?.value || 0}
                </Text>
              </View>
              <View className="flex-[0.2] items-end">
                <Text className="text-xs text-gray-900 dark:text-gray-50">
                  {formatCurrency(item?.subtotal || 0)}
                </Text>
              </View>
            </View>

            {item?.note && (
              <View className="mb-2 pb-2 bg-gray-50 dark:bg-gray-700/50 rounded-md px-2 py-1">
                <Text className="text-[11px] text-gray-600 dark:text-gray-400 italic">
                  📝 {t('order.note', 'Ghi chú')}: {item.note}
                </Text>
              </View>
            )}
          </View>
        ))}

        {/* Payment Summary */}
        <View className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          <View className="flex-row justify-between items-center py-2">
            <Text className="text-xs text-gray-900 dark:text-gray-50">
              {t('order.pttt', 'Phương thức thanh toán')}
            </Text>
            <Text className="text-xs font-semibold text-gray-900 dark:text-gray-50">
              {order?.payment?.paymentMethod === PaymentMethod.CASH
                ? t('order.cash', 'Tiền mặt')
                : order?.payment?.paymentMethod === PaymentMethod.BANK_TRANSFER
                  ? t('order.bankTransfer', 'Chuyển khoản')
                  : order?.payment?.paymentMethod === PaymentMethod.CREDIT_CARD
                    ? t('order.creditCard', 'Thẻ tín dụng')
                    : t('order.point', 'Điểm')}
            </Text>
          </View>
          <View className="flex-row justify-between items-center py-2">
            <Text className="text-xs text-gray-900 dark:text-gray-50">
              {t('order.estimatedTotal', 'Tạm tính')}
            </Text>
            <Text className="text-xs text-gray-900 dark:text-gray-50">
              {formatCurrency(originalTotal - discount || 0)}
            </Text>
          </View>
          <View className="flex-row justify-between items-center py-2">
            <Text className="text-xs text-gray-900 dark:text-gray-50">
              {t('order.discount', 'Giảm giá')}
            </Text>
            <Text className="text-xs text-gray-900 dark:text-gray-50">
              {formatCurrency(voucherDiscount || 0)}
            </Text>
          </View>
          {isPointPayment && (
            <View className="flex-row justify-between items-center py-2">
              <Text className="text-xs text-gray-900 dark:text-gray-50">
                {t('order.deductedCoinAmount', 'Số xu đã trừ')}
              </Text>
              <View className="flex-row items-center gap-1">
                <Text className="text-xs text-gray-900 dark:text-gray-50">
                  {formatCurrency(order?.invoice?.amount, '')}
                </Text>
                <Coins size={16} color={primaryColor} />
              </View>
            </View>
          )}
          {isLoyaltyPoint && (
            <View className="flex-row justify-between items-center py-2">
              <Text className="text-xs text-gray-900 dark:text-gray-50">
                {t('order.loyaltyPoint', 'Điểm tích lũy')}
              </Text>
              <Text className="text-xs text-gray-900 dark:text-gray-50">
                {formatPoints(order?.accumulatedPointsToUse || 0)}
              </Text>
            </View>
          )}
          {order?.type === OrderTypeEnum.DELIVERY && order?.deliveryFee > 0 && (
            <View className="flex-row justify-between items-center py-2">
              <Text className="text-xs text-gray-900 dark:text-gray-50">
                {t('order.deliveryFee', 'Phí giao hàng')}
              </Text>
              <Text className="text-xs text-gray-900 dark:text-gray-50">
                {formatCurrency(order?.deliveryFee || 0)}
              </Text>
            </View>
          )}
          <View className="flex-row justify-between items-center py-2">
            <Text className="text-xs text-gray-900 dark:text-gray-50">
              {t(
                'order.invoiceAutoDiscountUnderThreshold',
                'Giảm giá tự động đơn hàng dưới 2000đ',
              )}
            </Text>
            <Text className="text-xs text-gray-900 dark:text-gray-50">
              {formatCurrency(loss || 0)}
            </Text>
          </View>
          <View className="flex-row justify-between items-center py-3 mt-2 border-t-2 border-dashed border-gray-300 dark:border-gray-600">
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
              {t('order.totalPayment', 'Tổng tiền')}
            </Text>
            <Text
              className="text-xl font-bold"
              style={{ color: primaryColor }}
            >
              {isPointPayment
                ? formatCurrency(0)
                : formatCurrency(order?.subtotal || 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* Invoice footer */}
      <Text className="text-sm italic mt-4" style={{ color: primaryColor }}>
        {t('order.invoiceNote', 'Lưu ý: Nếu bạn không tải được hóa đơn, vui lòng chụp lại màn hình')}
      </Text>

      {/* System wifi info */}
      <View className="pt-2 mt-2">
        <Text className="text-xs text-gray-600 dark:text-gray-400">
          {`${t('order.wifi', 'Wifi')}: ${order?.invoice?.wifiName ?? 'Trendcoffee'} - Mật khẩu: ${order?.invoice?.wifiPassword ?? 'Trendcoffee'}`}
        </Text>
      </View>
    </ScrollView>
  )
})
