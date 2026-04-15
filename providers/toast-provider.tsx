import ToastItem, { ToastData } from '@/components/ui/toast'
import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

// Toast context
const ToastContext = createContext<{
  showToast: (title: string, message?: string, type?: 'info' | 'error' | 'success' | 'warning') => void
} | null>(null)

// Global toast function ref
let globalShowToast: ((title: string, message?: string, type?: 'info' | 'error' | 'success' | 'warning') => void) | null = null

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within AppToastProvider')
  }
  return context
}

function AppToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const showToast = useCallback((
    title: string,
    message?: string,
    type: 'info' | 'error' | 'success' | 'warning' = 'info'
  ) => {
    const id = `${Date.now()}-${Math.random()}`
    const duration = type === 'error' ? 4 : 2

    const newToast: ToastData = {
      id,
      title,
      message,
      type,
      duration,
    }

    setToasts((prev) => [...prev, newToast])
  }, [])

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  // Set global function
  const showToastRef = useRef(showToast)

  useEffect(() => {
    showToastRef.current = showToast
    globalShowToast = (title: string, message?: string, type?: 'info' | 'error' | 'success' | 'warning') => {
      showToastRef.current(title, message, type)
    }
  }, [showToast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none', zIndex: 9999 }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onHide={hideToast} />
        ))}
      </View>
    </ToastContext.Provider>
  )
}

AppToastProvider.displayName = 'AppToastProvider'

// Export function to show toast from anywhere
export function showToastInternal(
  title: string,
  message?: string,
  type: 'info' | 'error' | 'success' | 'warning' = 'info'
) {
  if (globalShowToast) {
    globalShowToast(title, message, type)
  } else {
    // eslint-disable-next-line no-console
    console.warn('Toast provider not initialized yet')
  }
}

export default AppToastProvider
