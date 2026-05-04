jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
)
jest.mock('@/hooks/use-branch', () => ({ useGetBranchInfoForDelivery: () => ({ data: null, isLoading: false, error: null }) }))

import { renderHook } from '@testing-library/react-native'
import { useOrderTypeOptions } from '@/hooks/use-order-type-options'
import { useGetSystemFeatureFlagsByGroup } from '@/hooks'
import { useOrderFlowStore, useUserStore } from '@/stores'
import { SystemLockFeatureChild, SystemLockFeatureType } from '@/constants'
import { OrderTypeEnum } from '@/types'

jest.mock('@/hooks', () => ({
  useGetSystemFeatureFlagsByGroup: jest.fn(),
}))
jest.mock('@/stores', () => ({
  useOrderFlowStore: jest.fn(),
  useUserStore: jest.fn(),
}))

const mockFeatureFlags = [
  {
    name: SystemLockFeatureType.CREATE_PRIVATE,
    isLocked: false,
    children: [
      { name: SystemLockFeatureChild.AT_TABLE, isLocked: false },
      { name: SystemLockFeatureChild.TAKE_OUT, isLocked: false },
      { name: SystemLockFeatureChild.DELIVERY, isLocked: false },
    ],
  },
]

beforeEach(() => {
  ;(useGetSystemFeatureFlagsByGroup as jest.Mock).mockReturnValue({
    data: { result: mockFeatureFlags },
  })
  ;(useOrderFlowStore as unknown as jest.Mock).mockImplementation((sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      setOrderingType: jest.fn(),
      getCartItems: () => ({ type: OrderTypeEnum.AT_TABLE }),
    }),
  )
  ;(useUserStore as unknown as jest.Mock).mockImplementation((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ userInfo: { slug: 'u1', role: { name: 'CUSTOMER' } } }),
  )
})

describe('useOrderTypeOptions — DELIVERY', () => {
  it('includes DELIVERY option when user is logged in and feature is unlocked', () => {
    const { result } = renderHook(() => useOrderTypeOptions({ enabled: true }))
    const values = result.current.orderTypes.map((t) => t.value)
    expect(values).toContain(OrderTypeEnum.DELIVERY)
  })

  it('does NOT include DELIVERY when user is not logged in', () => {
    ;(useUserStore as unknown as jest.Mock).mockImplementation((sel: (s: Record<string, unknown>) => unknown) =>
      sel({ userInfo: null }),
    )
    const { result } = renderHook(() => useOrderTypeOptions({ enabled: true }))
    const values = result.current.orderTypes.map((t) => t.value)
    expect(values).not.toContain(OrderTypeEnum.DELIVERY)
  })
})
