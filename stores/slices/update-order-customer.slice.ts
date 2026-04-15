import {
  IOrderOwner,
  IOriginalOrderStore,
  IUpdateOrderStore,
  OrderStatus,
} from '@/types'

type DraftSetFn = (partial: Partial<IUpdateOrderStore>) => void
type DraftGetFn = () => IUpdateOrderStore

type OrigSetFn = (partial: Partial<IOriginalOrderStore>) => void
type OrigGetFn = () => IOriginalOrderStore

export function createUpdateOrderCustomerMethods(
  set: DraftSetFn,
  get: DraftGetFn,
) {
  return {
    addCustomerInfo: (owner: IOrderOwner) => {
      const { orderItems } = get()
      if (orderItems) {
        const hasFirstName = owner.firstName && owner.firstName.trim() !== ''
        const hasLastName = owner.lastName && owner.lastName.trim() !== ''
        const ownerFullName =
          hasFirstName || hasLastName
            ? `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim()
            : ''
        const userRole = owner.role?.name || ''
        set({
          orderItems: {
            ...orderItems,
            owner: owner.slug,
            ownerPhoneNumber: owner.phonenumber,
            ownerFullName,
            ownerRole: userRole,
          },
        })
      }
    },

    removeCustomerInfo: () => {
      const { orderItems } = get()
      if (orderItems) {
        const requiresVerification =
          orderItems.voucher?.isVerificationIdentity === true
        set({
          orderItems: {
            ...orderItems,
            owner: '',
            ownerFullName: '',
            ownerPhoneNumber: '',
            ownerRole: '',
            voucher: requiresVerification ? null : orderItems.voucher,
          },
        })
      }
    },

    addStatus: (status: OrderStatus) => {
      const { orderItems } = get()
      if (orderItems) {
        set({ orderItems: { ...orderItems, status } })
      }
    },

    removeStatus: () => {
      const { orderItems } = get()
      if (orderItems) {
        set({ orderItems: { ...orderItems, status: OrderStatus.PENDING } })
      }
    },

    addApprovalBy: (approvalBy: string) => {
      const { orderItems } = get()
      if (orderItems) {
        set({ orderItems: { ...orderItems, approvalBy } })
      }
    },
  }
}

export function createOriginalOrderCustomerMethods(
  set: OrigSetFn,
  get: OrigGetFn,
) {
  return {
    addOriginalCustomerInfo: (owner: IOrderOwner) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        const hasFirstName = owner.firstName && owner.firstName.trim() !== ''
        const hasLastName = owner.lastName && owner.lastName.trim() !== ''
        const ownerFullName =
          hasFirstName || hasLastName
            ? `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim()
            : ''
        const userRole = owner.role?.name || ''
        set({
          originalOrderItems: {
            ...originalOrderItems,
            owner: owner.slug,
            ownerPhoneNumber: owner.phonenumber,
            ownerFullName,
            ownerRole: userRole,
          },
        })
      }
    },

    removeOriginalCustomerInfo: () => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        const requiresVerification =
          originalOrderItems.voucher?.isVerificationIdentity === true
        set({
          originalOrderItems: {
            ...originalOrderItems,
            owner: '',
            ownerFullName: '',
            ownerPhoneNumber: '',
            ownerRole: '',
            voucher: requiresVerification ? null : originalOrderItems.voucher,
          },
        })
      }
    },

    addOriginalStatus: (status: OrderStatus) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({ originalOrderItems: { ...originalOrderItems, status } })
      }
    },

    removeOriginalStatus: () => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({
          originalOrderItems: {
            ...originalOrderItems,
            status: OrderStatus.PENDING,
          },
        })
      }
    },

    addOriginalApprovalBy: (approvalBy: string) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({ originalOrderItems: { ...originalOrderItems, approvalBy } })
      }
    },
  }
}
