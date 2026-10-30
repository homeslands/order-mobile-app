// Khoá các quyết định hiệu năng của tab Gift Card (spec 2026-10-30): gọi ngay
// khi chưa có cache, không đóng cổng mỗi lần rời màn, tải trước thumbnail.
import * as fs from 'fs'
import * as path from 'path'

const src = fs
  .readFileSync(
    path.resolve(__dirname, '../../app/(tabs)/gift-card.tsx'),
    'utf-8',
  )
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

it('GS1 gọi qua cổng vào màn, không đóng cổng khi rời màn', () => {
  expect(src).toMatch(/useEntryFetchGate\(\s*\w+,\s*\[/)
  expect(src).not.toMatch(/setAllowFetch\(false\)/)
})

it('GS2 tải trước thumbnail các thẻ', () => {
  expect(src).toMatch(/prefetchThumbnails\(/)
})
