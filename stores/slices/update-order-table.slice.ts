import dayjs from 'dayjs'
import {
  IOriginalOrderStore,
  ITable,
  IUpdateOrderStore,
  OrderStatus,
  OrderTypeEnum,
} from '@/types'

type DraftSetFn = (partial: Partial<IUpdateOrderStore>) => void
type DraftGetFn = () => IUpdateOrderStore

type OrigSetFn = (partial: Partial<IOriginalOrderStore>) => void
type OrigGetFn = () => IOriginalOrderStore

export function createUpdateOrderTableMethods(
  set: DraftSetFn,
  get: DraftGetFn,
) {
  return {
    addTable: (table: ITable) => {
      const { orderItems } = get()
      const orderStatus = orderItems ? orderItems.status : OrderStatus.PENDING
      const timestamp = dayjs().valueOf()

      if (!orderItems) {
        set({
          orderItems: {
            id: `cart_${timestamp}`,
            slug: `cart_${timestamp}`,
            productSlug: '',
            owner: '',
            status: orderStatus,
            type: OrderTypeEnum.AT_TABLE,
            orderItems: [],
            table: table.slug,
            tableName: table.name,
            voucher: null,
            approvalBy: '',
            ownerPhoneNumber: '',
            ownerFullName: '',
          },
        })
      } else {
        set({
          orderItems: {
            ...orderItems,
            table: table.slug,
            tableName: table.name,
          },
        })
      }
    },

    removeTable: () => {
      const { orderItems } = get()
      if (orderItems) {
        set({ orderItems: { ...orderItems, table: '', tableName: '' } })
      }
    },

    addOrderType: (orderType: OrderTypeEnum) => {
      const { orderItems } = get()
      if (orderItems) {
        set({ orderItems: { ...orderItems, type: orderType } })
      }
    },
  }
}

export function createOriginalOrderTableMethods(
  set: OrigSetFn,
  get: OrigGetFn,
) {
  return {
    addOriginalTable: (table: ITable) => {
      const { originalOrderItems } = get()
      const orderStatus = originalOrderItems
        ? originalOrderItems.status
        : OrderStatus.PENDING
      const timestamp = dayjs().valueOf()

      if (!originalOrderItems) {
        set({
          originalOrderItems: {
            id: `cart_${timestamp}`,
            slug: `cart_${timestamp}`,
            productSlug: '',
            owner: '',
            status: orderStatus,
            type: OrderTypeEnum.AT_TABLE,
            orderItems: [],
            table: table.slug,
            tableName: table.name,
            voucher: null,
            approvalBy: '',
            ownerPhoneNumber: '',
            ownerFullName: '',
          },
        })
      } else {
        set({
          originalOrderItems: {
            ...originalOrderItems,
            table: table.slug,
            tableName: table.name,
          },
        })
      }
    },

    removeOriginalTable: () => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({
          originalOrderItems: {
            ...originalOrderItems,
            table: '',
            tableName: '',
          },
        })
      }
    },

    addOriginalOrderType: (orderType: OrderTypeEnum) => {
      const { originalOrderItems } = get()
      if (originalOrderItems) {
        set({ originalOrderItems: { ...originalOrderItems, type: orderType } })
      }
    },
  }
}
