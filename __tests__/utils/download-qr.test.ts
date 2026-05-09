import * as MediaLibrary from 'expo-media-library'
import * as LegacyFS from 'expo-file-system/legacy'

jest.mock('expo-media-library', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  createAssetAsync: jest.fn(),
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

import { downloadQRCodeImage } from '@/utils/download-image'
import { showToast } from '@/utils/toast'

const VALID_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('downloadQRCodeImage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns false and shows toast when permission denied', async () => {
    ;(MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    })
    ;(MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    })

    const result = await downloadQRCodeImage(VALID_BASE64, 'test_qr')

    expect(result).toBe(false)
    expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith('common.noPhotoLibraryPermission')
  })

  it('writes base64 PNG to cache and saves to media library when permitted', async () => {
    ;(MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    })
    ;(MediaLibrary.createAssetAsync as jest.Mock).mockResolvedValue({
      id: 'asset-1',
    })

    const result = await downloadQRCodeImage(VALID_BASE64, 'payment_qr')

    expect(LegacyFS.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///cache/payment_qr.png',
      VALID_BASE64,
      { encoding: 'base64' },
    )
    expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith(
      'file:///cache/payment_qr.png',
    )
    expect(result).toBe(true)
  })

  it('returns false and shows error toast when file write fails', async () => {
    ;(MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    })
    ;(LegacyFS.writeAsStringAsync as jest.Mock).mockRejectedValue(
      new Error('write failed'),
    )

    const result = await downloadQRCodeImage(VALID_BASE64)

    expect(result).toBe(false)
    expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith('common.errorSavingQRCode')
  })

  it('returns false and shows error toast when createAssetAsync fails', async () => {
    ;(MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    })
    ;(MediaLibrary.createAssetAsync as jest.Mock).mockRejectedValue(
      new Error('disk full'),
    )

    const result = await downloadQRCodeImage(VALID_BASE64)

    expect(result).toBe(false)
    expect(showToast).toHaveBeenCalledWith('common.errorSavingQRCode')
  })
})
