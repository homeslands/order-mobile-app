/**
 * useStaggeredMount — Dàn trải mount các giai đoạn để giảm JS Thread spike khi kết thúc transition.
 *
 * Kích hoạt từng stage tuần tự (300ms giữa mỗi stage) thay vì mount tất cả cùng lúc.
 *
 * Flow:
 *   1. InteractionManager.runAfterInteractions → stage đầu tiên
 *   2. setTimeout(delayMs) → stage 2
 *   3. setTimeout(delayMs * 2) → stage 3
 *   ...
 *
 * Usage:
 *   const { HEADER_READY, INFO_READY, CONTENT_READY, RELATED_READY } = useStaggeredMount(
 *     ['HEADER_READY', 'INFO_READY', 'CONTENT_READY', 'RELATED_READY'],
 *     { delayMs: 120 }
 *   )
 *   return (
 *     <>
 *       {HEADER_READY && <Header />}
 *       {INFO_READY && <InfoBlock />}
 *       {CONTENT_READY && <Content />}
 *       {RELATED_READY && <RelatedProducts />}
 *     </>
 *   )
 */
import { useEffect, useRef, useState } from 'react'
import { InteractionManager } from 'react-native'

export interface UseStaggeredMountOptions {
  /** Khoảng cách giữa các stage (ms). 300ms khuyến nghị để tránh JS Thread spike. */
  delayMs?: number
  /** Delay (ms) trước khi stage đầu tiên bật — tránh mount ngay khi transition vừa xong. */
  initialDelayMs?: number
}

export type StaggeredMountResult<T extends string> = Record<T, boolean>

export function useStaggeredMount<T extends string>(
  stages: readonly T[],
  options: UseStaggeredMountOptions = {},
): StaggeredMountResult<T> {
  const { delayMs = 300, initialDelayMs = 0 } = options

  const [activeStages, setActiveStages] = useState<Record<string, boolean>>(
    () => Object.fromEntries(stages.map((s) => [s, false])),
  )

  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const stagesRef = useRef(stages)
  const stagesKey = stages.join(',')

  useEffect(() => {
    stagesRef.current = stages
    if (stages.length === 0) return

    const run = () => {
      const currentStages = stagesRef.current
      if (currentStages.length === 0) return

      setActiveStages((prev) => ({ ...prev, [currentStages[0]]: true }))

      for (let i = 1; i < currentStages.length; i++) {
        const stage = currentStages[i]
        const id = setTimeout(() => {
          setActiveStages((prev) => ({ ...prev, [stage]: true }))
        }, delayMs * i)
        timeoutIdsRef.current.push(id)
      }
    }

    const task = InteractionManager.runAfterInteractions(() => {
      if (initialDelayMs > 0) {
        const id = setTimeout(run, initialDelayMs)
        timeoutIdsRef.current.push(id)
      } else {
        run()
      }
    })

    return () => {
      task.cancel()
      timeoutIdsRef.current.forEach(clearTimeout)
      timeoutIdsRef.current = []
    }
  }, [stagesKey, delayMs, initialDelayMs, stages])

  return activeStages as StaggeredMountResult<T>
}
