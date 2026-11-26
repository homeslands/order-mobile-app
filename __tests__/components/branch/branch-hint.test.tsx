// Nhiều chi nhánh, lần đầu: app tự chọn thay vì bật sheet chặn màn. Dòng gợi
// ý cho khách biết đang xem menu chi nhánh nào và đổi được ngay.
import { fireEvent, render, screen } from '@testing-library/react-native'

import { BranchHint } from '@/components/branch/branch-hint'
import { useBranchStore } from '@/stores'
import type { IBranch } from '@/types'

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (k: string, o?: Record<string, string>) =>
      o?.name ? `${k}:${o.name}` : k,
  }),
}))

const branch = { slug: 'q1', name: 'Chi nhánh Q1' } as unknown as IBranch

beforeEach(() => {
  useBranchStore.setState({ branch, autoPicked: true })
})

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('BH1 app tự chọn: hiện tên chi nhánh, bấm Đổi thì mở sheet', () => {
  const onChange = jest.fn()
  render(<BranchHint onChange={onChange} />)
  expect(screen.getByText('menu.viewingBranch:Chi nhánh Q1')).toBeTruthy()
  fireEvent.press(screen.getByText('menu.changeBranch'))
  expect(onChange).toHaveBeenCalledTimes(1)
})

it('BH2 đóng gợi ý thì ẩn hẳn', () => {
  render(<BranchHint onChange={jest.fn()} />)
  fireEvent.press(screen.getByLabelText('menu.dismissBranchHint'))
  expect(useBranchStore.getState().autoPicked).toBe(false)
  expect(screen.queryByText('menu.viewingBranch:Chi nhánh Q1')).toBeNull()
})

it('BH3 khách đã tự chọn chi nhánh: không hiện', () => {
  useBranchStore.setState({ branch, autoPicked: false })
  render(<BranchHint onChange={jest.fn()} />)
  expect(screen.queryByText('menu.viewingBranch:Chi nhánh Q1')).toBeNull()
})
