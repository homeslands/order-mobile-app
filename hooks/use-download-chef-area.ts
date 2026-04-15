import { useCallback } from 'react'

import {
  exportAutoChefOrderTicket,
  exportChefOrder,
  exportManualChefOrderTicket,
} from '@/api'
import { useDownloadStore } from '@/stores'

/**
 * Hook tách logic download chef-area khỏi api layer.
 * API chỉ gọi HTTP; hook gắn useDownloadStore cho progress UI.
 *
 * @see docs/IMPLEMENTATION_TASKS.md T-502
 */
export function useDownloadChefArea() {
  const { setProgress, setFileName, setIsDownloading, reset } =
    useDownloadStore()

  const handleExportChefOrder = useCallback(
    async (slug: string) => {
      const currentDate = new Date().toISOString()
      setFileName(`TRENDCoffee-${currentDate}.pdf`)
      setIsDownloading(true)
      try {
        return await exportChefOrder(slug, { onProgress: setProgress })
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    [setProgress, setFileName, setIsDownloading, reset],
  )

  const handleExportManualTicket = useCallback(
    async (slug: string) => {
      const currentDate = new Date().toISOString()
      setFileName(`TRENDCoffee-invoice-${currentDate}.pdf`)
      setIsDownloading(true)
      try {
        return await exportManualChefOrderTicket(slug, {
          onProgress: setProgress,
        })
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    [setProgress, setFileName, setIsDownloading, reset],
  )

  const handleExportAutoTicket = useCallback(
    async (slug: string) => {
      const currentDate = new Date().toISOString()
      setFileName(`TRENDCoffee-invoice-${currentDate}.pdf`)
      setIsDownloading(true)
      try {
        return await exportAutoChefOrderTicket(slug, {
          onProgress: setProgress,
        })
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    [setProgress, setFileName, setIsDownloading, reset],
  )

  return {
    exportChefOrder: handleExportChefOrder,
    exportManualChefOrderTicket: handleExportManualTicket,
    exportAutoChefOrderTicket: handleExportAutoTicket,
  }
}
