// Home phải theo đúng hệ thống thiết kế của app, không tự đặt số.
//
// - Kiểu chữ: wrapper `Text` (components/ui/text.tsx) luôn truyền `style`, nên
//   ghi đè `Text.defaultProps.style` và chữ rơi về font hệ thống. Mỗi <Text>
//   phải tự mang họ BeVietnamPro qua class `font-sans*`. Không dùng class độ
//   đậm (`font-bold`…) hay `fontWeight`: bốn độ đậm là bốn HỌ font riêng
//   (400/500/600/700), đặt fontWeight lên họ Regular thì máy phải giả nét đậm.
// - Cỡ chữ chỉ thuộc thang token (design-tokens: xs 12, sm 14, base 16, lg 18)
//   cộng 24 cho con số số dư.
// - Khoảng cách theo lưới 4pt: không dùng bậc lẻ (1.5, 2.5, 3.5) hay [18px].
// - Bo góc hai giá trị: thẻ 16 (rounded-2xl), ô icon 12 (rounded-xl), và tròn.
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../..')
const FILES = [
  'app/(tabs)/home.tsx',
  'components/home/balance-card.tsx',
  'components/home/home-action-grid.tsx',
  'components/home/home-greeting.tsx',
]
const FONT_SIZES = new Set([12, 14, 16, 18, 24])
const SPACING_STEPS = new Set(['0', '1', '2', '3', '4', '5', '6', '8'])
// rounded-none: skeleton của banner tràn sát mép.
const RADIUS_CLASSES = new Set([
  'rounded-2xl',
  'rounded-xl',
  'rounded-full',
  'rounded-none',
])
const RADIUS_VALUES = new Set([12, 16])

function source(file: string): string {
  // Bỏ comment để lời giải thích không bị bắt nhầm.
  return fs
    .readFileSync(path.join(ROOT, file), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

describe.each(FILES)('%s theo hệ thống thiết kế', (file) => {
  const src = source(file)

  it('mỗi <Text> mang họ font BeVietnamPro (class font-sans*)', () => {
    const tags = src.match(/<Text\b[\s\S]*?>/g) ?? []
    const missing = tags.filter((t) => !/font-sans/.test(t))
    expect(missing).toEqual([])
  })

  it('không dùng class độ đậm hay fontWeight', () => {
    const bad = src.match(
      /\bfont-(?:thin|light|normal|medium|semibold|bold|extrabold|black)\b|fontWeight/g,
    )
    expect(bad ?? []).toEqual([])
  })

  it('cỡ chữ thuộc thang token', () => {
    const sizes = [...src.matchAll(/fontSize:\s*([0-9.]+)/g)].map((m) =>
      Number(m[1]),
    )
    expect(sizes.filter((s) => !FONT_SIZES.has(s))).toEqual([])
  })

  it('khoảng cách theo lưới 4pt', () => {
    const steps = [
      ...src.matchAll(
        /\b(?:[pm][xytrbl]?|gap(?:-[xy])?)-(\[[^\]]+\]|[0-9.]+)\b/g,
      ),
    ].map((m) => m[0])
    const bad = steps.filter((s) => !SPACING_STEPS.has(s.split('-').pop()!))
    expect(bad).toEqual([])
  })

  it('bo góc chỉ 16, 12 hoặc tròn', () => {
    const classes = [...src.matchAll(/\brounded(?:-[a-z0-9[\]px.]+)?\b/g)].map(
      (m) => m[0],
    )
    const values = [...src.matchAll(/borderRadius:\s*([0-9.]+)/g)].map((m) =>
      Number(m[1]),
    )
    expect(classes.filter((c) => !RADIUS_CLASSES.has(c))).toEqual([])
    expect(values.filter((v) => !RADIUS_VALUES.has(v))).toEqual([])
  })
})
