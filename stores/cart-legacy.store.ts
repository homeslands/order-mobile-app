import dayjs from 'dayjs'
import i18next from 'i18next'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { Role, VOUCHER_CUSTOMER_TYPE } from '@/constants'
import { requestClearStoresExcept } from '@/lib/store-sync'
import {
  ICartItem,
  ICartItemStore,
  ITable,
  IUserInfo,
  IVoucher,
  OrderTypeEnum,
} from '@/types'
import { asyncStorage, createSafeStorage } from '@/utils/storage'
import { showToast } from '@/utils/toast'

/** Single timer ref — prevents stacking when addCartItem is called multiple times */
let _cartExpirationTimer: ReturnType<typeof setTimeout> | null = null

/** Setup auto clear cart based on expiration time — kept internal to avoid circular dep */
const setupAutoClearCart = async (): Promise<void> => {
  const { clearCart, getCartItems } = useCartItemStore.getState()
  const cartItems = getCartItems()
  if (!cartItems) return
  try {
    const expirationTime = await asyncStorage.getItem('cart-expiration-time')
    if (expirationTime && dayjs().valueOf() > parseInt(expirationTime)) {
      clearCart()
      await asyncStorage.removeItem('cart-expiration-time')
      return
    }
    if (!expirationTime) {
      const tomorrow = dayjs().add(1, 'day').startOf('day')
      await asyncStorage.setItem(
        'cart-expiration-time',
        tomorrow.valueOf().toString(),
      )
    }
    const timeUntilExpiration =
      parseInt(expirationTime || '0') - dayjs().valueOf()
    if (timeUntilExpiration > 0) {
      // Cancel any previously scheduled timer before creating a new one
      if (_cartExpirationTimer !== null) {
        clearTimeout(_cartExpirationTimer)
      }
      _cartExpirationTimer = setTimeout(async () => {
        _cartExpirationTimer = null
        try {
          clearCart()
          await asyncStorage.removeItem('cart-expiration-time')
        } catch (error) {
          throw new Error(`Error clearing cart expiration: ${error}`)
        }
      }, timeUntilExpiration)
    }
  } catch (error) {
    throw new Error(`Error setting up auto clear cart: ${error}`)
  }
}

export const useCartItemStore = create<ICartItemStore>()(
  persist(
    (set, get) => ({
      cartItems: null,
      lastModified: null,
      isHydrated: false,

      getCartItems: () => get().cartItems,

      addCustomerInfo: (owner: IUserInfo) => {
        requestClearStoresExcept('cart')

        const { cartItems } = get()
        if (cartItems) {
          const hasFirstName = owner.firstName && owner.firstName.trim() !== ''
          const hasLastName = owner.lastName && owner.lastName.trim() !== ''
          const ownerFullName =
            hasFirstName || hasLastName
              ? `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim()
              : ''

          set({
            cartItems: {
              ...cartItems,
              owner: owner.slug,
              ownerPhoneNumber: owner.phonenumber,
              ownerFullName: ownerFullName,
              ownerRole: owner.role.name,
            },
            lastModified: dayjs().valueOf(),
          })
        }
      },

      removeCustomerInfo: () => {
        const { cartItems } = get()
        if (cartItems) {
          // Check if current voucher requires verification
          const requiresVerification =
            cartItems.voucher?.isVerificationIdentity === true

          set({
            cartItems: {
              ...cartItems,
              owner: '',
              ownerFullName: '',
              ownerPhoneNumber: '',
              ownerRole: '',
              // Remove voucher if it requires verification
              voucher: requiresVerification ? null : cartItems.voucher,
            },
            lastModified: dayjs().valueOf(),
          })
        }
      },

      addApprovalBy: (approvalBy: string) => {
        const { cartItems } = get()
        if (cartItems) {
          set({
            cartItems: { ...cartItems, approvalBy },
            lastModified: dayjs().valueOf(),
          })
        }
      },

      addCartItem: (item: ICartItem) => {
        requestClearStoresExcept('cart')

        // Kiểm tra hydration với timeout fallback
        if (!get().isHydrated) {
          // Store chưa hydrate, đang chờ...

          // Thử lại sau 100ms nếu chưa hydrate
          setTimeout(() => {
            if (get().isHydrated) {
              // Store đã hydrate, thực hiện addCartItem
              get().addCartItem(item)
            } else {
              // Store vẫn chưa hydrate sau 100ms, force thực hiện action
              // Force thực hiện action nếu sau 100ms vẫn chưa hydrate
              // get().addCartItem({ ...item, forceAdd: true })
            }
          }, 100)
          return
        }

        // Nếu là force add, bỏ qua check hydration
        const timestamp = dayjs().valueOf()
        const { cartItems } = get()

        if (!cartItems) {
          const newCart = {
            id: `cart_${timestamp}`,
            slug: `cart_${timestamp}`,
            owner: item.owner || '',
            type: item.type,
            orderItems: item.orderItems.map((orderItem) => ({
              ...orderItem,
              id: `cart_${timestamp}_order_${orderItem.id}`,
            })),
            table: item.table || '',
            tableName: item.tableName || '',
            voucher: null,
            approvalBy: '',
            ownerPhoneNumber: '',
            ownerFullName: '',
            ownerRole: Role.CUSTOMER,
          }

          // Use setTimeout as fallback for queueMicrotask in React Native
          setTimeout(() => {
            set({
              cartItems: newCart,
              lastModified: timestamp,
            })
          }, 0)
        } else {
          const newOrderItems = [
            ...cartItems.orderItems,
            ...item.orderItems.map((orderItem) => ({
              ...orderItem,
              id: `cart_${cartItems.id}_order_${orderItem.id}`,
            })),
          ]

          // Use setTimeout as fallback for queueMicrotask in React Native
          setTimeout(() => {
            set({
              cartItems: {
                ...cartItems,
                orderItems: newOrderItems,
              },
              lastModified: timestamp,
            })
          })
        }
        showToast(i18next.t('toast.addSuccess'))
        // Setup auto clear cart với error handling
        setupAutoClearCart().catch(() => {})
      },

      addProductVariant: (id: string) => {
        const { cartItems } = get()
        if (cartItems) {
          const updatedOrderItems = cartItems.orderItems.map((orderItem) =>
            orderItem.id === id
              ? {
                  ...orderItem,
                  variant: orderItem.variant || [],
                }
              : orderItem,
          )

          set({
            cartItems: {
              ...cartItems,
              orderItems: updatedOrderItems,
            },
            lastModified: dayjs().valueOf(),
          })
        }
      },

      updateCartItemQuantity: (id: string, quantity: number) => {
        const { cartItems } = get()
        if (cartItems) {
          const updatedOrderItems = cartItems.orderItems.map((orderItem) =>
            orderItem.id === id ? { ...orderItem, quantity } : orderItem,
          )

          set({
            cartItems: {
              ...cartItems,
              orderItems: updatedOrderItems,
            },
            lastModified: dayjs().valueOf(),
          })
        }
      },

      addNote: (id: string, note: string) => {
        const { cartItems } = get()
        if (cartItems) {
          const updatedOrderItems = cartItems.orderItems.map((orderItem) =>
            orderItem.id === id ? { ...orderItem, note } : orderItem,
          )

          set({
            cartItems: {
              ...cartItems,
              orderItems: updatedOrderItems,
            },
            lastModified: dayjs().valueOf(),
          })
        }
      },

      addOrderNote: (note: string) => {
        const { cartItems } = get()
        if (cartItems) {
          set({ cartItems: { ...cartItems, description: note } })
        }
      },

      addTable: (table: ITable) => {
        requestClearStoresExcept('cart')

        const { cartItems } = get()
        const timestamp = dayjs().valueOf()

        if (!cartItems) {
          set({
            cartItems: {
              id: `cart_${timestamp}`,
              slug: `cart_${timestamp}`,
              owner: '',
              type: OrderTypeEnum.AT_TABLE,
              orderItems: [],
              table: table.slug,
              tableName: table.name,
              voucher: null,
              approvalBy: '',
              ownerPhoneNumber: '',
              ownerFullName: '',
            },
            lastModified: timestamp,
          })
        } else {
          set({
            cartItems: {
              ...cartItems,
              table: table.slug,
              tableName: table.name,
            },
            lastModified: timestamp,
          })
        }
      },

      removeTable: () => {
        const { cartItems } = get()
        if (cartItems) {
          set({
            cartItems: { ...cartItems, table: '', tableName: '' },
            lastModified: dayjs().valueOf(),
          })
        }
      },

      addPaymentMethod: (paymentMethod: string) => {
        const { cartItems } = get()
        if (cartItems) {
          set({
            cartItems: { ...cartItems, paymentMethod },
            lastModified: dayjs().valueOf(),
          })
        }
      },

      addOrderType: (orderType: OrderTypeEnum) => {
        const { cartItems } = get()
        if (cartItems) {
          set({
            cartItems: { ...cartItems, type: orderType },
            lastModified: dayjs().valueOf(),
          })
        }
      },

      removeCartItem: (cartItemId: string) => {
        const { cartItems } = get()
        if (cartItems) {
          const updatedOrderItems = cartItems.orderItems.filter(
            (orderItem) => orderItem.id !== cartItemId,
          )

          if (updatedOrderItems.length === 0) {
            get().clearCart()
          } else {
            set({
              cartItems: {
                ...cartItems,
                orderItems: updatedOrderItems,
              },
              lastModified: dayjs().valueOf(),
            })
          }

          showToast(i18next.t('toast.removeSuccess'))
        }
      },
      addVoucher: (voucher: IVoucher) => {
        const { cartItems } = get()
        if (!cartItems) return

        set({
          cartItems: {
            ...cartItems,
            voucher: {
              voucherGroup: voucher.voucherGroup,
              applicabilityRule: voucher.applicabilityRule,
              createdAt: voucher.createdAt,
              remainingUsage: voucher.remainingUsage || 0,
              startDate: voucher.startDate,
              endDate: voucher.endDate,
              voucherPaymentMethods: voucher.voucherPaymentMethods || [],
              numberOfUsagePerUser: voucher.numberOfUsagePerUser || 0,
              slug: voucher.slug,
              title: voucher.title,
              description: voucher.description || '',
              maxUsage: voucher.maxUsage || 0,
              isActive: voucher.isActive || false,
              maxItems: voucher.maxItems || 0,
              usageFrequencyUnit: voucher.usageFrequencyUnit || '',
              usageFrequencyValue: voucher.usageFrequencyValue || 0,
              value: voucher.value,
              isVerificationIdentity: voucher.isVerificationIdentity || false,
              isPrivate: voucher.isPrivate || false,
              customerType: voucher.customerType || VOUCHER_CUSTOMER_TYPE.ALL,
              code: voucher.code,
              type: voucher.type,
              minOrderValue: voucher.minOrderValue || 0,
              voucherProducts: voucher.voucherProducts || [],
            },
            // orderItems giữ nguyên, không tính toán gì
          },
          lastModified: dayjs().valueOf(),
        })
      },

      // addVoucher: (voucher: IVoucher) => {
      //   const { cartItems } = get()
      //   if (!cartItems) return

      //   const orderItems = cartItems.orderItems
      //   const applicableProducts =
      //     voucher.voucherProducts?.map((p) => p.product.slug) || []
      //   const updatedOrderItems = [...orderItems]

      //   for (let i = 0; i < updatedOrderItems.length; i++) {
      //     const item = updatedOrderItems[i]
      //     const originalPrice = item.originalPrice ?? item.price
      //     let voucherDiscount = 0
      //     let finalPrice = originalPrice

      //     if (voucher.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT) {
      //       // Chỉ áp dụng nếu sản phẩm nằm trong danh sách voucherProducts
      //       if (applicableProducts.includes(item.slug)) {
      //         // Bỏ qua promotion, giảm theo originalPrice
      //         voucherDiscount = Math.max(
      //           0,
      //           (originalPrice || 0) - voucher.value,
      //         )
      //         finalPrice = Math.max(0, voucher.value)
      //       } else {
      //         // Nếu không thuộc sản phẩm trong voucher, giữ nguyên promotion nếu có
      //         const promotionDiscount = item.promotionDiscount ?? 0
      //         finalPrice = Math.max(0, (originalPrice || 0) - promotionDiscount)
      //       }
      //     }

      //     // Các type khác nếu có (giữ nguyên hoặc thêm sau)
      //     else {
      //       const promotionDiscount = item.promotionDiscount ?? 0

      //       if (voucher.type === VOUCHER_TYPE.PERCENT_ORDER) {
      //         voucherDiscount =
      //           (((originalPrice || 0) - promotionDiscount) * voucher.value) /
      //           100
      //       } else if (voucher.type === VOUCHER_TYPE.FIXED_VALUE) {
      //         const perItemDiscount = voucher.value / orderItems.length
      //         voucherDiscount = Math.min(
      //           (originalPrice || 0) - promotionDiscount,
      //           perItemDiscount,
      //         )
      //       }

      //       finalPrice = Math.max(
      //         0,
      //         (originalPrice || 0) - promotionDiscount - voucherDiscount,
      //       )
      //     }

      //     updatedOrderItems[i] = {
      //       ...item,
      //       voucherDiscount,
      //       price: finalPrice,
      //     }
      //   }

      //   set({
      //     cartItems: {
      //       ...cartItems,
      //       orderItems: updatedOrderItems,
      //       voucher: {
      //         slug: voucher.slug,
      //         value: voucher.value,
      //         isVerificationIdentity: voucher.isVerificationIdentity || false,
      //         isPrivate: voucher.isPrivate || false,
      //         code: voucher.code,
      //         type: voucher.type,
      //         minOrderValue: voucher.minOrderValue || 0,
      //         voucherProducts: voucher.voucherProducts || [],
      //       },
      //     },
      //     lastModified: moment().valueOf(),
      //   })
      // },

      removeVoucher: () => {
        const { cartItems } = get()
        if (!cartItems) return

        const updatedOrderItems = cartItems.orderItems.map((item) => {
          const originalPrice = item.originalPrice ?? item.originalPrice
          const promotionDiscount = item.promotionDiscount ?? 0
          const finalPrice = Math.max(
            0,
            (originalPrice || 0) - promotionDiscount,
          )

          return {
            ...item,
            voucherDiscount: 0,
            price: finalPrice,
          }
        })

        set({
          cartItems: {
            ...cartItems,
            orderItems: updatedOrderItems,
            voucher: null,
          },
          lastModified: dayjs().valueOf(),
        })
      },
      setPaymentMethod: (paymentMethod: string) => {
        const { cartItems } = get()
        if (cartItems) {
          set({
            cartItems: { ...cartItems, paymentMethod },
            lastModified: dayjs().valueOf(),
          })
        }
      },

      setOrderSlug: (orderSlug: string) => {
        const { cartItems } = get()
        if (cartItems) {
          set({
            cartItems: {
              ...cartItems,
              payment: {
                ...cartItems.payment,
                orderSlug,
              },
            },
            lastModified: dayjs().valueOf(),
          })
        }
      },

      setQrCode: (qrCode: string) => {
        const { cartItems } = get()
        if (cartItems) {
          set({
            cartItems: {
              ...cartItems,
              payment: {
                ...cartItems.payment,
                qrCode,
              },
            },
            lastModified: dayjs().valueOf(),
          })
        }
      },

      setPaymentSlug: (paymentSlug: string) => {
        const { cartItems } = get()
        if (cartItems) {
          set({
            cartItems: {
              ...cartItems,
              payment: {
                ...cartItems.payment,
                paymentSlug,
              },
            },
            lastModified: dayjs().valueOf(),
          })
        }
      },

      clearCart: () => {
        set({
          cartItems: null,
          lastModified: null,
        })
      },
    }),
    {
      name: 'cart-store',
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: (state) => ({
        cartItems: state.cartItems,
        lastModified: state.lastModified,
      }),
      // Fix hydration error here
      onRehydrateStorage: () => (error) => {
        // console.log('[Zustand] persistedState:', persistedState)
        if (error) {
          // console.error('[Zustand] Hydration error:', error)
        }

        // Set hydrated flag after store is rehydrated
        // Use setTimeout as fallback for queueMicrotask in React Native
        setTimeout(() => {
          useCartItemStore.setState({ isHydrated: true })
        }, 0)
      },
    },
  ),
)
