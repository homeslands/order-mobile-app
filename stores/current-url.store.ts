import { create } from 'zustand'

interface ICurrentUrlStore {
  currentUrl: string | null
  lastSetTime: number | null
  setCurrentUrl: (url: string) => void
  clearUrl: () => void
  shouldUpdateUrl: (url: string) => boolean
}

export const useCurrentUrlStore = create<ICurrentUrlStore>()((set, get) => ({
  currentUrl: null,
  lastSetTime: null,
  setCurrentUrl: (url: string) => {
    const now = Date.now()
    set({ currentUrl: url, lastSetTime: now })
  },
  clearUrl: () => set({ currentUrl: null, lastSetTime: null }),
  shouldUpdateUrl: (url: string) => {
    const { currentUrl, lastSetTime } = get()
    const now = Date.now()
    if (!currentUrl) return true
    if (currentUrl !== url) return true
    if (lastSetTime && now - lastSetTime > 5000) return true
    return false
  },
}))
