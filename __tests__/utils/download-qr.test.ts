import * as MediaLibrary from 'expo-media-library'
import { File } from 'expo-file-system'

jest.mock('expo-media-library', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  createAssetAsync: jest.fn(),
}))

jest.mock('expo-file-system', () => {
  const mockWriter = {
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    abort: jest.fn().mockResolvedValue(undefined),
  }
  return {
    File: jest.fn().mockImplementation(() => ({
      writableStream: () => ({ getWriter: () => mockWriter }),
      toString: () => 'file:///cache/qr_test.png',
    })),
    Paths: { cache: 'file:///cache' },
  }
})

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}))

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}))

import { downloadQRCodeImage } from '@/utils/download-image'
import { showToast } from '@/utils/toast'

const VALID_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('downloadQRCodeImage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns false and shows toast when permission denied', async () => {
    ;(MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' })
    ;(MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' })

    const result = await downloadQRCodeImage(VALID_BASE64, 'test_qr')

    expect(result).toBe(false)
    expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith('common.noPhotoLibraryPermission')
  })

  it('writes base64 PNG to cache and saves to media library when permitted', async () => {
    ;(MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' })
    ;(MediaLibrary.createAssetAsync as jest.Mock).mockResolvedValue({ id: 'asset-1' })

    const result = await downloadQRCodeImage(VALID_BASE64, 'payment_qr')

    expect(File).toHaveBeenCalled()
    expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith('file:///cache/qr_test.png')
    expect(result).toBe(true)
  })

  it('returns false and shows error toast when write throws', async () => {
    ;(MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' })
    ;(MediaLibrary.createAssetAsync as jest.Mock).mockRejectedValue(new Error('disk full'))

    const result = await downloadQRCodeImage(VALID_BASE64)

    expect(result).toBe(false)
    expect(showToast).toHaveBeenCalledWith('common.errorSavingQRCode')
  })
})
