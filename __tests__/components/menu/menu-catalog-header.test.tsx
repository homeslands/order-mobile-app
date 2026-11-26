// Tiêu đề nhóm ở Menu: lướt tới thì dính lại thành thanh tiêu đề (nền trắng,
// kẻ dưới) — lúc nằm giữa danh sách chỉ là chữ trên nền xám. Hai trạng thái
// cùng chiều cao để lúc nhóm sau đẩy tiêu đề cũ lên không bị giật.
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { MenuCatalogHeader } from '@/components/menu/menu-catalog-header'
import { colors } from '@/constants'

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

function style(stuck: boolean) {
  render(
    <MenuCatalogHeader
      name="cà phê"
      countLabel="19 món"
      stuck={stuck}
      isDark={false}
    />,
  )
  const s = StyleSheet.flatten(
    screen.getByTestId('menu-catalog-header').props.style,
  )
  screen.unmount()
  return s
}

it('CH1 viết hoa chữ đầu, kèm số món', () => {
  render(
    <MenuCatalogHeader
      name="cà phê"
      countLabel="19 món"
      stuck={false}
      isDark={false}
    />,
  )
  expect(screen.getByText('Cà phê')).toBeTruthy()
  expect(screen.getByText('19 món')).toBeTruthy()
})

it('CH2 đang lướt: chữ trên nền xám, không kẻ', () => {
  const s = style(false)
  expect(s.backgroundColor).toBe(colors.background.light)
  expect(s.borderBottomWidth ?? 0).toBe(0)
})

it('CH3 đã dính: thành thanh tiêu đề nền trắng, có kẻ dưới', () => {
  const s = style(true)
  expect(s.backgroundColor).toBe(colors.card.light)
  expect(s.borderBottomWidth).toBe(StyleSheet.hairlineWidth)
})

it('CH4 hai trạng thái cùng chiều cao (cùng đệm, cùng cỡ chữ)', () => {
  const a = style(false)
  const b = style(true)
  expect(a.paddingTop).toBe(b.paddingTop)
  expect(a.paddingBottom).toBe(b.paddingBottom)
  expect(a.height).toBe(b.height)
})
