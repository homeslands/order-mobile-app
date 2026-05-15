/**
 * Transient navigation store — short-lived in-memory payload for screen
 * transitions, used in place of stringifying large props into route params.
 *
 * - NO persistence (purely RAM-local).
 * - Producer (e.g. menu) writes via `setHeroImageUrls` immediately before
 *   `router.push(...)`.
 * - Consumer (e.g. product detail) reads via `useTransientNavStore.getState()`
 *   on mount. Reading via getState() avoids subscribing to changes.
 */
import { create } from 'zustand'

interface TransientNavStore {
  heroImageUrls: string[]
  setHeroImageUrls: (urls: string[]) => void
  clearHeroImageUrls: () => void
}

export const useTransientNavStore = create<TransientNavStore>((set) => ({
  heroImageUrls: [],
  setHeroImageUrls: (urls) => set({ heroImageUrls: urls }),
  clearHeroImageUrls: () => set({ heroImageUrls: [] }),
}))
