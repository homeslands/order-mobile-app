// Kiểm giá giỏ theo menu hôm nay. Món đổi giá được cập nhật bằng MỘT lần ghi
// store; món bị xoá, thông báo và voucher giữ đúng thứ tự cũ. Lần kiểm tự động
// khi vào giỏ chạy sau chuyển màn; cổng kiểm trước khi đặt hàng giữ nguyên.
import * as fs from 'fs'
import * as path from 'path'

import { act, renderHook } from '@testing-library/react-native'

import { useCartValidation } from '@/hooks/use-cart-validation'

const mockCalls: string[] = []
const mockUpdateVariants = jest.fn()
const mockToast = jest.fn()
let mockCart: unknown[] = []
let mockMenu: unknown[] = []

jest.mock('@/api/menu', () => ({
  buildSpecificMenuRequest: (q: unknown) => q,
  extractMenuItems: (r: { items: unknown[] }) => r.items,
  getSpecificMenu: jest.fn(),
  getPublicSpecificMenu: jest.fn(),
}))

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    fetchQuery: () => Promise.resolve({ result: { items: mockMenu } }),
  }),
}))

jest.mock('@/stores', () => ({
  useUserStore: (sel: (s: unknown) => unknown) =>
    sel({ userInfo: { slug: 'u' } }),
  useBranchStore: (sel: (s: unknown) => unknown) =>
    sel({ branch: { slug: 'b1' } }),
  useOrderFlowStore: {
    getState: () => ({ orderingData: { orderItems: mockCart, voucher: null } }),
  },
}))

jest.mock('@/stores/cart.store', () => ({
  cartActions: {
    removeItem: (id: string) => mockCalls.push(`remove:${id}`),
    updateVariant: (id: string) => mockCalls.push(`update:${id}`),
    updateVariants: (u: unknown[]) => {
      mockCalls.push(`updateVariants:${u.length}`)
      mockUpdateVariants(u)
    },
    setVoucher: jest.fn(),
  },
}))

jest.mock('@/utils', () => ({
  showToast: (...a: unknown[]) => mockToast(...a),
}))

function cartItem(
  id: string,
  slug: string,
  variantSlug: string,
  price: number,
) {
  return {
    id,
    slug,
    productSlug: slug,
    name: slug,
    size: 'S',
    variant: { slug: variantSlug, price, size: { name: 'S', slug: 's' } },
  }
}

function menuItem(slug: string, variantSlug: string, price: number) {
  return {
    product: {
      slug,
      variants: [{ slug: variantSlug, price, size: { name: 'S', slug: 's' } }],
    },
  }
}

beforeEach(() => {
  mockCalls.length = 0
  mockUpdateVariants.mockClear()
  mockToast.mockClear()
})

async function runValidate() {
  const { result } = renderHook(() => useCartValidation())
  await act(async () => {
    await result.current.validate(true)
  })
}

it('V1 hai món đổi giá → một lần updateVariants với hai phần tử', async () => {
  mockCart = [
    cartItem('1', 'tra', 'tra-s', 10),
    cartItem('2', 'ca-phe', 'cf-s', 20),
  ]
  mockMenu = [menuItem('tra', 'tra-s', 12), menuItem('ca-phe', 'cf-s', 25)]
  await runValidate()
  expect(mockUpdateVariants).toHaveBeenCalledTimes(1)
  const updates = mockUpdateVariants.mock.calls[0][0] as Array<{
    itemId: string
  }>
  expect(updates.map((u) => u.itemId)).toEqual(['1', '2'])
  expect(mockCalls.filter((c) => c.startsWith('update:'))).toEqual([])
})

it('V2 món bị xoá vẫn xoá trước, thông báo như cũ', async () => {
  mockCart = [
    cartItem('1', 'tra', 'tra-s', 10),
    cartItem('2', 'het-hang', 'x', 5),
  ]
  mockMenu = [menuItem('tra', 'tra-s', 12)]
  await runValidate()
  expect(mockCalls[0]).toBe('remove:2')
  expect(mockCalls).toContain('updateVariants:1')
  expect(mockToast).toHaveBeenCalledWith(
    expect.stringContaining('không còn trong menu'),
    'warning',
  )
})

function source(file: string): string {
  return fs
    .readFileSync(path.resolve(__dirname, '../..', file), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

it('V3 kiểm tự động khi vào giỏ chạy sau chuyển màn; cổng đặt hàng giữ nguyên', () => {
  const content = source('components/cart/cart-content.tsx')
  expect(content).toMatch(
    /scheduleTransitionTask\(\(\) => \{?\s*void validate\(\)/,
  )
  expect(content).not.toMatch(/^\s*validate\(\)\s*$/m)
  expect(source('components/cart/cart-footer.tsx')).toMatch(/validate\(true\)/)
})
