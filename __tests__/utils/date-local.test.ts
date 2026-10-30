// Ngày menu phải là ngày ĐỊA PHƯƠNG. `toISOString()` cho ngày UTC, nên từ
// 00:00 tới 07:00 giờ Việt Nam app xin menu của hôm qua. Menu và kiểm giá giỏ
// phải dùng chung một hàm để không bao giờ lệch ngày nhau.
import * as fs from 'fs'
import * as path from 'path'

import { getLocalDateString } from '@/utils/date'

const ROOT = path.resolve(__dirname, '../..')
const MENU_DATE_FILES = [
  'app/(tabs)/menu/index.tsx',
  'components/menu/slider-related-products.tsx',
  'hooks/use-cart-validation.ts',
]

function source(file: string): string {
  return fs
    .readFileSync(path.join(ROOT, file), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('getLocalDateString', () => {
  it('D1 00:30 sáng ngày 31 vẫn là ngày 31', () => {
    // Dựng Date theo giờ máy nên test không phụ thuộc múi giờ của máy chạy.
    expect(getLocalDateString(new Date(2026, 9, 31, 0, 30))).toBe('2026-10-31')
  })

  it('D2 đệm số 0 cho tháng và ngày', () => {
    expect(getLocalDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe.each(MENU_DATE_FILES)('%s', (file) => {
  it('D3 không dựng ngày menu bằng toISOString', () => {
    const src = source(file)
    expect(src).not.toMatch(
      /toISOString\(\)\s*\.(?:split\('T'\)|slice\(0,\s*10\))/,
    )
  })
})
