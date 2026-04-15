import { IUserInfo } from '@/types'
import dayjs from 'dayjs'

import { type GetFn, type SetFn } from '../update-order-flow.types'

export function createUpdatingCustomerMethods(set: SetFn, get: GetFn) {
  return {
    updateDraftCustomer: (customer: IUserInfo) => {
      const { updatingData } = get()
      if (!updatingData) return

      const fullName =
        `${customer.firstName || ''} ${customer.lastName || ''}`.trim()

      set({
        updatingData: {
          ...updatingData,
          updateDraft: {
            ...updatingData.updateDraft,
            owner: customer.slug,
            ownerFullName: fullName,
            ownerPhoneNumber: customer.phonenumber,
            ownerRole: customer.role.name,
            approvalBy: customer.slug,
          },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    removeDraftCustomer: () => {
      const { updatingData } = get()
      if (!updatingData) return

      const requiresVerification =
        updatingData.updateDraft.voucher?.isVerificationIdentity === true

      set({
        updatingData: {
          ...updatingData,
          updateDraft: {
            ...updatingData.updateDraft,
            owner: '',
            ownerFullName: '',
            ownerPhoneNumber: '',
            ownerRole: '',
            voucher: requiresVerification
              ? null
              : updatingData.updateDraft.voucher,
          },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    setDraftApprovalBy: (approvalBy: string) => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: { ...updatingData.updateDraft, approvalBy },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    setDraftDescription: (description: string) => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: { ...updatingData.updateDraft, description },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    setDraftPaymentMethod: (method: string) => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: { ...updatingData.updateDraft, paymentMethod: method },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },
  }
}
