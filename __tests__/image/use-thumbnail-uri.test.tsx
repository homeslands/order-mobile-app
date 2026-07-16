import { renderHook, waitFor } from '@testing-library/react-native'

jest.mock('@/lib/image/thumbnail-cache', () => ({
  getCachedThumbnail: (u: string) =>
    u === 'http://s3/cached.jpg' ? 'file://cached.jpg' : null,
}))
jest.mock('@/lib/image/on-device-resize', () => ({
  getThumbnailUri: (u: string) =>
    new Promise<string>((res) => {
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
