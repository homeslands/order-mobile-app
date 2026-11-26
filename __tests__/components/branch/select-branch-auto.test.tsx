// Chưa lưu chi nhánh: app tự chọn, KHÔNG bật sheet chặn màn. Nhiều chi nhánh
// thì ghi nhận là "app tự chọn" để Menu hiện dòng "Đang xem menu … · Đổi".
import { act, render, screen } from '@testing-library/react-native'

import SelectBranchDropdown from '@/components/branch/select-branch-dropdown'
import { useBranchStore } from '@/stores'
import type { IBranch } from '@/types'

const mk = (slug: string) =>
  ({
    slug,
    name: slug,
    address: '',
    addressDetail: { slug, formattedAddress: '', lat: 10, lng: 106, url: '' },
  }) as unknown as IBranch

let mockBranches: IBranch[] = []
jest.mock('@/hooks', () => ({
  useBranch: () => ({ data: { result: mockBranches } }),
}))
jest.mock('@/hooks/use-primary-color', () => ({
  usePrimaryColor: () => '#F7A737',
}))
jest.mock('@/lib/branch-default', () => ({
  ...jest.requireActual<typeof import('@/lib/branch-default')>(
    '@/lib/branch-default',
  ),
  getKnownPosition: async () => null,
}))
jest.mock('@/components/branch/branch-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native')
  return {
    BranchSheet: ({ visible }: { visible: boolean }) =>
      visible ? <Text testID="branch-sheet">sheet</Text> : null,
  }
})
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (k: string) => k }),
}))

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })

beforeEach(() => {
  useBranchStore.setState({ branch: undefined, autoPicked: false })
})

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

it('SB1 một chi nhánh: tự chọn, không bật sheet, không gợi ý', async () => {
  mockBranches = [mk('only')]
  render(<SelectBranchDropdown autoOpen />)
  await flush()
  expect(useBranchStore.getState().branch?.slug).toBe('only')
  expect(useBranchStore.getState().autoPicked).toBe(false)
  expect(screen.queryByTestId('branch-sheet')).toBeNull()
})

it('SB2 nhiều chi nhánh: tự chọn, không bật sheet, đánh dấu để gợi ý', async () => {
  mockBranches = [mk('a'), mk('b')]
  render(<SelectBranchDropdown autoOpen />)
  await flush()
  expect(useBranchStore.getState().branch?.slug).toBe('a')
  expect(useBranchStore.getState().autoPicked).toBe(true)
  expect(screen.queryByTestId('branch-sheet')).toBeNull()
})

it('SB3 khách tự chọn chi nhánh thì hết gợi ý', () => {
  useBranchStore.getState().setAutoPickedBranch(mk('a'))
  expect(useBranchStore.getState().autoPicked).toBe(true)
  useBranchStore.getState().setBranch(mk('b'))
  expect(useBranchStore.getState().autoPicked).toBe(false)
})

it('SB4 đã có chi nhánh hợp lệ thì không đổi gì', async () => {
  mockBranches = [mk('a'), mk('b')]
  useBranchStore.setState({ branch: mk('b'), autoPicked: false })
  render(<SelectBranchDropdown autoOpen />)
  await flush()
  expect(useBranchStore.getState().branch?.slug).toBe('b')
  expect(screen.queryByTestId('branch-sheet')).toBeNull()
})
