// iOS dưới 26 dùng thanh tab tự vẽ. Khi tab ẩn bằng display:none, Fabric trên
// iOS xoá native view của cả cây đó và đem view đi tái dùng, trong khi
// react-native-gesture-handler vẫn gắn recognizer vào view cũ. Hậu quả: ô ở
// Home chết sau khi chuyển tab, còn chạm ở tab khác lại kích hoạt ô của Home
// (chọn catalog ở Menu bật màn quét QR, vào giỏ bật sheet Mã thành viên).
// detachInactiveScreens bật trên iOS thì tab ẩn được tách hẳn, không đi qua
// display:none. Android không xoá view nên giữ false (lỗi kẹt expo#35116).
//
// Kiểm trên mã nguồn vì dựng cả navigator tab trong test không đáng.
import * as fs from 'fs'
import * as path from 'path'

const src = fs.readFileSync(
  path.join(
    __dirname,
    '../../../components/navigation/custom-tabs-navigator.tsx',
  ),
  'utf8',
)

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('TD1 tab ẩn được tách hẳn trên iOS, giữ nguyên trên Android', () => {
  expect(src).toMatch(/detachInactiveScreens=\{Platform\.OS === 'ios'\}/)
})
