// Tests the slice-level setDraftType delivery-clearing behavior.
// Uses createUpdatingTableMethods directly — no store hydration needed.

import { createUpdatingTableMethods } from '@/stores/slices/updating-table.slice'
import {
  type GetFn,
  type IUpdateOrderFlowStore,
  type SetFn,
} from '@/stores/update-order-flow.types'
import { type IOrder, type IOrderToUpdate, OrderStatus, OrderTypeEnum } from '@/types'

const DELIVERY_DRAFT: IOrderToUpdate = {
  id: 'test',
  slug: 'order-1',
  productSlug: '',
  status: OrderStatus.PENDING,
  type: OrderTypeEnum.DELIVERY,
  orderItems: [],
  table: '',
  tableName: '',
  paymentMethod: '',
  owner: '',
  ownerFullName: '',
  ownerPhoneNumber: '',
  ownerRole: '',
  voucher: null,
  description: '',
  approvalBy: '',
  deliveryAddress: '123 Main St',
  deliveryPhone: '0901234567',
  deliveryLat: 10.77,
  deliveryLng: 106.7,
  deliveryPlaceId: 'place-123',
  deliveryDistance: 2.5,
  deliveryDuration: 15,
}

function makeStore(draft: IOrderToUpdate = DELIVERY_DRAFT) {
  let state = {
    updatingData: {
      originalOrder: null as unknown as IOrder,
      hasChanges: false,
      updateDraft: draft,
    },
    lastModified: 0,
    isHydrated: true,
  }
  const set: SetFn = jest.fn((partial) => {
    state = { ...state, ...(partial as Partial<typeof state>) }
  })
  const get: GetFn = () => state as unknown as IUpdateOrderFlowStore
  const methods = createUpdatingTableMethods(set, get)
  return { methods, get, set }
}

describe('setDraftType — delivery clearing', () => {
  it('clears delivery fields when switching to AT_TABLE', () => {
    const { methods, get } = makeStore()
    methods.setDraftType(OrderTypeEnum.AT_TABLE)
    const draft = get().updatingData?.updateDraft
    expect(draft?.deliveryAddress).toBe('')
    expect(draft?.deliveryPhone).toBe('')
    expect(draft?.deliveryLat).toBeUndefined()
    expect(draft?.deliveryLng).toBeUndefined()
    expect(draft?.deliveryPlaceId).toBe('')
    expect(draft?.deliveryDistance).toBe(0)
    expect(draft?.deliveryDuration).toBe(0)
  })

  it('clears delivery fields when switching to TAKE_OUT', () => {
    const { methods, get } = makeStore()
    methods.setDraftType(OrderTypeEnum.TAKE_OUT)
    const draft = get().updatingData?.updateDraft
    expect(draft?.deliveryAddress).toBe('')
    expect(draft?.deliveryPhone).toBe('')
    expect(draft?.deliveryLat).toBeUndefined()
    expect(draft?.deliveryLng).toBeUndefined()
    expect(draft?.deliveryPlaceId).toBe('')
    expect(draft?.deliveryDistance).toBe(0)
    expect(draft?.deliveryDuration).toBe(0)
  })

  it('preserves delivery fields when type stays DELIVERY', () => {
    const { methods, get } = makeStore()
    methods.setDraftType(OrderTypeEnum.DELIVERY)
    const draft = get().updatingData?.updateDraft
    expect(draft?.deliveryAddress).toBe('123 Main St')
    expect(draft?.deliveryPhone).toBe('0901234567')
    expect(draft?.deliveryLat).toBe(10.77)
  })

  it('clears table/tableName when switching to TAKE_OUT', () => {
    const { methods, get } = makeStore({ ...DELIVERY_DRAFT, table: 'table-1', tableName: 'T1' })
    methods.setDraftType(OrderTypeEnum.TAKE_OUT)
    const draft = get().updatingData?.updateDraft
    expect(draft?.table).toBe('')
    expect(draft?.tableName).toBe('')
  })

  it('returns early without crashing when updatingData is null', () => {
    const state = {
      updatingData: null,
      lastModified: 0,
      isHydrated: true,
    } as unknown as IUpdateOrderFlowStore
    const set: SetFn = jest.fn()
    const get: GetFn = () => state
    const { setDraftType } = createUpdatingTableMethods(set, get)
    expect(() => setDraftType(OrderTypeEnum.AT_TABLE)).not.toThrow()
    expect(set).not.toHaveBeenCalled()
  })
})
