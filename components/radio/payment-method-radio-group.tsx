import {
  CircleDollarSign,
  Coins as CoinsIcon,
  Smartphone,
} from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useColorScheme, View } from 'react-native'

import { RadioGroup } from '@/components/ui'
import { PaymentMethod } from '@/constants'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/stores'
import { IOrder, IUserInfo } from '@/types'
import { formatCurrency } from '@/utils'

import { PaymentMethodOption } from './payment-method-option'
import { Text } from '@/components/ui/text'

// ─── Pure helpers (no React deps) ────────────────────────────────────────────

/**
 * Customer-only app: đăng nhập = khách. KHÔNG được gate theo `role.name` —
 * role load bất đồng bộ, ngay sau lần đăng ký+login đầu nó còn rỗng, mà
 * `userInfo.role.name` lại không có optional-chaining → CRASH đúng ở màn thanh
 * toán (bước cuối của flow đăng ký → đặt hàng). Kể cả thêm `?.` cũng sai: role
 * rỗng sẽ rơi vào nhánh "không phải khách" → khách mới bị đẩy Tiền mặt/Thẻ tín
 * dụng và mất Điểm tích luỹ. Nhánh nhân viên đã bỏ vì admin/quản lý không đăng
 * nhập được vào app này.
 */
export function isCustomerUser(userInfo: IUserInfo | null): boolean {
  return !!userInfo && userInfo.phonenumber !== 'default-customer'
}

function computeAvailableMethods(
  userInfo: IUserInfo | null,
  disabledMethods?: PaymentMethod[],
): PaymentMethod[] {
  const methods: PaymentMethod[] = [PaymentMethod.BANK_TRANSFER]
  if (isCustomerUser(userInfo)) {
    methods.push(PaymentMethod.POINT)
  }
  return disabledMethods?.length
    ? methods.filter((m) => !disabledMethods.includes(m))
    : methods
}

const VOUCHER_METHOD_KEY: Record<PaymentMethod, string> = {
  [PaymentMethod.BANK_TRANSFER]: 'bank-transfer',
  [PaymentMethod.CASH]: 'cash',
  [PaymentMethod.POINT]: 'point',
  [PaymentMethod.CREDIT_CARD]: 'credit-card',
}

function isSupportedByVoucher(
  method: PaymentMethod,
  voucherPaymentMethods: Array<{ paymentMethod: string }>,
): boolean {
  return voucherPaymentMethods.some(
    (vpm) => vpm.paymentMethod === VOUCHER_METHOD_KEY[method],
  )
}

interface PaymentMethodRadioGroupProps {
  order?: IOrder
  /** Controlled value — overrides internal state when provided (e.g. after conflict resolution) */
  value?: string | null
  defaultValue: string | null
  disabledMethods?: PaymentMethod[]
  disabledReasons?: Record<PaymentMethod, string>
  onSubmit?: (paymentMethod: PaymentMethod, transactionId?: string) => void
  onSelect?: (paymentMethod: PaymentMethod, transactionId?: string) => void
  /** Called when user taps a method blocked by voucher incompatibility */
  onConflict?: (blockedMethod: PaymentMethod) => void
  /** Coin balance fetched from API — used to disable Point when insufficient */
  coinBalance?: number
}

export default function PaymentMethodRadioGroup({
  order,
  value,
  defaultValue,
  disabledMethods,
  disabledReasons,
  onSubmit,
  onSelect,
  onConflict,
  coinBalance,
}: PaymentMethodRadioGroupProps) {
  const { t } = useTranslation('menu')
  const { t: tProfile } = useTranslation('profile')
  const userInfo = useUserStore((s) => s.userInfo)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const balance = coinBalance ?? userInfo?.balance?.points ?? 0
  const orderSubtotal = order?.subtotal ?? 0
  // Cũng phải theo đăng nhập, không theo role: role rỗng ngay sau đăng ký sẽ
  // khiến check này luôn false → cho chọn "Điểm tích luỹ" dù không đủ điểm.
  const isBalanceInsufficient =
    isCustomerUser(userInfo) && balance < orderSubtotal
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')

  const voucherPaymentMethods = useMemo(
    () => order?.voucher?.voucherPaymentMethods || [],
    [order?.voucher?.voucherPaymentMethods],
  )

  const isCustomer = isCustomerUser(userInfo)

  // Memoize available methods once — reused in both support check and auto-select
  const availableMethods = useMemo(
    () => computeAvailableMethods(userInfo, disabledMethods),
    [userInfo, disabledMethods],
  )

  // Single memoized computation — replaces 6 cascaded hooks
  const {
    bankTransferSupported,
    pointSupported,
    hasCompatiblePaymentMethod,
    hasBlockedMethods,
    blockedMethodLabels,
  } = useMemo(() => {
    const available = availableMethods
    const hasVoucher = !!order?.voucher && voucherPaymentMethods.length > 0
    const isSupported = (method: PaymentMethod) => {
      if (!available.includes(method)) return false
      if (!hasVoucher) return true
      return isSupportedByVoucher(method, voucherPaymentMethods)
    }
    const blocked = hasVoucher
      ? available.filter((m) => !isSupportedByVoucher(m, voucherPaymentMethods))
      : []
    const labelMap: Record<PaymentMethod, string> = {
      [PaymentMethod.BANK_TRANSFER]: t(
        'paymentMethod.bankTransfer',
        'Chuyển khoản',
      ),
      [PaymentMethod.CASH]: t('paymentMethod.cash', 'Tiền mặt'),
      [PaymentMethod.POINT]: t('paymentMethod.coin', 'Điểm tích lũy'),
      [PaymentMethod.CREDIT_CARD]: t(
        'paymentMethod.creditCard',
        'Thẻ tín dụng',
      ),
    }
    return {
      bankTransferSupported: isSupported(PaymentMethod.BANK_TRANSFER),
      creditCardSupported: isSupported(PaymentMethod.CREDIT_CARD),
      cashSupported: isSupported(PaymentMethod.CASH),
      pointSupported:
        isSupported(PaymentMethod.POINT) && !isBalanceInsufficient,
      hasCompatiblePaymentMethod: hasVoucher
        ? available.some((m) => isSupportedByVoucher(m, voucherPaymentMethods))
        : available.length > 0,
      hasBlockedMethods: blocked.length > 0,
      blockedMethodLabels: blocked.map((m) => labelMap[m]).join(', '),
    }
  }, [
    availableMethods,
    order?.voucher,
    voucherPaymentMethods,
    t,
    isBalanceInsufficient,
  ])

  // Auto-select method mặc định khi mount: giao role-methods × voucher-methods, pick first
  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (autoSelectedRef.current || defaultValue) return
    autoSelectedRef.current = true

    const vpmList = order?.voucher?.voucherPaymentMethods ?? []
    let candidates = availableMethods
    if (vpmList.length > 0) {
      candidates = availableMethods.filter((m) =>
        isSupportedByVoucher(m, vpmList),
      )
    }

    if (candidates.length > 0) {
      const first = candidates[0]
      setSelectedPaymentMethod(first)
      if (onSelect) onSelect(first)
      if (onSubmit) onSubmit(first)
    }
    // Chỉ chạy một lần khi mount — deps cố tình để trống
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // value prop (controlled từ parent) takes precedence; fallback về internal state hoặc defaultValue
  const currentValue = value ?? (selectedPaymentMethod || defaultValue || '')

  const handlePaymentMethodChange = useCallback(
    (value: string) => {
      const paymentMethod = value as PaymentMethod
      setSelectedPaymentMethod(paymentMethod)

      // transactionId chỉ dành cho CREDIT_CARD — phương thức này không còn được
      // chào ra nữa (chỉ nhân viên mới dùng), nên luôn undefined.
      if (onSelect) onSelect(paymentMethod)
      if (onSubmit) onSubmit(paymentMethod)
    },
    [onSubmit, onSelect],
  )

  const handleSelectMethod = useCallback(
    (method: PaymentMethod) => {
      handlePaymentMethodChange(method)
    },
    [handlePaymentMethodChange],
  )

  const getDisabledReason = useCallback(
    (method: PaymentMethod) => {
      if (method === PaymentMethod.POINT && isBalanceInsufficient) {
        return t(
          'paymentMethod.insufficientCoinBalance',
          'Không đủ xu (cần {{required}}, có {{available}})',
          {
            required: formatCurrency(orderSubtotal, ''),
            available: formatCurrency(balance, ''),
          },
        )
      }
      return disabledReasons?.[method] || t('paymentMethod.voucherNotSupport')
    },
    [disabledReasons, t, isBalanceInsufficient, orderSubtotal, balance],
  )

  // Returns a conflict handler only for methods blocked by voucher (not by role/disabledMethods)
  const makeConflictHandler = useCallback(
    (method: PaymentMethod): ((m: PaymentMethod) => void) | undefined => {
      if (!onConflict) return undefined
      if (disabledMethods?.includes(method)) return undefined
      if (!order?.voucher || voucherPaymentMethods.length === 0)
        return undefined
      return onConflict
    },
    [onConflict, disabledMethods, order?.voucher, voucherPaymentMethods],
  )

  const radioGroup = (
    <RadioGroup
      value={currentValue}
      className="gap-6"
      onValueChange={handlePaymentMethodChange}
    >
      <PaymentMethodOption
        method={PaymentMethod.BANK_TRANSFER}
        icon={Smartphone}
        label={t('paymentMethod.bankTransfer')}
        isSupported={bankTransferSupported}
        isDark={isDark}
        disabledReason={getDisabledReason(PaymentMethod.BANK_TRANSFER)}
        onSelect={handleSelectMethod}
        onSelectDisabled={makeConflictHandler(PaymentMethod.BANK_TRANSFER)}
      />
      {isCustomer && (
        <PaymentMethodOption
          method={PaymentMethod.POINT}
          icon={CircleDollarSign}
          label={t('paymentMethod.coin')}
          isSupported={pointSupported}
          isDark={isDark}
          disabledReason={getDisabledReason(PaymentMethod.POINT)}
          onSelect={handleSelectMethod}
          onSelectDisabled={makeConflictHandler(PaymentMethod.POINT)}
          pointLayout
        >
          <Text
            className={cn(
              'flex-row items-center gap-1 pl-2 text-xs font-medium',
              pointSupported ? 'text-primary' : 'text-primary/50',
            )}
          >
            {tProfile('profile.coinBalance')}: {formatCurrency(balance, '')}
            <CoinsIcon size={16} color={isDark ? '#60a5fa' : '#3b82f6'} />
          </Text>
          <Text
            className={cn(
              'pl-2 text-[10px]',
              pointSupported
                ? 'text-gray-400 dark:text-gray-500'
                : 'text-gray-300 dark:text-gray-600',
            )}
          >
            {t(
              'paymentMethod.coinNote',
              'Xu từ gift card, dùng thanh toán toàn bộ đơn hàng',
            )}
          </Text>
        </PaymentMethodOption>
      )}
    </RadioGroup>
  )

  if (!hasCompatiblePaymentMethod) {
    return (
      <View className="flex-col gap-4">
        <View className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-medium text-orange-800 dark:text-orange-200">
              ⚠️{' '}
              {t(
                'paymentMethod.voucherNotCompatible',
                'Voucher không tương thích với phương thức thanh toán hiện có',
              )}
            </Text>
          </View>
          <Text className="mt-1 text-xs text-orange-600 dark:text-orange-300">
            {t('paymentMethod.voucherNotCompatible')}{' '}
            {voucherPaymentMethods
              .map((vpm) => {
                switch (vpm.paymentMethod) {
                  case 'cash':
                    return t('paymentMethod.cash')
                  case 'bank-transfer':
                    return t('paymentMethod.bankTransfer')
                  case 'point':
                    return t('paymentMethod.coin')
                  case 'credit-card':
                    return t('paymentMethod.creditCard')
                  default:
                    return vpm.paymentMethod
                }
              })
              .join(', ')}
            , {t('paymentMethod.butYouCanUse')}{' '}
            {availableMethods
              .map((method: PaymentMethod) => {
                switch (method) {
                  case PaymentMethod.CASH:
                    return t('paymentMethod.cash')
                  case PaymentMethod.BANK_TRANSFER:
                    return t('paymentMethod.bankTransfer')
                  case PaymentMethod.POINT:
                    return t('paymentMethod.coin')
                  case PaymentMethod.CREDIT_CARD:
                    return t('paymentMethod.creditCard')
                  default:
                    return method
                }
              })
              .join(', ')}
          </Text>
        </View>
        {radioGroup}
      </View>
    )
  }

  // Có method khả dụng nhưng voucher chặn một số → hiện warning nhẹ
  if (hasBlockedMethods) {
    return (
      <View className="flex-col gap-4">
        <View className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/20">
          <Text className="text-xs text-amber-700 dark:text-amber-300">
            ⚠️ Voucher{' '}
            <Text className="font-semibold">{order?.voucher?.code}</Text> không
            hỗ trợ: <Text className="font-semibold">{blockedMethodLabels}</Text>
            . Chọn phương thức này sẽ cần xóa voucher.
          </Text>
        </View>
        {radioGroup}
      </View>
    )
  }

  return radioGroup
}
