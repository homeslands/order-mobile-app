// Lần đầu mở Menu (chưa lưu chi nhánh): app từng tự chọn chi nhánh đầu rồi
// VẪN bật sheet bắt chọn, kể cả khi chỉ có một chi nhánh. Giờ tự chọn: gần
// nhất nếu đã biết vị trí (không xin quyền chỉ vì việc này), không thì đầu.
import type { IBranch } from '@/types'
import { pickDefaultBranch } from '@/lib/branch-default'

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

const branch = (slug: string, lat: number, lng: number) =>
  ({
    slug,
    name: slug,
    address: '',
    addressDetail: { slug, formattedAddress: '', lat, lng, url: '' },
  }) as unknown as IBranch

// Thủ Đức và Quận 1 (TP.HCM), cách nhau ~12 km.
const thuDuc = branch('thu-duc', 10.8494, 106.7537)
const quan1 = branch('quan-1', 10.7769, 106.7009)

it('BD1 không có chi nhánh nào thì không chọn', () => {
  expect(pickDefaultBranch([], null)).toBeUndefined()
})

it('BD2 chưa biết vị trí thì chọn chi nhánh đầu', () => {
  expect(pickDefaultBranch([thuDuc, quan1], null)).toBe(thuDuc)
})

it('BD3 biết vị trí thì chọn chi nhánh gần nhất', () => {
  const nearQuan1 = { latitude: 10.7756, longitude: 106.7019 }
  expect(pickDefaultBranch([thuDuc, quan1], nearQuan1)).toBe(quan1)
})

it('BD4 chi nhánh thiếu toạ độ thì bỏ qua khi so khoảng cách', () => {
  const noCoords = {
    ...quan1,
    slug: 'no-coords',
    addressDetail: undefined,
  } as unknown as IBranch
  const nearQuan1 = { latitude: 10.7756, longitude: 106.7019 }
  expect(pickDefaultBranch([noCoords, thuDuc], nearQuan1)).toBe(thuDuc)
})
