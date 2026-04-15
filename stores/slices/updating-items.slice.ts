import { IOrderItem } from '@/types'
import dayjs from 'dayjs'

import {
  generateOrderItemId,
  type GetFn,
  type SetFn,
} from '../update-order-flow.types'

export function createUpdatingItemsMethods(set: SetFn, get: GetFn) {
  return {
    updateDraftItem: (itemId: string, changes: Partial<IOrderItem>) => {
      const { updatingData } = get()
      if (!updatingData) return

      const updatedItems = updatingData.updateDraft.orderItems.map((item) =>
        item.id === itemId ? { ...item, ...changes } : item,
      )

      set({
        updatingData: {
          ...updatingData,
          updateDraft: { ...updatingData.updateDraft, orderItems: updatedItems },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    updateDraftItemQuantity: (itemId: string, quantity: number) => {
      const { updatingData } = get()
      if (!updatingData) return

      const updatedItems = updatingData.updateDraft.orderItems.map((item) =>
        item.id === itemId ? { ...item, quantity } : item,
      )

      set({
        updatingData: {
          ...updatingData,
          updateDraft: { ...updatingData.updateDraft, orderItems: updatedItems },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    addDraftItem: (item: IOrderItem) => {
      const { updatingData } = get()
      if (!updatingData) return

      const tempId = generateOrderItemId()
      const newItem = { ...item, slug: tempId, id: tempId }

      set({
        updatingData: {
          ...updatingData,
          updateDraft: {
            ...updatingData.updateDraft,
            orderItems: [...updatingData.updateDraft.orderItems, newItem],
          },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    removeDraftItem: (itemId: string) => {
      const { updatingData } = get()
      if (!updatingData) return

      const updatedItems = updatingData.updateDraft.orderItems.filter(
        (item) => item.id !== itemId,
      )

      set({
        updatingData: {
          ...updatingData,
          updateDraft: { ...updatingData.updateDraft, orderItems: updatedItems },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    addDraftPickupTime: (time: number) => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: { ...updatingData.updateDraft, timeLeftTakeOut: time },
        },
        lastModified: dayjs().valueOf(),
      })
    },

    removeDraftPickupTime: () => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: {
            ...updatingData.updateDraft,
            timeLeftTakeOut: undefined,
          },
        },
        lastModified: dayjs().valueOf(),
      })
    },

    addDraftNote: (itemId: string, note: string) => {
      const { updatingData } = get()
      if (!updatingData) return

      const updatedItems = updatingData.updateDraft.orderItems.map((item) =>
        item.id === itemId ? { ...item, note } : item,
      )

      set({
        updatingData: {
          ...updatingData,
          updateDraft: { ...updatingData.updateDraft, orderItems: updatedItems },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },
  }
}
