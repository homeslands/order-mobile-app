// Thẻ vé và sheet điều kiện phải hiện bằng BeVietnamPro như phần còn lại của
// app. Wrapper `Text` (components/ui/text.tsx) luôn truyền `style`, nên ghi
// đè `Text.defaultProps.style` và chữ rơi về font hệ thống — mỗi <Text> phải
// tự mang họ font qua class `font-sans*`. Không dùng `fontWeight`: bốn độ đậm
// là bốn HỌ font riêng, đặt fontWeight lên họ Regular thì máy phải giả nét đậm.
import * as fs from 'fs'
import * as path from 'path'

const FILES = [
  'components/cart/voucher-card.tsx',
  'components/cart/voucher-condition-modal.tsx',
]

function source(file: string): string {
  return fs
    .readFileSync(path.resolve(__dirname, '../../..', file), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe.each(FILES)('%s', (file) => {
  const src = source(file)

  it('VT1 mỗi <Text> mang họ font BeVietnamPro (class font-sans*)', () => {
    const tags = src.match(/<Text\b[\s\S]*?>/g) ?? []
    expect(tags.length).toBeGreaterThan(0)
    expect(tags.filter((t) => !/font-sans/.test(t))).toEqual([])
  })

  it('VT2 không dùng fontWeight', () => {
    expect(src).not.toMatch(/fontWeight/)
  })
})
