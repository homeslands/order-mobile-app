// Màu trên Home phải đi từ design token của app (`colors` trong
// constants/colors.constant.ts), không tự đặt mã. Một bảng nâu/kem tự chế
// từng làm Home lệch hẳn khỏi phần còn lại của app (cam thương hiệu + xám
// lạnh + nền #F0F2F5) — test này chặn chuyện đó lặp lại.
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../..')
const FILES = [
  'app/(tabs)/home.tsx',
  'components/home/balance-card.tsx',
  'components/home/home-action-grid.tsx',
  'components/home/home-greeting.tsx',
  'components/home/home-icons.tsx',
]
// Mã hex và rgba() viết thẳng — dòng comment không tính.
const HARDCODED = /(['"`])#[0-9a-fA-F]{3,8}\1|rgba?\(/

describe('màu trên Home đi từ design token', () => {
  it.each(FILES)('%s không hardcode màu', (file) => {
    const offenders = fs
      .readFileSync(path.join(ROOT, file), 'utf-8')
      .split('\n')
      .map((line, i) => ({ line: line.trim(), no: i + 1 }))
      .filter(({ line }) => !line.startsWith('//') && !line.startsWith('*'))
      .filter(({ line }) => HARDCODED.test(line))
      .map(({ line, no }) => `${no}: ${line}`)
    expect(offenders).toEqual([])
  })
})
