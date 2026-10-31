// Khoá quyết định hiệu năng của giỏ hàng (spec 2026-10-30): mỗi sheet chỉ dựng
// khi mở lần đầu; lúc tải phần nội dung không hiện khung trống; ảnh ô giỏ giữ
// trong bộ nhớ khi cuộn qua lại. Mỗi sheet đều tự present() trong effect theo
// `visible` — effect đó chạy cả lúc mount, nên dựng với visible=true là mở.
import * as fs from 'fs'
import * as path from 'path'

function source(file: string): string {
  return fs
    .readFileSync(path.resolve(__dirname, '../../..', file), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const SHEETS: Array<[string, string]> = [
  ['components/cart/cart-footer.tsx', 'ConfirmOrderSheet'],
  ['components/cart/cart-footer.tsx', 'SimpleOrderTypeSheet'],
  ['components/cart/cart-footer.tsx', 'SimpleTableSheet'],
  ['components/cart/cart-footer.tsx', 'VoucherSheet'],
  ['components/cart/cart-footer.tsx', 'DeliveryAddressSheet'],
  ['components/cart/cart-content.tsx', 'CartSizeSheet'],
  ['app/(tabs)/cart.tsx', 'ClearCartSheet'],
]

it.each(SHEETS)('LS1 %s: <%s> chỉ dựng khi đã mở', (file, sheet) => {
  expect(source(file)).toMatch(
    new RegExp(`\\w+Mounted && \\(?\\s*<${sheet}\\b`),
  )
})

it('LS3 fallback của Suspense là thân khung giỏ, không phải View trống', () => {
  const cart = source('app/(tabs)/cart.tsx')
  expect(cart).toMatch(/fallback=\{\s*<CartShellBody/)
})

it('LS4 ảnh ô giỏ giữ cả trong bộ nhớ', () => {
  expect(source('components/cart/cart-item-row.tsx')).toMatch(
    /cachePolicy="memory-disk"/,
  )
})
