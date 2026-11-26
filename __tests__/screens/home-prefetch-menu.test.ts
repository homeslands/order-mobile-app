// Home tải trước Menu khi đã rảnh (sau chuyển màn), qua lib/menu-queries để
// dữ liệu nằm đúng khoá màn Menu đọc. Kiểm trên mã nguồn: dựng cả Home trong
// test không đáng.
import * as fs from 'fs'
import * as path from 'path'

const src = fs.readFileSync(
  path.join(__dirname, '../../app/(tabs)/home.tsx'),
  'utf8',
)

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('HP1 Home gọi prefetchMenu từ lib/menu-queries, chỉ sau khi ready', () => {
  expect(src).toMatch(/from '@\/lib\/menu-queries'/)
  expect(src).toMatch(/if \(!ready\) return[\s\S]{0,400}prefetchMenu\(/)
})
