import { create } from 'zustand'

/**
 * Navigation loading state store
 * Used to show loading overlay during screen transitions
 */
interface NavigationLoadingStore {
  isLoading: boolean
  setLoading: (loading: boolean) => void
}

export const useNavigationLoadingStore = create<NavigationLoadingStore>((set) => ({
  isLoading: false,
  setLoading: (isLoading: boolean) => set({ isLoading }),
}))

/**
 * Hook to get loading state
 * @returns boolean - true if showing loading overlay
 */
export const useNavigationLoading = () =>
  useNavigationLoadingStore((state) => state.isLoading)

/**
 * Hook to set loading state
 * @returns function to set loading state
 */
export const useSetNavigationLoading = () =>
  useNavigationLoadingStore((state) => state.setLoading)

/**
 * Hook to get both loading state and setter
 * @returns { isLoading, setLoading }
 */
export const useNavigationLoadingControl = () =>
  useNavigationLoadingStore((state) => ({
    isLoading: state.isLoading,
    setLoading: state.setLoading,
  }))
