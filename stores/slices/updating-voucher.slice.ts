import { IVoucher } from '@/types'
import dayjs from 'dayjs'

import { type GetFn, type SetFn } from '../update-order-flow.types'

export function createUpdatingVoucherMethods(set: SetFn, get: GetFn) {
  return {
    setDraftVoucher: (voucher: IVoucher | null) => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: { ...updatingData.updateDraft, voucher },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    removeDraftVoucher: () => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: { ...updatingData.updateDraft, voucher: null },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },
  }
}
