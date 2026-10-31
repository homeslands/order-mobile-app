import { renderHook, waitFor } from '@testing-library/react-native'

jest.mock('@/lib/image/thumbnail-cache', () => ({
  getCachedThumbnail: (u: string) =>
    u === 'http://s3/cached.jpg' ? 'file://cached.jpg' : null,
}))
const mockSignals: AbortSignal[] = []
jest.mock('@/lib/image/on-device-resize', () => ({
  getThumbnailUri: (u: string, _w: number, opts?: { signal?: AbortSignal }) =>
    new Promise<string>((res) => {
      if (opts?.signal) mockSignals.push(opts.signal)
      if (u === 'http://s3/immediate.jpg') res('file://done.jpg')
    }),
}))

import { useThumbnailUri } from '@/hooks/use-thumbnail-uri'

it('returns cached uri synchronously on first render', () => {
  const { result } = renderHook(() =>
    useThumbnailUri('http://s3/cached.jpg', 384),
  )
  expect(result.current).toBe('file://cached.jpg')
})

it('returns null then resolved uri on miss', async () => {
  const { result } = renderHook(() =>
    useThumbnailUri('http://s3/immediate.jpg', 384),
  )
  await waitFor(() => expect(result.current).toBe('file://done.jpg'))
})

it('returns null for null url', () => {
  const { result } = renderHook(() => useThumbnailUri(null, 384))
  expect(result.current).toBeNull()
})

it('U4 unmount trước khi xong thì huỷ việc resize', () => {
  mockSignals.length = 0
  const { unmount } = renderHook(() =>
    useThumbnailUri('http://s3/slow.jpg', 384),
  )
  expect(mockSignals).toHaveLength(1)
  expect(mockSignals[0].aborted).toBe(false)
  unmount()
  expect(mockSignals[0].aborted).toBe(true)
})
