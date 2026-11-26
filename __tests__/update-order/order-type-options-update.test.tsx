// Sheet loại đơn khi sửa đơn phải theo cờ khoá loại đơn của hệ thống (trước
// luôn hiện đủ 3 loại). Nhưng KHÔNG tự đổi loại của đơn đang sửa: lúc cờ
// đang tải danh sách rỗng, tự đổi sẽ biến đơn giao hàng thành tại bàn.
jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return
  require('react-native-reanimated/mock'),
)

import { renderHook } from '@testing-library/react-native'

import { SystemLockFeatureChild, SystemLockFeatureType } from '@/constants'
import { useGetSystemFeatureFlagsByGroup } from '@/hooks'
import { useOrderTypeOptionsForUpdateOrder } from '@/hooks/use-order-type-options-for-update-order'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
jest.mock('@/hooks', () => ({
  useGetSystemFeatureFlagsByGroup: jest.fn(),
}))
jest.mock('@/stores', () => ({
  useOrderFlowStore: jest.fn(),
}))

const setDraftType = jest.fn()

function flags(locked: Partial<Record<string, boolean>>) {
  return {
    data: {
      result: [
        {
          name: SystemLockFeatureType.CREATE_PRIVATE,
          isLocked: false,
          children: [
            SystemLockFeatureChild.AT_TABLE,
            SystemLockFeatureChild.TAKE_OUT,
            SystemLockFeatureChild.DELIVERY,
          ].map((name) => ({ name, isLocked: locked[name] ?? false })),
        },
      ],
    },
  }
}

beforeEach(() => {
  setDraftType.mockClear()
  ;(useOrderFlowStore as unknown as jest.Mock).mockImplementation(
    (sel: (s: Record<string, unknown>) => unknown) =>
      sel({
        setDraftType,
        updatingData: { updateDraft: { type: OrderTypeEnum.DELIVERY } },
      }),
  )
})

it('OT1 bỏ loại đơn bị khoá', () => {
  ;(useGetSystemFeatureFlagsByGroup as jest.Mock).mockReturnValue(
    flags({ [SystemLockFeatureChild.TAKE_OUT]: true }),
  )
  const { result } = renderHook(() => useOrderTypeOptionsForUpdateOrder())
  expect(result.current.orderTypes.map((o) => o.value)).toEqual([
    OrderTypeEnum.AT_TABLE,
    OrderTypeEnum.DELIVERY,
  ])
})

it('OT2 cờ đang tải: hiện đủ 3 loại, không tự đổi loại đơn', () => {
  ;(useGetSystemFeatureFlagsByGroup as jest.Mock).mockReturnValue({
    data: undefined,
  })
  const { result } = renderHook(() => useOrderTypeOptionsForUpdateOrder())
  expect(result.current.orderTypes).toHaveLength(3)
  expect(setDraftType).not.toHaveBeenCalled()
})

it('OT3 loại đơn đang sửa bị khoá: không tự đổi (khách tự chọn)', () => {
  ;(useGetSystemFeatureFlagsByGroup as jest.Mock).mockReturnValue(
    flags({ [SystemLockFeatureChild.DELIVERY]: true }),
  )
  renderHook(() => useOrderTypeOptionsForUpdateOrder())
  expect(setDraftType).not.toHaveBeenCalled()
})

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})
