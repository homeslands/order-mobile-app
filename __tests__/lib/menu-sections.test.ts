// Danh sách Menu ở chế độ "Tất cả": món xếp theo nhóm danh mục, mỗi nhóm có
// dòng tiêu đề kèm số món và tiêu đề đó dính trên đầu khi cuộn.
import { buildMenuSections } from '@/lib/menu-sections'

type Item = {
  id: string
  menuItem: { product: { catalog?: { slug: string } } }
}
const it_ = (id: string, catalog?: string): Item => ({
  id,
  menuItem: { product: { catalog: catalog ? { slug: catalog } : undefined } },
})

const catalogs = [
  { slug: 'sinh-to', name: 'Sinh tố' },
  { slug: 'ca-phe', name: 'Cà phê' },
  { slug: 'tra', name: 'Trà' },
]

it('MS-1 nhóm theo thứ tự danh mục, tiêu đề có số món, bỏ nhóm rỗng', () => {
  const { rows } = buildMenuSections(
    [it_('a', 'ca-phe'), it_('b', 'sinh-to'), it_('c', 'ca-phe')],
    catalogs,
    true,
  )
  expect(
    rows.map((r) =>
      r._kind === 'header' ? `# ${r.name} (${r.count})` : r.data.id,
    ),
  ).toEqual(['# Sinh tố (1)', 'b', '# Cà phê (2)', 'a', 'c'])
})

it('MS-2 tiêu đề nhóm dính trên đầu: chỉ số đúng vị trí dòng tiêu đề', () => {
  const { stickyHeaderIndices } = buildMenuSections(
    [it_('a', 'ca-phe'), it_('b', 'sinh-to'), it_('c', 'ca-phe')],
    catalogs,
    true,
  )
  expect(stickyHeaderIndices).toEqual([0, 2])
})

it('MS-3 món không thuộc danh mục nào: xếp cuối, không tiêu đề', () => {
  const { rows } = buildMenuSections(
    [it_('x'), it_('b', 'sinh-to')],
    catalogs,
    true,
  )
  expect(rows.map((r) => (r._kind === 'header' ? '#' : r.data.id))).toEqual([
    '#',
    'b',
    'x',
  ])
})

it('MS-4 đang lọc / tìm kiếm: danh sách phẳng, không tiêu đề dính', () => {
  const out = buildMenuSections(
    [it_('a', 'ca-phe'), it_('b', 'sinh-to')],
    catalogs,
    false,
  )
  expect(out.rows.every((r) => r._kind === 'item')).toBe(true)
  expect(out.stickyHeaderIndices).toEqual([])
})

// Kiểu "inset grouped" của iOS: mỗi nhóm là một thẻ bo góc, nên mỗi món cần
// biết mình là món đầu / cuối của nhóm để bo góc trên / dưới.
const pos = (rows: ReturnType<typeof buildMenuSections<Item>>['rows']) =>
  rows.map((r) =>
    r._kind === 'header'
      ? '#'
      : `${r.data.id}${r.first ? '^' : ''}${r.last ? '_' : ''}`,
  )

it('MS-5 món đầu / cuối của mỗi nhóm', () => {
  const { rows } = buildMenuSections(
    [it_('a', 'ca-phe'), it_('b', 'sinh-to'), it_('c', 'ca-phe')],
    catalogs,
    true,
  )
  expect(pos(rows)).toEqual(['#', 'b^_', '#', 'a^', 'c_'])
})

it('MS-6 món không danh mục: thành một nhóm riêng ở cuối', () => {
  const { rows } = buildMenuSections(
    [it_('x'), it_('y'), it_('b', 'sinh-to')],
    catalogs,
    true,
  )
  expect(pos(rows)).toEqual(['#', 'b^_', 'x^', 'y_'])
})

it('MS-7 danh sách phẳng: cả danh sách là một nhóm', () => {
  const { rows } = buildMenuSections(
    [it_('a', 'ca-phe'), it_('b', 'sinh-to'), it_('c')],
    catalogs,
    false,
  )
  expect(pos(rows)).toEqual(['a^', 'b', 'c_'])
})
