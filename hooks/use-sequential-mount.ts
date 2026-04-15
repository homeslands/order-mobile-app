/**
 * useSequentialMount — Dàn trải mount các block UI để giảm spike JS Thread.
 *
 * Thay vì mount tất cả (header, content, carousel, slider) cùng lúc → JS 100%,
 * hook kích hoạt từng stage tuần tự với khoảng delay 100–150ms.
 *
 * Flow:
 *   1. InteractionManager.runAfterInteractions → stage đầu tiên
 *   2. setTimeout(delayMs) → stage 2
 *   3. setTimeout(delayMs * 2) → stage 3
 *   ...
 *
 * Usage:
 *   const { BASIC_INFO, DESCRIPTION, RELATED_PRODUCTS } = useSequentialMount(
 *     ['BASIC_INFO', 'DESCRIPTION', 'RELATED_PRODUCTS'],
 *     { delayMs: 120 }
 *   )
 *   return (
 *     <>
 *       {BASIC_INFO && <BasicInfoBlock />}
 *       {DESCRIPTION && <DescriptionBlock />}
 *       {RELATED_PRODUCTS && <SliderRelatedProducts />}
 *     </>
 *   )
 */
import { useEffect, useRef, useState } from 'react'
import { InteractionManager } from 'react-native'

export interface UseSequentialMountOptions {
  /** Khoảng cách giữa các stage (ms). 100–150ms giúp dàn trải CPU. */
  delayMs?: number
}

export type SequentialMountResult<T extends string> = Record<T, boolean>

export function useSequentialMount<T extends string>(
  stages: readonly T[],
  options: UseSequentialMountOptions = {},
): SequentialMountResult<T> {
  const { delayMs = 120 } = options

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

      // Stage 0: kích hoạt ngay sau runAfterInteractions (transition xong)
      setActiveStages((prev) => ({ ...prev, [currentStages[0]]: true }))

      for (let i = 1; i < currentStages.length; i++) {
        const stage = currentStages[i]
        const id = setTimeout(() => {
          setActiveStages((prev) => ({ ...prev, [stage]: true }))
        }, delayMs * i)
        timeoutIdsRef.current.push(id)
      }
    }

    const task = InteractionManager.runAfterInteractions(run)

    return () => {
      task.cancel()
      timeoutIdsRef.current.forEach(clearTimeout)
      timeoutIdsRef.current = []
    }
  }, [stagesKey, delayMs, stages])

  return activeStages as SequentialMountResult<T>
}
