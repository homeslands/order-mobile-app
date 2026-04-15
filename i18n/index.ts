import * as Localization from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources'

const normalizeLanguage = (lang?: string) => {
  if (!lang) return 'vi'
  return lang.startsWith('en') ? 'en' : 'vi'
}

const deviceLanguage = normalizeLanguage(
  Localization.getLocales()[0]?.languageCode ?? undefined,
)

// Use type assertion to avoid false positive warning about named export 'use'
;(i18n as typeof i18n).use(initReactI18next).init({
  resources,
  lng: deviceLanguage,
  fallbackLng: 'vi',
  defaultNS: 'home', // Set to 'home' since we don't have 'common' namespace
  ns: ['home', 'auth', 'menu', 'voucher', 'table', 'common', 'product', 'toast', 'profile', 'giftCard', 'payment'],
  interpolation: {
    escapeValue: false,
  },
  react: {
    // Chỉ re-render khi đổi ngôn ngữ — tránh re-render do store/loaded events
    bindI18n: 'languageChanged',
    bindI18nStore: '',
  },
})

export default i18n
