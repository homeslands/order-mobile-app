import enAuth from './en/auth.json'
import enPayment from './en/payment.json'
import enGiftCard from './en/gift-card.json'
import enCommon from './en/common.json'
import enHome from './en/home.json'
import enMenu from './en/menu.json'
import enNotification from './en/notification.json'
import enOnboarding from './en/onboarding.json'
import enProduct from './en/product.json'
import enProfile from './en/profile.json'
import enTable from './en/table.json'
import enTabs from './en/tabs.json'
import enToast from './en/toast.json'
import enVoucher from './en/voucher.json'

import viAuth from './vi/auth.json'
import viPayment from './vi/payment.json'
import viGiftCard from './vi/gift-card.json'
import viCommon from './vi/common.json'
import viHome from './vi/home.json'
import viMenu from './vi/menu.json'
import viNotification from './vi/notification.json'
import viOnboarding from './vi/onboarding.json'
import viProduct from './vi/product.json'
import viProfile from './vi/profile.json'
import viTable from './vi/table.json'
import viTabs from './vi/tabs.json'
import viToast from './vi/toast.json'
import viVoucher from './vi/voucher.json'

export const resources = {
  vi: {
    auth: viAuth,
    payment: viPayment,
    giftCard: viGiftCard,
    home: viHome.home,
    menu: viMenu,
    notification: viNotification,
    onboarding: viOnboarding,
    table: viTable,
    tabs: viTabs,
    voucher: viVoucher,
    common: viCommon,
    product: viProduct,
    toast: viToast,
    profile: viProfile,
  },
  en: {
    auth: enAuth,
    payment: enPayment,
    giftCard: enGiftCard,
    home: enHome.home,
    menu: enMenu,
    notification: enNotification,
    onboarding: enOnboarding,
    table: enTable,
    tabs: enTabs,
    voucher: enVoucher,
    common: enCommon,
    product: enProduct,
    toast: enToast,
    profile: enProfile,
  },
} as const
