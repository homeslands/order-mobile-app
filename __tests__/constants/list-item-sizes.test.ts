import * as sizes from '@/constants/list-item-sizes'

describe('list-item-sizes', () => {
  it('exports only positive integers', () => {
    expect(Object.keys(sizes).length).toBeGreaterThan(0)
    Object.entries(sizes).forEach(([_key, value]) => {
      expect(typeof value).toBe('number')
      expect(value).toBeGreaterThan(0)
      expect(Number.isInteger(value)).toBe(true)
    })
  })

  it('exports UPDATE_ORDER_MENU_ITEM_HEIGHT', () => {
    expect(sizes.UPDATE_ORDER_MENU_ITEM_HEIGHT).toBeDefined()
  })
})
