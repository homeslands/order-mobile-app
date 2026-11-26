const ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/

// Định dạng BE trả về khi dùng moment().toString()
const BE_RE =
  /^[A-Z][a-z]{2} ([A-Z][a-z]{2}) (\d{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT([+-])(\d{2})(\d{2})$/

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

// Đọc mốc giờ từ BE (ISO 8601 hoặc moment().toString()) ra epoch ms.
// Không dùng new Date(chuỗi-không-ISO) vì Hermes parse không ổn định.
export const parseServerTime = (
  value: string | null | undefined,
): number | null => {
  if (typeof value !== 'string') return null

  if (ISO_RE.test(value)) {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  const match = BE_RE.exec(value)
  if (!match) return null

  const month = MONTHS.indexOf(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const sign = match[7] === '-' ? -1 : 1
  const offsetMinutes = Number(match[8]) * 60 + Number(match[9])

  if (month < 0) return null
  if (day < 1 || day > 31) return null
  if (hour > 23 || minute > 59 || second > 59) return null

  return (
    Date.UTC(year, month, day, hour, minute, second) -
    sign * offsetMinutes * 60000
  )
}
