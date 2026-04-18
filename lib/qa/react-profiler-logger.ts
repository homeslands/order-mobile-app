import type { ProfilerOnRenderCallback } from 'react'

type ProfilerAggregate = {
  id: string
  samples: number
  totalActualDuration: number
  maxActualDuration: number
  totalBaseDuration: number
}

const aggregates = new Map<string, ProfilerAggregate>()

function isEnabled(): boolean {
  const g = globalThis as { __ENABLE_REACT_PROFILER?: boolean } | undefined
  return !!g?.__ENABLE_REACT_PROFILER
}

export const onReactProfilerRender: ProfilerOnRenderCallback = (
  id,
  _phase,
  actualDuration,
  baseDuration,
) => {
  if (!isEnabled()) return
  const prev = aggregates.get(id)
  if (!prev) {
    aggregates.set(id, {
      id,
      samples: 1,
      totalActualDuration: actualDuration,
      maxActualDuration: actualDuration,
      totalBaseDuration: baseDuration,
    })
    return
  }
  prev.samples += 1
  prev.totalActualDuration += actualDuration
  prev.totalBaseDuration += baseDuration
  prev.maxActualDuration = Math.max(prev.maxActualDuration, actualDuration)
}

export function resetReactProfilerStats(): void {
  aggregates.clear()
}

export function getReactProfilerStats(): Array<{
  id: string
  samples: number
  avgActualDurationMs: number
  maxActualDurationMs: number
  totalActualDurationMs: number
  avgBaseDurationMs: number
}> {
  return [...aggregates.values()]
    .map((row) => ({
      id: row.id,
      samples: row.samples,
      avgActualDurationMs: Number(
        (row.totalActualDuration / Math.max(1, row.samples)).toFixed(2),
      ),
      maxActualDurationMs: Number(row.maxActualDuration.toFixed(2)),
      totalActualDurationMs: Number(row.totalActualDuration.toFixed(2)),
      avgBaseDurationMs: Number(
        (row.totalBaseDuration / Math.max(1, row.samples)).toFixed(2),
      ),
    }))
    .sort((a, b) => b.totalActualDurationMs - a.totalActualDurationMs)
}

export function printReactProfilerStats(): void {
  if (!isEnabled()) {
    // eslint-disable-next-line no-console
    console['log']('[ReactProfiler] disabled (__ENABLE_REACT_PROFILER is false)')
    return
  }
  const rows = getReactProfilerStats()
  if (rows.length === 0) {
    // eslint-disable-next-line no-console
    console['log']('[ReactProfiler] no samples')
    return
  }
  // console.table may not show reliably on React Native logcat, so emit line logs too.
  // eslint-disable-next-line no-console
  console['log'](`[ReactProfiler] rows=${rows.length}`)
  rows.forEach((row, index) => {
    // eslint-disable-next-line no-console
    console['log'](
      `[ReactProfiler] #${index + 1} ${row.id} samples=${row.samples} avgActual=${row.avgActualDurationMs}ms maxActual=${row.maxActualDurationMs}ms totalActual=${row.totalActualDurationMs}ms avgBase=${row.avgBaseDurationMs}ms`,
    )
  })
}
