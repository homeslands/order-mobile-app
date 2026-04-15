import { IOriginalOrderStore, IUpdateOrderStore, IVoucher } from '@/types'
import { VOUCHER_CUSTOMER_TYPE } from '@/constants'

type DraftSetFn = (partial: Partial<IUpdateOrderStore>) => void
type DraftGetFn = () => IUpdateOrderStore

type OrigSetFn = (partial: Partial<IOriginalOrderStore>) => void
type OrigGetFn = () => IOriginalOrderStore

function buildVoucherPayload(voucher: IVoucher) {
  return {
    voucherGroup: voucher.voucherGroup,
    applicabilityRule: voucher.applicabilityRule,
    createdAt: voucher.createdAt,
    remainingUsage: voucher.remainingUsage || 0,
    startDate: voucher.startDate,
    endDate: voucher.endDate,
    voucherPaymentMethods: voucher.voucherPaymentMethods || [],
    numberOfUsagePerUser: voucher.numberOfUsagePerUser || 0,
    slug: voucher.slug,
    title: voucher.title,
    description: voucher.description || '',
    maxUsage: voucher.maxUsage || 0,
    isActive: voucher.isActive || false,
    maxItems: voucher.maxItems || 0,
    usageFrequencyUnit: voucher.usageFrequencyUnit || '',
    usageFrequencyValue: voucher.usageFrequencyValue || 0,
    value: voucher.value,
    isVerificationIdentity: voucher.isVerificationIdentity || false,
    isPrivate: voucher.isPrivate || false,
    customerType: voucher.customerType || VOUCHER_CUSTOMER_TYPE.ALL,
    code: voucher.code,
    type: voucher.type,
    minOrderValue: voucher.minOrderValue || 0,
    voucherProducts: voucher.voucherProducts || [],
  }
}

export function createUpdateOrderVoucherMethods(
  set: DraftSetFn,
  get: DraftGetFn,
) {
  return {
    addVoucher: (voucher: IVoucher) => {
      const { orderItems } = get()
      if (!orderItems) return
      set({ orderItems: { ...orderItems, voucher: buildVoucherPayload(voucher) } })
    },

    removeVoucher: () => {
      const { orderItems } = get()
      if (!orderItems) return
      set({ orderItems: { ...orderItems, voucher: null } })
    },
  }
}

export function createOriginalOrderVoucherMethods(
  set: OrigSetFn,
  get: OrigGetFn,
) {
  return {
    addOriginalVoucher: (voucher: IVoucher) => {
      const { originalOrderItems } = get()
      if (!originalOrderItems) return
      set({
        originalOrderItems: {
          ...originalOrderItems,
          voucher: buildVoucherPayload(voucher),
        },
      })
    },

    removeOriginalVoucher: () => {
      const { originalOrderItems } = get()
      if (!originalOrderItems) return
      set({ originalOrderItems: { ...originalOrderItems, voucher: null } })
    },
  }
}
