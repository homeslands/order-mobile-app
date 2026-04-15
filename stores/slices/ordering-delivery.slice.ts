/**
 * Ordering Delivery Slice — manage delivery address, phone, coords.
 * Extracted from order-flow.store.ts to reduce file size.
 */
import dayjs from 'dayjs'

import type { IOrderFlowStore } from '../order-flow.types'

type SetFn = (partial: Partial<IOrderFlowStore>) => void
type GetFn = () => IOrderFlowStore

export function createOrderingDeliveryMethods(set: SetFn, get: GetFn) {
  return {
    setDeliveryAddress: (address: string) => {
      const { orderingData } = get()
      if (!orderingData) return

      set({
        orderingData: {
          ...orderingData,
          deliveryAddress: address,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    setDeliveryDistanceDuration: (distance: number, duration: number) => {
      const { orderingData } = get()
      if (!orderingData) return

      set({
        orderingData: {
          ...orderingData,
          deliveryDistance: distance,
          deliveryDuration: duration,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    setDeliveryPhone: (phone: string) => {
      const { orderingData } = get()
      if (!orderingData) return

      set({
        orderingData: {
          ...orderingData,
          deliveryPhone: phone,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    setDeliveryCoords: (lat: number, lng: number, placeId?: string) => {
      const { orderingData } = get()
      if (!orderingData) return

      set({
        orderingData: {
          ...orderingData,
          deliveryLat: lat,
          deliveryLng: lng,
          deliveryPlaceId: placeId || orderingData.deliveryPlaceId || '',
        },
        lastModified: dayjs().valueOf(),
      })
    },

    setDeliveryPlaceId: (placeId: string) => {
      const { orderingData } = get()
      if (!orderingData) return

      set({
        orderingData: {
          ...orderingData,
          deliveryPlaceId: placeId,
        },
        lastModified: dayjs().valueOf(),
      })
    },

    clearDeliveryInfo: () => {
      const { orderingData } = get()
      if (!orderingData) return

      set({
        orderingData: {
          ...orderingData,
          deliveryAddress: '',
          deliveryDistance: 0,
          deliveryDuration: 0,
          deliveryLat: undefined,
          deliveryLng: undefined,
          deliveryPlaceId: '',
        },
        lastModified: dayjs().valueOf(),
      })
    },
  }
}
