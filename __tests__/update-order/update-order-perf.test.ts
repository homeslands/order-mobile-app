// Hiệu năng màn sửa đơn. Kiểm trên mã nguồn + hàm tổng tiền có nhớ kết quả.
import * as fs from 'fs'
import * as path from 'path'

import { getUpdateOrderTotals } from '@/utils/update-order-totals'
import type { IOrderItem } from '@/types'

const read = (rel: string) =>
  fs
    .readFileSync(path.resolve(__dirname, '../..', rel), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const dir = 'app/update-order/components/'
const screen = read('app/update-order/[slug].tsx')
const content = read(dir + 'update-order-content-native.tsx')
const footer = read(dir + 'update-order-footer.tsx')
const confirm = read(dir + 'confirm-update-order-dialog.tsx')
const voucherSheet = read(dir + 'voucher-sheet-in-update-order/index.tsx')
const note = read(dir + 'order-note-in-update-order-input.tsx')
const totalsHook = read('hooks/use-update-order-totals.ts')

const items = [
  {
    id: 'a',
    slug: 'a',
    name: 'a',
    quantity: 1,
    originalPrice: 30000,
    variant: { slug: 'v', price: 30000, size: { name: 'S' } },
  },
] as unknown as IOrderItem[]

describe('Tổng tiền', () => {
  it('UF1 cùng món + voucher thì không tính lại (4 chỗ dùng chung 1 kết quả)', () => {
    expect(getUpdateOrderTotals(items, null)).toBe(
      getUpdateOrderTotals(items, null),
    )
  })

  it('UF2 đổi món thì tính lại', () => {
    const a = getUpdateOrderTotals(items, null)
    const b = getUpdateOrderTotals([...items], null)
    expect(b).not.toBe(a)
    expect(b.cartTotals?.finalTotal).toBe(30000)
  })

  it('UF3 hook chỉ theo dõi món + voucher, không cả bản nháp', () => {
    expect(totalsHook).toMatch(/getUpdateOrderTotals\(/)
    expect(totalsHook).not.toMatch(/\(s\) => s\.updatingData\?\.updateDraft\)/)
  })
})

describe('Theo dõi store từng phần', () => {
  it('UF4 không component nào theo dõi cả updatingData', () => {
    for (const src of [content, confirm, voucherSheet]) {
      expect(src).not.toMatch(/useOrderFlowStore\(\(s\) => s\.updatingData\)/)
    }
    expect(footer).not.toMatch(/s\.updatingData\?\.updateDraft\)/)
  })
})

describe('Ghi chú đơn', () => {
  it('UF5 gõ ghi chú không ghi store mỗi phím: giữ cục bộ, debounce, ghi khi rời ô', () => {
    expect(note).toMatch(/setTimeout\(/)
    expect(note).toMatch(/onBlur/)
    expect(note).toMatch(/return \(\) =>/)
  })
})

describe('Dựng lười', () => {
  it('UF6 sheet chỉ dựng khi mở lần đầu', () => {
    expect(footer).toMatch(/useMountOnFirstOpen\(voucherSheetOpen\)/)
    expect(footer).toMatch(/useMountOnFirstOpen\(deliverySheetVisible\)/)
  })

  it('UF7 không tải danh sách bàn chỉ để lấy tên bàn (bản nháp đã có)', () => {
    expect(footer).not.toMatch(/useTables\(/)
    expect(footer).toMatch(/tableName/)
  })

  it('UF8 tải đơn ngay khi mở màn (dùng luôn dữ liệu đã tải sẵn ở Chi tiết đơn)', () => {
    expect(screen).toMatch(/useOrderBySlug\(slug\)/)
  })

  it('UF9 đổi tab không dựng lại từ đầu — giữ cả hai sau lần mở đầu', () => {
    expect(screen).toMatch(/menuVisited/)
    expect(screen).toMatch(/display: activeTab === 'menu' \? 'flex' : 'none'/)
  })

  it('UF10 bỏ overrideItemLayout (FlashList 2 bỏ qua size) và style inline', () => {
    expect(content).not.toMatch(/overrideItemLayout/)
    expect(content).not.toMatch(/contentContainerStyle=\{\{/)
  })
})

describe('Sheet voucher', () => {
  it('UF11 gõ mã voucher không vẽ lại các danh sách', () => {
    for (const f of [
      'valid-list',
      'invalid-list',
      'search-result',
      'sheet-footer',
    ]) {
      expect(read(dir + `voucher-sheet-in-update-order/${f}.tsx`)).toMatch(
        /= memo\(/,
      )
    }
  })
})

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})
