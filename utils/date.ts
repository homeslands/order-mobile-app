import dayjs from 'dayjs'
import 'dayjs/locale/vi'

dayjs.locale('vi')

function toDate(
  date: string | Date | number | null | undefined,
): dayjs.Dayjs | null {
  if (!date) return null
  const d = dayjs(date)
  return d.isValid() ? d : null
}

/**
 * Format date to Vietnamese format: hh:mm dd/mm/yyyy
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted string (e.g., "14:30 25/12/2024")
 */
export function formatDateTime(
  date: string | Date | number | null | undefined,
): string {
  const d = toDate(date)
  return d ? d.format('HH:mm DD/MM/YYYY') : '-'
}

/**
 * Format date to Vietnamese format: dd/mm/yyyy
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted string (e.g., "25/12/2024")
 */
export function formatDate(
  date: string | Date | number | null | undefined,
): string {
  const d = toDate(date)
  return d ? d.format('DD/MM/YYYY') : '-'
}

/**
 * Format date to Vietnamese format with seconds: HH:mm:ss DD/MM/YYYY
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted string (e.g., "14:30:25 25/12/2024")
 */
export function formatDateTimeWithSeconds(
  date: string | Date | number | null | undefined,
): string {
  const d = toDate(date)
  return d ? d.format('HH:mm:ss DD/MM/YYYY') : '-'
}
