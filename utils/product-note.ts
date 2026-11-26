/**
 * Ghi chú món: chip ghi chú nhanh và ô nhập cùng sửa MỘT chuỗi (giỏ hàng chỉ
 * nhận một chuỗi ghi chú). Các cụm cách nhau bằng dấu phẩy.
 */
const norm = (s: string) => s.trim().toLocaleLowerCase('vi')

const parts = (note: string) =>
  note
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

/** Ghi chú đã có nguyên cụm `chip` (không phân biệt hoa thường). */
export function noteHasChip(note: string, chip: string): boolean {
  const key = norm(chip)
  return parts(note).some((p) => norm(p) === key)
}

/** Bấm chip: chưa có thì nối vào cuối, có rồi thì bỏ đúng cụm đó. */
export function toggleNoteChip(note: string, chip: string): string {
  const list = parts(note)
  const key = norm(chip)
  const kept = list.filter((p) => norm(p) !== key)
  return (kept.length === list.length ? [...list, chip] : kept).join(', ')
}
