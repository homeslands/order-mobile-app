// Nút header (quay lại, nút bên phải) thống nhất 44pt — vùng bấm tối thiểu
// của Apple, cỡ nút kính trên thanh điều hướng iOS 26. Trước lẫn 36 / 38 /
// 40 / 42 tuỳ màn.
import * as fs from 'fs'
import * as path from 'path'

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../..', rel), 'utf-8')

it('HB1 nút kính mặc định 44', () => {
  expect(read('components/navigation/glass-header-button.tsx')).toMatch(
    /size = 44,/,
  )
})

it('HB2 không màn nào tự đặt cỡ nút header khác', () => {
  const files = [
    'app/(tabs)/profile/index.tsx',
    'app/profile/edit.tsx',
    'app/profile/coin-hub.tsx',
    'app/profile/history.tsx',
    'app/profile/verify-email.tsx',
    'app/profile/verify-phone-number.tsx',
    'app/profile/gift-card-hub.tsx',
    'app/profile/loyalty-point-hub.tsx',
  ]
  for (const f of files) {
    const src = read(f)
    const tags = src.match(/<GlassHeaderButton[\s\S]*?>/g) ?? []
    for (const tag of tags) expect(tag).not.toMatch(/\bsize=\{/)
  }
})

it('HB3 ô giữ chỗ / nút tự vẽ cùng cỡ 44', () => {
  const fh = read('components/navigation/floating-header.tsx')
  expect(fh).toMatch(/rightPlaceholder: \{\s*width: 44,\s*height: 44,/)
  const pd = read('components/product/product-detail-header.tsx')
  expect(pd).toMatch(
    /circle: \{\s*width: 44,\s*height: 44,\s*borderRadius: 22,/,
  )
  for (const f of [
    'app/profile/verify-email.tsx',
    'app/profile/verify-phone-number.tsx',
  ]) {
    expect(read(f)).toMatch(/rightPlaceholder: \{\s*width: 44,\s*height: 44,/)
  }
  expect(read('app/(tabs)/cart.tsx')).toMatch(
    /placeholder: \{ width: 44, height: 44 \}/,
  )
})
