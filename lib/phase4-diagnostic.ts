/**
 * Phase 4 crash diagnostic — bật khi cần tìm nguyên nhân crash lazy: false.
 * Set EXPO_PUBLIC_PHASE4_LAZY_DEBUG=true trong .env rồi rebuild.
 * Log sẽ xuất trong logcat — xem thứ tự mount tab trước khi crash.
 */
import { useEffect } from 'react'

const LAZY_DEBUG = process.env.EXPO_PUBLIC_PHASE4_LAZY_DEBUG === 'true'

export const isPhase4LazyDebug = () => LAZY_DEBUG

export const usePhase4MountLog = (tabName: string) => {
  useEffect(() => {
    if (!LAZY_DEBUG) return
    return () => {}
  }, [tabName])
}
