import {
    checkMediaLibraryPermission,
    downloadAndSaveImage,
    requestMediaLibraryPermission,
} from '@/utils'
import { useCallback } from 'react'

/**
 * Hook to use download image functionality
 */
export function useDownloadImage() {
  const downloadImage = useCallback(
    async (imageUrl: string, fileName?: string) => {
      return await downloadAndSaveImage(imageUrl, fileName)
    },
    [],
  )

  const requestPermission = useCallback(async () => {
    return await requestMediaLibraryPermission()
  }, [])

  const checkPermission = useCallback(async () => {
    return await checkMediaLibraryPermission()
  }, [])

  return {
    downloadImage,
    requestPermission,
    checkPermission,
  }
}

