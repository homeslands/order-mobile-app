// Ghi chú món ở trang chi tiết: chip ghi chú nhanh và ô nhập cùng sửa MỘT
// chuỗi ghi chú (giỏ hàng chỉ nhận một chuỗi). Bấm chip thì thêm/bỏ đúng cụm
// đó, giữ nguyên phần khách tự gõ.
import { noteHasChip, toggleNoteChip } from '@/utils/product-note'

it('PN1 bấm chip khi ghi chú trống: ghi chú là đúng chip đó', () => {
  expect(toggleNoteChip('', 'Ít đá')).toBe('Ít đá')
})

it('PN2 bấm thêm chip: nối bằng dấu phẩy, giữ phần khách gõ', () => {
  expect(toggleNoteChip('Ít đá', 'Ít ngọt')).toBe('Ít đá, Ít ngọt')
  expect(toggleNoteChip('mang về sau 5 phút', 'Ít đá')).toBe(
    'mang về sau 5 phút, Ít đá',
  )
})

it('PN3 bấm lại chip đang chọn: bỏ đúng cụm đó', () => {
  expect(toggleNoteChip('Ít đá, Ít ngọt', 'Ít đá')).toBe('Ít ngọt')
  expect(toggleNoteChip('Ít ngọt, Ít đá, giao nhanh', 'Ít đá')).toBe(
    'Ít ngọt, giao nhanh',
  )
})

it('PN4 nhận chip dù khách gõ khác hoa thường / thừa khoảng trắng', () => {
  expect(noteHasChip('  ít đá ,Ít ngọt', 'Ít đá')).toBe(true)
  expect(toggleNoteChip('  ít đá ,Ít ngọt', 'Ít đá')).toBe('Ít ngọt')
})

it('PN5 chỉ khớp nguyên cụm: "Không đá" không làm sáng chip "đá"', () => {
  expect(noteHasChip('Không đá', 'Ít đá')).toBe(false)
  expect(noteHasChip('Ít đá lắm', 'Ít đá')).toBe(false)
})
