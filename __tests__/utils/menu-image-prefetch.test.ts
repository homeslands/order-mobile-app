// Danh sách Menu xen dòng tiêu đề danh mục giữa các món. Chỉ số ô đang hiện
// của FlashList đếm cả tiêu đề, nên phải đi tiếp trên CHÍNH mảng dòng đó —
// tra sang mảng chỉ có món là lệch và tải trước nhầm món.
import { getAheadImageUrls } from '@/utils/menu-image-prefetch'

const H = { _kind: 'header' as const }
const item = (imageUrl: string | null) => ({
  _kind: 'item' as const,
  data: { imageUrl },
})

it('MP1 bỏ qua dòng tiêu đề, lấy món ngay sau vùng đang xem', () => {
  const rows = [H, item('a'), item('b'), H, item('c')]
  expect(getAheadImageUrls(rows, 1, 2)).toEqual(['b', 'c'])
})

it('MP2 bỏ URL rỗng và URL trùng', () => {
  const rows = [item('a'), item(null), item('b'), item('b'), item('c')]
  expect(getAheadImageUrls(rows, 0, 5)).toEqual(['b', 'c'])
})

it('MP3 đang ở cuối danh sách thì không còn gì', () => {
  expect(getAheadImageUrls([item('a'), item('b')], 1, 4)).toEqual([])
})

it('MP4 từ -1 là lấy từ đầu danh sách', () => {
  expect(getAheadImageUrls([H, item('a'), item('b')], -1, 1)).toEqual(['a'])
})
