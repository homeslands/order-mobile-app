// Khoá các quyết định hiệu năng của màn Menu (spec 2026-10-30): tải trước
// thumbnail thay vì ảnh gốc, gọi menu ngay khi chưa có cache, vùng vẽ trước
// đủ cho ảnh kịp chuẩn bị.
import * as fs from 'fs'
import * as path from 'path'

const src = fs
  .readFileSync(
    path.resolve(__dirname, '../../app/(tabs)/menu/index.tsx'),
    'utf-8',
  )
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

it('MS1 không tải trước ảnh gốc bằng Image.prefetch', () => {
  expect(src).not.toMatch(/Image\.prefetch\(/)
  expect(src).toMatch(/prefetchThumbnails\(/)
})

it('MS2 gọi menu qua cổng vào màn', () => {
  expect(src).toMatch(/useEntryFetchGate\(\s*\w+,\s*\[/)
  expect(src).not.toMatch(/setAllowFetch\(/)
})

it('MS3 vùng vẽ trước 700 và lô danh mục 5', () => {
  expect(src).toMatch(/drawDistance=\{700\}/)
  expect(src).toMatch(/const MENU_CATALOG_BATCH = 5\b/)
})

it('MS4 lúc tải hiện skeleton dòng món', () => {
  expect(src).toMatch(/MenuItemRowSkeleton/)
})
