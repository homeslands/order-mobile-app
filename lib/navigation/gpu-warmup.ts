/**
 * GPU Surface Warmup — Android thường giật lần mở screen đầu tiên.
 * Chạy requestAnimationFrame noop để warm GPU surface.
 */
import { useEffect } from 'react'

export const useGpuWarmup = () => {
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {})
    })
    return () => cancelAnimationFrame(id)
  }, [])
}
