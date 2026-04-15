import {
  CircleDollarSign,
  Coins,
  Coins as CoinsIcon,
  CreditCard,
  Smartphone,
} from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, useColorScheme, View } from 'react-native'

import { RadioGroup } from '@/components/ui'
import { PaymentMethod, Role } from '@/constants'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/stores'
import { IOrder, IUserInfo } from '@/types'
import { formatCurrency } from '@/utils'

import { PaymentMethodOption } from './payment-method-option'

// ─── Pure helpers (no React deps) ────────────────────────────────────────────

function computeAvailableMethods(
  userInfo: IUserInfo | null,
  disabledMethods?: PaymentMethod[],
): PaymentMethod[] {
  const methods: PaymentMethod[] = [PaymentMethod.BANK_TRANSFER]
  if (userInfo && userInfo.role.name !== Role.CUSTOMER) {
    methods.push(PaymentMethod.CASH, PaymentMethod.CREDIT_CARD)
  }
  if (userInfo && userInfo.role.name === Role.CUSTOMER) {
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
  const isBalanceInsufficient =
    userInfo?.role?.name === Role.CUSTOMER && balance < orderSubtotal
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<string>('')
  const [creditCardTransactionId, setCreditCardTransactionId] =
    useState<string>('')

  const voucherPaymentMethods = useMemo(
    () => order?.voucher?.voucherPaymentMethods || [],
    [order?.voucher?.voucherPaymentMethods],
  )

  const isNonCustomer =
    userInfo && userInfo.role.name !== Role.CUSTOMER
  const isCustomer =
    userInfo && userInfo.role.name === Role.CUSTOMER

  // Memoize available methods once — reused in both support check and auto-select
  const availableMethods = useMemo(
    () => computeAvailableMethods(userInfo, disabledMethods),
    [userInfo, disabledMethods],
  )

  // Single memoized computation — replaces 6 cascaded hooks
  const {
    bankTransferSupported,
    creditCardSupported,
    cashSupported,
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
      [PaymentMethod.BANK_TRANSFER]: t('paymentMethod.bankTransfer', 'Chuyển khoản'),
      [PaymentMethod.CASH]: t('paymentMethod.cash', 'Tiền mặt'),
      [PaymentMethod.POINT]: t('paymentMethod.coin', 'Điểm tích lũy'),
      [PaymentMethod.CREDIT_CARD]: t('paymentMethod.creditCard', 'Thẻ tín dụng'),
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
  }, [availableMethods, order?.voucher, voucherPaymentMethods, t, isBalanceInsufficient])

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

      if (onSelect) {
        onSelect(paymentMethod, paymentMethod === PaymentMethod.CREDIT_CARD ? creditCardTransactionId : undefined)
      }
      if (onSubmit) {
        if (paymentMethod === PaymentMethod.CREDIT_CARD) {
          onSubmit(paymentMethod, creditCardTransactionId)
        } else {
          onSubmit(paymentMethod)
        }
      }
    },
    [onSubmit, onSelect, creditCardTransactionId],
  )

  const handleTransactionIdChange = useCallback(
    (transactionId: string) => {
      setCreditCardTransactionId(transactionId)
      if (selectedPaymentMethod === PaymentMethod.CREDIT_CARD) {
        if (onSelect) onSelect(PaymentMethod.CREDIT_CARD, transactionId)
        if (onSubmit) onSubmit(PaymentMethod.CREDIT_CARD, transactionId)
      }
    },
    [selectedPaymentMethod, onSubmit, onSelect],
  )

  const handleSelectMethod = useCallback(
    (method: PaymentMethod) => {
      handlePaymentMethodChange(method)
    },
    [handlePaymentMethodChange],
  )

  const getDisabledReason = useCallback(
    (method: PaymentMethod) => {
      if (
        method === PaymentMethod.POINT &&
        isBalanceInsufficient
      ) {
        return t(
          'paymentMethod.insufficientCoinBalance',
          'Không đủ xu (cần {{required}}, có {{available}})',
          {
            required: formatCurrency(orderSubtotal, ''),
            available: formatCurrency(balance, ''),
          },
        )
      }
      return (
        disabledReasons?.[method] ||
        t('paymentMethod.voucherNotSupport')
      )
    },
    [disabledReasons, t, isBalanceInsufficient, orderSubtotal, balance],
  )

  // Returns a conflict handler only for methods blocked by voucher (not by role/disabledMethods)
  const makeConflictHandler = useCallback(
    (method: PaymentMethod): ((m: PaymentMethod) => void) | undefined => {
      if (!onConflict) return undefined
      if (disabledMethods?.includes(method)) return undefined
      if (!order?.voucher || voucherPaymentMethods.length === 0) return undefined
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
        disabledReason={getDisabledReason(
          PaymentMethod.BANK_TRANSFER,
        )}
        onSelect={handleSelectMethod}
        onSelectDisabled={makeConflictHandler(PaymentMethod.BANK_TRANSFER)}
      />
      {isNonCustomer && (
        <PaymentMethodOption
          method={PaymentMethod.CREDIT_CARD}
          icon={CreditCard}
          label={t('paymentMethod.creditCard')}
          isSupported={creditCardSupported}
          isDark={isDark}
          disabledReason={getDisabledReason(
            PaymentMethod.CREDIT_CARD,
          )}
          onSelect={handleSelectMethod}
          onSelectDisabled={makeConflictHandler(PaymentMethod.CREDIT_CARD)}
          showTransactionInput={
            selectedPaymentMethod === PaymentMethod.CREDIT_CARD
          }
          transactionId={creditCardTransactionId}
          onTransactionIdChange={handleTransactionIdChange}
          transactionPlaceholder={t(
            'paymentMethod.creditCardTransactionIdPlaceholder',
          )}
        />
      )}
      {isNonCustomer && (
        <PaymentMethodOption
          method={PaymentMethod.CASH}
          icon={Coins}
          label={t('paymentMethod.cash')}
          isSupported={cashSupported}
          isDark={isDark}
          disabledReason={getDisabledReason(PaymentMethod.CASH)}
          onSelect={handleSelectMethod}
          onSelectDisabled={makeConflictHandler(PaymentMethod.CASH)}
        />
      )}
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
              'flex-row gap-1 items-center text-xs font-medium pl-2',
              pointSupported ? 'text-primary' : 'text-primary/50',
            )}
          >
            {tProfile('profile.coinBalance')}:{' '}
            {formatCurrency(balance, '')}
            <CoinsIcon
              size={16}
              color={isDark ? '#60a5fa' : '#3b82f6'}
            />
          </Text>
          <Text
            className={cn(
              'text-[10px] pl-2',
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
            <Text className="font-semibold">{order?.voucher?.code}</Text>
            {' '}không hỗ trợ:{' '}
            <Text className="font-semibold">{blockedMethodLabels}</Text>
            . Chọn phương thức này sẽ cần xóa voucher.
          </Text>
        </View>
        {radioGroup}
      </View>
    )
  }

  return radioGroup
}
