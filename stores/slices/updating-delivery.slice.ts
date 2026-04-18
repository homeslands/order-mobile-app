import dayjs from 'dayjs'

import { type GetFn, type SetFn } from '../update-order-flow.types'

export function createUpdatingDeliveryMethods(set: SetFn, get: GetFn) {
  return {
    setDraftDeliveryAddress: (address: string) => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: {
            ...updatingData.updateDraft,
            deliveryAddress: address,
          },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    setDraftDeliveryDistanceDuration: (distance: number, duration: number) => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: {
            ...updatingData.updateDraft,
            deliveryDistance: distance,
            deliveryDuration: duration,
          },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    setDraftDeliveryCoords: (lat: number, lng: number, placeId?: string) => {
      const { updatingData } = get()
      if (!updatingData) return

      // Use intermediate variable to avoid excess property check on IOrderToUpdate
      const updatedDraft = {
        ...updatingData.updateDraft,
        deliveryLat: lat,
        deliveryLng: lng,
        deliveryPlaceId: placeId,
      }
      set({
        updatingData: {
          ...updatingData,
          updateDraft: updatedDraft,
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    setDraftDeliveryPlaceId: (placeId: string) => {
      const { updatingData } = get()
      if (!updatingData) return
      const updatedDraft = {
        ...updatingData.updateDraft,
        deliveryPlaceId: placeId,
      }
      set({
        updatingData: {
          ...updatingData,
          updateDraft: {
            ...updatedDraft,
            deliveryPlaceId: placeId,
          },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    setDraftDeliveryPhone: (phone: string) => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: { ...updatingData.updateDraft, deliveryPhone: phone },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    clearDraftDeliveryInfo: () => {
      const { updatingData } = get()
      if (!updatingData) return

      set({
        updatingData: {
          ...updatingData,
          updateDraft: {
            ...updatingData.updateDraft,
            deliveryAddress: '',
            deliveryDistance: 0,
            deliveryDuration: 0,
            deliveryPhone: '',
          },
          hasChanges: true,
        },
        lastModified: dayjs().valueOf(),
      })
    },
  }
}
