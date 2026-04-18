import {
  useForgotPasswordStore,
  type IForgotPasswordStore,
} from '@/stores/forgot-password.store'
import { useShallow } from 'zustand/react/shallow'
// import { VerificationMethod } from '@/constants'

/**
 * Memoized selectors for forgot password store
 * Prevents unnecessary re-renders by allowing components to subscribe to specific fields only
 */

// ============================================================================
// Single Field Selectors
// ============================================================================

/**
 * Select email field only
 * Component re-renders only if email changes
 */
export const selectEmail = (state: IForgotPasswordStore) => state.email

/**
 * Select phone number field only
 * Component re-renders only if phone number changes
 */
export const selectPhoneNumber = (state: IForgotPasswordStore) =>
  state.phoneNumber

/**
 * Select current step only
 * Component re-renders only if step changes
 */
export const selectStep = (state: IForgotPasswordStore) => state.step

/**
 * Select JWT token only
 * Component re-renders only if token changes
 */
export const selectToken = (state: IForgotPasswordStore) => state.token

/**
 * Select verification method only
 * Component re-renders only if method changes
 */
export const selectVerificationMethod = (state: IForgotPasswordStore) =>
  state.verificationMethod

/**
 * Select OTP expiration time only
 * Component re-renders only if OTP expiration changes
 */
export const selectExpireTime = (state: IForgotPasswordStore) =>
  state.expireTime

/**
 * Select JWT expiration time only
 * Component re-renders only if JWT expiration changes
 */
export const selectTokenExpireTime = (state: IForgotPasswordStore) =>
  state.tokenExpireTime

// ============================================================================
// Composite Selectors (Group Related Fields)
// ============================================================================

/**
 * Select user identity (email, phone, method)
 * Useful for forms that need all identity info
 * Component re-renders if any identity field changes
 */
export const selectIdentity = (state: IForgotPasswordStore) => ({
  email: state.email,
  phoneNumber: state.phoneNumber,
  verificationMethod: state.verificationMethod,
})

/**
 * Select flow state (step, token)
 * Useful for navigation and state management
 * Component re-renders if step or token changes
 */
export const selectFlowState = (state: IForgotPasswordStore) => ({
  step: state.step,
  token: state.token,
})

/**
 * Select timing state (both expiration times)
 * Useful for countdown components
 * Component re-renders if either expiration changes
 */
export const selectTimingState = (state: IForgotPasswordStore) => ({
  expireTime: state.expireTime,
  tokenExpireTime: state.tokenExpireTime,
})

/**
 * Select all expiration info needed for display
 * Useful for countdown display logic
 */
export const selectExpirations = (state: IForgotPasswordStore) => ({
  otpExpiresAt: state.expireTime,
  tokenExpiresAt: state.tokenExpireTime,
})

// ============================================================================
// Action Selectors (Stable References)
// ============================================================================

/**
 * Select all setter actions
 * Actions never change, so component using this never re-renders
 */
export const selectActions = (state: IForgotPasswordStore) => ({
  setEmail: state.setEmail,
  setPhoneNumber: state.setPhoneNumber,
  setStep: state.setStep,
  setToken: state.setToken,
  setVerificationMethod: state.setVerificationMethod,
  setExpireTime: state.setExpireTime,
  setTokenExpireTime: state.setTokenExpireTime,
  clearForgotPassword: state.clearForgotPassword,
})

/**
 * Select step setters only
 */
export const selectStepActions = (state: IForgotPasswordStore) => ({
  setStep: state.setStep,
  clearForgotPassword: state.clearForgotPassword,
})

/**
 * Select identity setters only
 */
export const selectIdentityActions = (state: IForgotPasswordStore) => ({
  setEmail: state.setEmail,
  setPhoneNumber: state.setPhoneNumber,
  setVerificationMethod: state.setVerificationMethod,
})

/**
 * Select timer setters only
 */
export const selectTimingActions = (state: IForgotPasswordStore) => ({
  setExpireTime: state.setExpireTime,
  setTokenExpireTime: state.setTokenExpireTime,
})

/**
 * Select OTP-related setters
 */
export const selectOTPActions = (state: IForgotPasswordStore) => ({
  setToken: state.setToken,
  setTokenExpireTime: state.setTokenExpireTime,
  setExpireTime: state.setExpireTime,
})

// ============================================================================
// Hook Shortcuts (Convenience)
// ============================================================================

/**
 * Use email field with memoization
 * @returns email string
 */
export const useEmail = () => useForgotPasswordStore(selectEmail)

/**
 * Use phone number field with memoization
 * @returns phoneNumber string
 */
export const usePhoneNumber = () => useForgotPasswordStore(selectPhoneNumber)

/**
 * Use current step with memoization
 * @returns step number
 */
export const useStep = () => useForgotPasswordStore(selectStep)

/**
 * Use JWT token with memoization
 * @returns token string
 */
export const useToken = () => useForgotPasswordStore(selectToken)

/**
 * Use verification method with memoization
 * @returns verificationMethod (EMAIL or PHONE_NUMBER)
 */
export const useVerificationMethod = () =>
  useForgotPasswordStore(selectVerificationMethod)

/**
 * Use OTP expiration time with memoization
 * @returns expireTime ISO string
 */
export const useExpireTime = () => useForgotPasswordStore(selectExpireTime)

/**
 * Use JWT expiration time with memoization
 * @returns tokenExpireTime ISO string
 */
export const useTokenExpireTime = () =>
  useForgotPasswordStore(selectTokenExpireTime)

/**
 * Use user identity fields with memoization
 * @returns { email, phoneNumber, verificationMethod }
 */
export const useIdentity = () =>
  useForgotPasswordStore(useShallow(selectIdentity))

/**
 * Use flow state with memoization
 * @returns { step, token }
 */
export const useFlowState = () =>
  useForgotPasswordStore(useShallow(selectFlowState))

/**
 * Use timing state with memoization
 * @returns { expireTime, tokenExpireTime }
 */
export const useTimingState = () =>
  useForgotPasswordStore(useShallow(selectTimingState))

/**
 * Use all setter actions (stable reference)
 * @returns all setter functions
 */
export const useActions = () =>
  useForgotPasswordStore(useShallow(selectActions))

/**
 * Use step-related actions
 * @returns { setStep, clearForgotPassword }
 */
export const useStepActions = () =>
  useForgotPasswordStore(useShallow(selectStepActions))

/**
 * Use identity-related actions
 * @returns { setEmail, setPhoneNumber, setVerificationMethod }
 */
export const useIdentityActions = () =>
  useForgotPasswordStore(useShallow(selectIdentityActions))

/**
 * Use timing-related actions
 * @returns { setExpireTime, setTokenExpireTime }
 */
export const useTimingActions = () =>
  useForgotPasswordStore(useShallow(selectTimingActions))

/**
 * Use OTP-related actions and state
 * @returns { setToken, setTokenExpireTime, setExpireTime }
 */
export const useOTPActions = () =>
  useForgotPasswordStore(useShallow(selectOTPActions))

// ============================================================================
// Convenience Combinations
// ============================================================================

/**
 * Use email field and its setter
 * @returns { email, setEmail }
 */
export const useEmailState = () =>
  useForgotPasswordStore(
    useShallow((state: IForgotPasswordStore) => ({
      email: state.email,
      setEmail: state.setEmail,
    })),
  )

/**
 * Use phone number field and its setter
 * @returns { phoneNumber, setPhoneNumber }
 */
export const usePhoneNumberState = () =>
  useForgotPasswordStore(
    useShallow((state: IForgotPasswordStore) => ({
      phoneNumber: state.phoneNumber,
      setPhoneNumber: state.setPhoneNumber,
    })),
  )

/**
 * Use step field and its setter
 * @returns { step, setStep }
 */
export const useStepState = () =>
  useForgotPasswordStore(
    useShallow((state: IForgotPasswordStore) => ({
      step: state.step,
      setStep: state.setStep,
    })),
  )

/**
 * Use token field and its setter
 * @returns { token, setToken }
 */
export const useTokenState = () =>
  useForgotPasswordStore(
    useShallow((state: IForgotPasswordStore) => ({
      token: state.token,
      setToken: state.setToken,
    })),
  )
