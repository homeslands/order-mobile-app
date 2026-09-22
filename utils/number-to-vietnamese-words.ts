/**
 * Đọc số nguyên thành chữ tiếng Việt, như dòng "số tiền bằng chữ" trên màn
 * xác nhận của app ngân hàng: 6400 → "Sáu nghìn bốn trăm".
 *
 * Nhóm ba chữ số từ phải sang. Nhóm đứng sau nhóm đầu luôn đọc đủ hàng trăm
 * ("một nghìn không trăm linh năm"); nhóm toàn số 0 thì bỏ qua.
 */
const DIGITS = [
  'không',
  'một',
  'hai',
  'ba',
  'bốn',
  'năm',
  'sáu',
  'bảy',
  'tám',
  'chín',
]
const SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ']

function readGroup(n: number, full: boolean): string[] {
  const h = Math.floor(n / 100)
  const t = Math.floor(n / 10) % 10
  const u = n % 10
  const words: string[] = []

  if (h > 0 || full) words.push(DIGITS[h], 'trăm')

  if (t === 0) {
    if (u > 0) {
      if (h > 0 || full) words.push('linh')
      words.push(DIGITS[u])
    }
  } else if (t === 1) {
    words.push('mười')
    if (u === 5) words.push('lăm')
    else if (u > 0) words.push(DIGITS[u])
  } else {
    words.push(DIGITS[t], 'mươi')
    if (u === 1) words.push('mốt')
    else if (u === 5) words.push('lăm')
    else if (u > 0) words.push(DIGITS[u])
  }

  return words
}

export function numberToVietnameseWords(value: number): string {
  const n = Math.max(0, Math.floor(value))
  if (n === 0) return 'Không'

  const groups: number[] = []
  for (let rest = n; rest > 0; rest = Math.floor(rest / 1000)) {
    groups.push(rest % 1000)
  }

  const words: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue
    words.push(...readGroup(groups[i], i < groups.length - 1))
    if (SCALES[i]) words.push(SCALES[i])
  }

  const text = words.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
