/**
 * Pure utilities cho Google Map / delivery.
 * Hooks đã chuyển sang hooks/use-branch-delivery.ts
 *
 * @see docs/IMPLEMENTATION_TASKS.md T-503
 */
export const parseKm = (distance?: number): number | null => {
  if (distance == null || Number.isNaN(distance)) return null
  return distance
}
