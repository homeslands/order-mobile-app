import * as MediaLibrary from 'expo-media-library'

import { isAccessTokenExpired, refreshSession } from '@/lib/auth/auth-refresh'

jest.mock('@/lib/auth/auth-refresh', () => ({
  isAccessTokenExpired: jest.fn(),
  refreshSession: jest.fn(),
}))

jest.mock('expo-media-library', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn(),
  createAssetAsync: jest.fn().mockResolvedValue({ id: 'asset-1' }),
}))

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: 'base64' },
}))

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}))

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}))

import { downloadAndSaveImage } from '@/utils/download-image'

// Nhánh /api/ dùng import động '@/stores' và '@/lib/auth/auth-refresh'.
// Jest không chạy được import động này trong môi trường hiện tại, nên các
// case /api/ chưa có test tự động: cần kiểm tra thủ công.
const PUBLIC_URL = 'https://cdn.example.com/images/qr.png'

const mockFetch = jest.fn()

describe('downloadAndSaveImage auth header', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(4),
    })
    global.fetch = mockFetch as unknown as typeof fetch
  })

  it('does not refresh or attach a token for non-/api/ URLs', async () => {
    const result = await downloadAndSaveImage(PUBLIC_URL, 'qr')

    expect(result).toBe(true)
    expect(isAccessTokenExpired).not.toHaveBeenCalled()
    expect(refreshSession).not.toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledWith(PUBLIC_URL, {
      headers: { Accept: 'image/*' },
    })
    expect(MediaLibrary.createAssetAsync).toHaveBeenCalled()
  })
})
