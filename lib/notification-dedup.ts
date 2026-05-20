/**
 * notification-dedup — process-scoped message ID dedup shared between
 * foreground listener (use-notification-listener) and background/cold-start
 * response handler (use-notification-response).
 *
 * Module-level state survives hook re-mounts and auth toggles.
 * Call clearProcessed() on logout to prevent cross-user dedup leaks.
 */

const processedIds = new Set<string>()
const MAX_PROCESSED_IDS = 100

export function hasProcessed(id: string): boolean {
  return processedIds.has(id)
}

export function markProcessed(id: string): void {
  processedIds.add(id)
  if (processedIds.size > MAX_PROCESSED_IDS) {
    const oldest = processedIds.values().next().value
    if (oldest !== undefined) processedIds.delete(oldest)
  }
}

export function clearProcessed(): void {
  processedIds.clear()
}
