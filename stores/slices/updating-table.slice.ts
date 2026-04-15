import { ITable, OrderTypeEnum } from '@/types'
import dayjs from 'dayjs'

import { type GetFn, type SetFn } from '../update-order-flow.types'

export function createUpdatingTableMethods(set: SetFn, get: GetFn) {
  return {
    setDraftTable: (table: ITable) => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: {
            ...updatingData.updateDraft,
            timeLeftTakeOut: undefined,
            table: table.slug,
            tableName: table.name,
            type: table.type || OrderTypeEnum.AT_TABLE,
          },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    removeDraftTable: () => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: {
            ...updatingData.updateDraft,
            timeLeftTakeOut: undefined,
            table: '',
            tableName: '',
            type: OrderTypeEnum.AT_TABLE,
          },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    setDraftType: (type: OrderTypeEnum) => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: {
            ...updatingData.updateDraft,
            type,
            ...(type === OrderTypeEnum.TAKE_OUT && {
              table: '',
              tableName: '',
            }),
            ...(type === OrderTypeEnum.AT_TABLE && {
              timeLeftTakeOut: undefined,
            }),
          },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },
  }
}
