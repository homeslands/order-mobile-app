import {
  hasProcessed,
  markProcessed,
  clearProcessed,
} from '@/lib/notification-dedup'

describe('notification-dedup', () => {
  beforeEach(() => {
    clearProcessed()
  })

  it('returns false for an unknown id', () => {
    expect(hasProcessed('abc')).toBe(false)
  })

  it('returns true after marking an id', () => {
    markProcessed('abc')
    expect(hasProcessed('abc')).toBe(true)
  })

  it('clearProcessed removes all entries', () => {
    markProcessed('abc')
    markProcessed('def')
    clearProcessed()
    expect(hasProcessed('abc')).toBe(false)
    expect(hasProcessed('def')).toBe(false)
  })

  it('evicts the oldest entry when over the 100-entry cap', () => {
    for (let i = 0; i <= 100; i++) markProcessed(`id-${i}`)
    // id-0 was the first inserted — must be evicted
    expect(hasProcessed('id-0')).toBe(false)
    expect(hasProcessed('id-100')).toBe(true)
  })

  it('does not evict when at exactly the cap', () => {
    for (let i = 0; i < 100; i++) markProcessed(`id-${i}`)
    expect(hasProcessed('id-0')).toBe(true)
  })
})
