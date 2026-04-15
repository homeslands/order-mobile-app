type FlowEvent = {
  name: string
  t: number
  data?: Record<string, unknown>
}

type FlowState = {
  startAt: number | null
  events: FlowEvent[]
}

const flowState: FlowState = {
  startAt: null,
  events: [],
}

function getGlobalFlags(): {
  __ENABLE_CART_FLOW_BENCHMARK?: boolean
} {
  return (globalThis as unknown as {
    __ENABLE_CART_FLOW_BENCHMARK?: boolean
  })
}

function isEnabled(): boolean {
  return !!getGlobalFlags().__ENABLE_CART_FLOW_BENCHMARK
}

export function enableCartFlowBenchmark(): void {
  getGlobalFlags().__ENABLE_CART_FLOW_BENCHMARK = true
}

export function resetCartFlowBenchmark(): void {
  flowState.startAt = null
  flowState.events = []
}

export function markCartFlowEvent(
  name: string,
  data?: Record<string, unknown>,
): void {
  if (!isEnabled()) return
  const now = Date.now()
  if (flowState.startAt == null) flowState.startAt = now
  flowState.events.push({
    name,
    t: now - flowState.startAt,
    data,
  })
}

export function getCartFlowBenchmarkEvents(): FlowEvent[] {
  return [...flowState.events]
}

export function printCartFlowBenchmarkReport(): void {
  if (!isEnabled()) return
  if (flowState.events.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[CartFlowBenchmark] no events')
    return
  }
  const rows = flowState.events.map((e, i) => ({
    '#': i + 1,
    event: e.name,
    atMs: e.t,
    data: e.data ? JSON.stringify(e.data) : '',
  }))
  // eslint-disable-next-line no-console
  console.table(rows)
}

