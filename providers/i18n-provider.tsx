import i18n from '@/i18n'
import { useUserStore } from '@/stores'
import { type PropsWithChildren, useEffect } from 'react'

const normalizeLanguage = (lang?: string) => {
  if (!lang) return null
  if (lang.startsWith('en')) return 'en'
  if (lang.startsWith('vi')) return 'vi'
  return null
}

function syncLanguage() {
  const lang = useUserStore.getState().userInfo?.language
  const normalized = normalizeLanguage(lang)
  if (normalized) i18n.changeLanguage(normalized)
}

export function I18nProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    syncLanguage()
    const unsub = useUserStore.subscribe(syncLanguage)
    return unsub
  }, [])

  return children
}
