/**
 * Voucher validation — pure functions + helpers.
 * No hooks, no React — can be used in any context.
 */
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { IVoucher } from '@/types'
import { formatCurrency, isVoucherApplicableToCartItems } from '@/utils'

dayjs.extend(utc)

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProcessedVoucher = {
  voucher: IVoucher
  isValid: boolean
  errorMessage: string
  /** Pre-computed display strings — avoids recalc in each card render */
  discountLabel: string
  expiryText: string
  minOrderText: string
  usagePercent: number
}

type TFn = (key: string, opts?: Record<string, unknown>) => string

// ─── Validation ──────────────────────────────────────────────────────────────

export function processVoucherList(
  vouchers: IVoucher[],
  opts: {
    cartProductSlugs: string[]
    subTotalAfterPromotion: number
    userSlug: string | undefined
    isCustomerOwner: boolean
    t: TFn
  },
): ProcessedVoucher[] {
  const {
    cartProductSlugs,
    subTotalAfterPromotion,
    userSlug,
    isCustomerOwner,
    t,
  } = opts
  const now = dayjs()
  const sevenAmToday = now.hour(7).minute(0).second(0).millisecond(0)
  const isUserLoggedIn = !!userSlug

  return vouchers.map((v) => {
    const vpSet = new Set(
      v.voucherProducts?.map((vp) => vp.product?.slug).filter(Boolean) ?? [],
    )

    // isValid
    const isActive = v.isActive
    const isExpired = dayjs.utc(v.endDate).add(30, 'minutes').isBefore(now)
    const hasUsage = (v.remainingUsage || 0) > 0
    const isValidAmount =
      v.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT
        ? true
        : (v.minOrderValue || 0) <= subTotalAfterPromotion
    const isValidDate = !dayjs(v.endDate).isBefore(sevenAmToday)
    const requiresLogin = v.isVerificationIdentity === true
    const isIdentityValid = !requiresLogin || isUserLoggedIn
    const hasValidProducts =
      vpSet.size > 0 &&
      cartProductSlugs.length > 0 &&
      isVoucherApplicableToCartItems(
        cartProductSlugs,
        Array.from(vpSet),
        v.applicabilityRule,
      )
    const isValid =
      isActive &&
      !isExpired &&
      hasUsage &&
      isValidAmount &&
      isValidDate &&
      isIdentityValid &&
      hasValidProducts

    // errorMessage
    const allInVoucher = cartProductSlugs.every((s) => vpSet.has(s))
    const anyInVoucher = cartProductSlugs.some((s) => vpSet.has(s))
    const errorChecks = [
      {
        cond: requiresLogin && !isCustomerOwner,
        msg: t('needVerifyIdentity'),
      },
      { cond: isExpired, msg: t('expired') },
      { cond: v.remainingUsage === 0, msg: t('outOfStock') },
      {
        cond:
          v.type !== VOUCHER_TYPE.SAME_PRICE_PRODUCT &&
          v.minOrderValue > subTotalAfterPromotion,
        msg: t('minOrderNotMet'),
      },
      {
        cond:
          vpSet.size > 0 &&
          v.applicabilityRule === APPLICABILITY_RULE.ALL_REQUIRED &&
          !allInVoucher,
        msg: t('requireOnlyApplicableProducts'),
      },
      {
        cond:
          vpSet.size > 0 &&
          v.applicabilityRule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED &&
          !anyInVoucher,
        msg: t('requireSomeApplicableProducts'),
      },
    ]
    const errorMessage = errorChecks.find((e) => e.cond)?.msg || ''

    // E4 — Pre-compute display strings once here, not in each card render
    const discountLabel =
      v.type === VOUCHER_TYPE.PERCENT_ORDER
        ? t('percentDiscount', { value: v.value })
        : v.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT
          ? t('samePriceProduct', { value: formatCurrency(v.value) })
          : t('fixedDiscount', { value: formatCurrency(v.value) })

    const endDiff = dayjs.utc(v.endDate).diff(now, 'second')
    const expiryText =
      endDiff <= 0
        ? t('expiresInHoursMinutes', { hours: 0, minutes: 0 })
        : endDiff < 86400
          ? t('expiresInHoursMinutes', {
              hours: Math.floor(endDiff / 3600),
              minutes: Math.floor((endDiff % 3600) / 60),
            })
          : t('expiresInDaysHoursMinutes', {
              days: Math.floor(endDiff / 86400),
              hours: Math.floor((endDiff % 86400) / 3600),
              minutes: Math.floor((endDiff % 3600) / 60),
            })

    const minOrderText = formatCurrency(v.minOrderValue)
    const usagePercent = Math.min(
      100,
      (v.remainingUsage / Math.max(v.maxUsage, 1)) * 100,
    )

    return {
      voucher: v,
      isValid,
      errorMessage,
      discountLabel,
      expiryText,
      minOrderText,
      usagePercent,
    }
  })
}

// ─── Auto-remove check ───────────────────────────────────────────────────────

export function shouldAutoRemoveVoucher(
  voucher: IVoucher | null,
  voucherProductSet: Set<string>,
  cartProductSlugs: string[],
  nonGiftOrderItems: Array<{
    originalPrice?: number
    promotionDiscount?: number
    quantity: number
    isGift?: boolean
  }>,
): boolean {
  if (!voucher) return false

  const subtotalBeforeVoucher = nonGiftOrderItems.reduce((acc, item) => {
    return (
      acc +
      ((item.originalPrice ?? 0) - (item.promotionDiscount ?? 0)) *
        item.quantity
    )
  }, 0)

  const cartItemQuantity = nonGiftOrderItems.reduce((total, item) => {
    return total + (item.isGift ? 0 : item.quantity || 0)
  }, 0)

  switch (voucher.applicabilityRule) {
    case APPLICABILITY_RULE.ALL_REQUIRED:
      if (cartProductSlugs.some((slug) => !voucherProductSet.has(slug)))
        return true
      break
    case APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED:
      if (!cartProductSlugs.some((slug) => voucherProductSet.has(slug)))
        return true
      break
  }

  if (voucher.type !== VOUCHER_TYPE.SAME_PRICE_PRODUCT) {
    if (subtotalBeforeVoucher < (voucher.minOrderValue || 0)) return true
  }

  if (voucher.maxItems && voucher.maxItems > 0) {
    if (cartItemQuantity > voucher.maxItems) return true
  }

  return false
}

// ─── Condition strings (for condition sheet) ─────────────────────────────────

export function buildVoucherConditions(voucher: IVoucher, t: TFn): string[] {
  const conditions: string[] = []
  const discountLabel =
    voucher.type === VOUCHER_TYPE.PERCENT_ORDER
      ? t('percentDiscount', { value: voucher.value })
      : voucher.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT
        ? t('samePriceProduct', {
            value: formatCurrency(voucher.value),
          })
        : t('fixedDiscount', { value: formatCurrency(voucher.value) })

  conditions.push(`${t('value')}: ${discountLabel}`)
  conditions.push(
    `${t('minOrderValue')}: ${formatCurrency(voucher.minOrderValue)}`,
  )
  conditions.push(
    voucher.isVerificationIdentity
      ? t('requiresAccount')
      : t('noAccountRequired'),
  )
  conditions.push(
    voucher.numberOfUsagePerUser > 0
      ? `${t('numberOfUsagePerUser')}: ${voucher.numberOfUsagePerUser} ${t('usage')}/1 ${t('verificationIdentityType')}`
      : `${t('numberOfUsagePerUser')}: ${t('unlimited')}`,
  )
  if (voucher.voucherProducts?.length > 0) {
    const names = voucher.voucherProducts
      .map((vp) => vp.product?.name || vp.slug)
      .filter(Boolean)
    conditions.push(`${t('products')}: ${names.join(', ')}`)
  } else {
    conditions.push(`${t('products')}: ${t('allProducts')}`)
  }
  if (voucher.voucherPaymentMethods?.length > 0) {
    const pmMap: Record<string, string> = {
      cash: t('paymentMethod.cash'),
      'bank-transfer': t('paymentMethod.bankTransfer'),
      point: t('paymentMethod.point'),
      'credit-card': t('paymentMethod.creditCard'),
    }
    conditions.push(
      `${t('paymentMethods')}: ${voucher.voucherPaymentMethods.map((pm) => pmMap[pm.paymentMethod] ?? pm.paymentMethod).join(', ')}`,
    )
  }
  return conditions
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Cap voucher list to avoid memory growth */
const MAX_LOCAL_VOUCHER_ITEMS = 50

export function truncateVoucherList(
  list: IVoucher[],
  max = MAX_LOCAL_VOUCHER_ITEMS,
): IVoucher[] {
  return list.length <= max ? list : list.slice(0, max)
}
