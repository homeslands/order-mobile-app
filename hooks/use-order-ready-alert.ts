import { useCallback, useState } from 'react'

interface OrderReadyAlertState {
  isVisible: boolean
  title: string
  body: string
}

const HIDDEN: OrderReadyAlertState = { isVisible: false, title: '', body: '' }

export function useOrderReadyAlert() {
  const [state, setState] = useState<OrderReadyAlertState>(HIDDEN)

  const show = useCallback((title: string, body: string) => {
    setState({ isVisible: true, title, body })
  }, [])

  const hide = useCallback(() => {
    setState(HIDDEN)
  }, [])

  return { ...state, show, hide }
}
