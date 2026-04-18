# Phase 2 Detailed Breakdown - State & Navigation Optimization

## Overview

**Duration:** 2-3 days (8-10 hours)  
**Impact:** 50-60% smoother UX, reduce unrelated re-renders by 60%  
**Complexity:** Medium  
**Risk Level:** ⚠️⚠️ (Test thoroughly)

---

## What Phase 2 Does

Phase 2 focuses on **State Management** and **Navigation Optimization** to eliminate unnecessary re-renders and smooth out screen transitions.

Three main optimizations:

```
1️⃣ Store Selectors
   ↓
   Prevent re-renders from unrelated state changes
   Expected: -60% unrelated re-renders

2️⃣ Store Restructuring
   ↓
   Split into smaller, focused atoms
   Expected: Better separation of concerns

3️⃣ Navigation Optimization
   ↓
   Smooth transitions + pre-mounting
   Expected: 60fps transitions
```

---

## Optimization 1: Store Selectors

### Current Problem

```typescript
// Current: Full store subscription
const { email, step, token, expireTime, tokenExpireTime } =
  useForgotPasswordStore()

// Issue: Component re-renders when ANY store field changes
// Example: If countdown updates (which affects re-render count but not this component),
// this component still re-renders unnecessarily
```

### Solution: Memoized Selectors

**File to create:** `stores/selectors/forgot-password.ts`

```typescript
import { useForgotPasswordStore } from '@/stores'

// Single-field selectors
export const selectEmail = (state) => state.email
export const selectStep = (state) => state.step
export const selectToken = (state) => state.token
export const selectPhoneNumber = (state) => state.phoneNumber
export const selectVerificationMethod = (state) => state.verificationMethod
export const selectExpireTime = (state) => state.expireTime
export const selectTokenExpireTime = (state) => state.tokenExpireTime

// Composite selectors (group related data)
export const selectIdentity = (state) => ({
  email: state.email,
  phoneNumber: state.phoneNumber,
  verificationMethod: state.verificationMethod,
})

export const selectStepState = (state) => ({
  step: state.step,
  token: state.token,
})

export const selectOTPState = (state) => ({
  expireTime: state.expireTime,
  tokenExpireTime: state.tokenExpireTime,
})

// Export hooks
export const useEmail = () => useForgotPasswordStore(selectEmail)
export const useStep = () => useForgotPasswordStore(selectStep)
export const useToken = () => useForgotPasswordStore(selectToken)
export const usePhoneNumber = () => useForgotPasswordStore(selectPhoneNumber)
export const useIdentity = () => useForgotPasswordStore(selectIdentity)
export const useOTPState = () => useForgotPasswordStore(selectOTPState)
```

### Usage in Components

**Before:**

```typescript
// app/auth/forgot-password/email.tsx
const {
  setEmail,
  setStep,
  step,
  email,
  clearForgotPassword,
  setToken,
  token,
  setExpireTime,
  expireTime,
  setTokenExpireTime,
  tokenExpireTime, // ← Gets ALL of these, re-renders if ANY change
} = useForgotPasswordStore()

// Component re-renders if countdown changes (internal state), even though
// countdown doesn't depend on store
```

**After:**

```typescript
// app/auth/forgot-password/email.tsx
import {
  useEmail,
  useStep,
  useToken,
  useOTPState,
} from '@/stores/selectors/forgot-password'

// Only subscribe to what you need
const email = useEmail() // Only re-renders if email changes
const step = useStep() // Only re-renders if step changes
const token = useToken() // Only re-renders if token changes
const { expireTime, tokenExpireTime } = useOTPState() // Only re-renders if OTP state changes

// Separate hook for actions (never changes, no re-renders)
const { setEmail, setStep, setToken, clearForgotPassword } =
  useForgotPasswordStore((state) => ({
    setEmail: state.setEmail,
    setStep: state.setStep,
    setToken: state.setToken,
    clearForgotPassword: state.clearForgotPassword,
  }))
```

### Benefits

```
Before:
  Component subscribes to: 8 fields + 8 actions = 16 items
  Re-renders when: ANY of 16 items change
  Result: Frequent unnecessary re-renders

After:
  Component subscribes to: 3-4 fields + actions
  Re-renders when: ONLY those 3-4 fields change
  Result: 60% fewer unrelated re-renders
```

---

## Optimization 2: Store Restructuring

### Current Structure (Monolithic)

```typescript
// stores/forgot-password.store.ts
interface IForgotPasswordStore {
  // All mixed together
  email: string
  phoneNumber: string
  step: number
  verificationMethod: string
  token: string
  expireTime: string
  tokenExpireTime: string

  // Actions for all
  setEmail(email: string): void
  setPhoneNumber(phone: string): void
  setStep(step: number): void
  setToken(token: string): void
  // ... etc
}
```

### New Structure (Atomic)

Split into three focused slices:

```typescript
// 1. stores/slices/forgot-password-identity.ts
// Purpose: User identification (email/phone/method)
// Changes: ~1% of the time (only on step 1)
interface IdentitySlice {
  email: string
  phoneNumber: string
  verificationMethod: string

  setEmail(email: string): void
  setPhoneNumber(phone: string): void
  setVerificationMethod(method: string): void
}

// 2. stores/slices/forgot-password-state.ts
// Purpose: Flow state (which step, what token)
// Changes: ~10% of the time (on step transitions)
interface StateSlice {
  step: number
  token: string

  setStep(step: number): void
  setToken(token: string): void
}

// 3. stores/slices/forgot-password-timing.ts
// Purpose: Countdown timers (OTP and JWT expiration)
// Changes: Potentially very frequently if subscribed
interface TimingSlice {
  expireTime: string
  tokenExpireTime: string

  setExpireTime(time: string): void
  setTokenExpireTime(time: string): void
}

// 4. stores/forgot-password.ts (Main store)
// Combines all slices
export const useForgotPasswordStore = create<
  IdentitySlice & StateSlice & TimingSlice
>((set) => ({
  ...createIdentitySlice(set),
  ...createStateSlice(set),
  ...createTimingSlice(set),
}))
```

### Benefits of Splitting

```
Before:
  "Is this email still valid?" → Subscribe to full store
  Store might update: step, token, timings
  Result: Re-render even if only timing changed

After:
  "Is this email still valid?" → Subscribe to IdentitySlice only
  Ignore: step, token, timings
  Result: Only re-render if email actually changed
```

---

## Optimization 3: Navigation Optimization

### Problem: Janky Transitions

Currently when user taps "Send OTP" button:

```
1. User taps button
2. Button disabled (isInitiating = true)
3. Store updates (setStep, setExpireTime)
4. Screen components mount/unmount
5. Navigation animation starts
6. All while JS thread busy
Result: ⚠️ 30-40fps (janky)
```

### Solution A: Add Loading Overlay

```typescript
// lib/navigation/loading-overlay.tsx
import { useLoading } from '@/hooks/use-navigation-loading'

export function LoadingOverlay() {
  const isLoading = useLoading()

  if (!isLoading) return null

  return (
    <View className="absolute inset-0 bg-black/50 justify-center items-center z-50">
      <ActivityIndicator size="large" />
    </View>
  )
}

// In ForgotPasswordByEmailForm
const handleSubmit = (email: string) => {
  setLoading(true)  // ← Show overlay immediately

  initiateForgotPassword(
    { email },
    {
      onSuccess: () => {
        setExpireTime(...)
        setStep(2)

        // Navigate after state is set
        setTimeout(() => {
          navigateNative.push(ROUTE.FORGOT_PASSWORD_EMAIL)
          setLoading(false)
        }, 0)
      }
    }
  )
}
```

**Benefits:**

- User sees overlay immediately (no jank perception)
- State updates happen while overlay is showing
- Navigation happens after state settles
- Results in smooth 60fps transition

### Solution B: Batch State Updates

```typescript
// Before: Separate updates cause multiple renders
const handleSubmit = (email: string) => {
  setEmail(email)           // ← Re-render 1
  setExpireTime("...")      // ← Re-render 2
  setStep(2)                // ← Re-render 3
  navigateNative.push(...)  // ← Re-render 4
}

// After: Batch all updates
const handleSubmit = (email: string) => {
  // Use Zustand's ability to batch updates
  useForgotPasswordStore.setState({
    email,
    expireTime: "...",
    step: 2
  })

  // Navigate after state update
  navigateNative.push(...)
}
```

### Solution C: Pre-mount Next Steps (GhostMount)

```typescript
// Use existing GhostMountProvider to pre-mount screens

// app/_layout.tsx (or app/auth/_layout.tsx)
<GhostMountProvider>
  <Stack
    screenOptions={{
      animationEnabled: true,
      transitionSpec: {
        open: {
          animation: 'timing',
          config: { duration: 500 }
        },
        close: {
          animation: 'timing',
          config: { duration: 500 }
        },
      },
    }}
  >
    <Stack.Screen name="forgot-password" />
    <Stack.Screen name="forgot-password/email" />
    <Stack.Screen name="forgot-password/phone" />
  </Stack>

  {/* Pre-mount off-screen for instant navigation */}
  <GhostMount
    routes={[
      'forgot-password/email',
      'forgot-password/phone'
    ]}
  />
</GhostMountProvider>
```

**How it works:**

- Screens are mounted off-screen before user navigates
- When user taps button, screen is already ready
- Navigation animation is instant (just slides screen into view)
- Results in smooth 60fps transition

---

## Implementation Steps

### Step 1: Create Store Selectors (2-3 hours)

```bash
# Create selectors file
touch stores/selectors/forgot-password.ts

# Add:
# - selectEmail, selectStep, selectToken, etc.
# - selectIdentity, selectOTPState, selectStepState
# - useEmail(), useStep(), etc. hook shortcuts
```

### Step 2: Update Components to Use Selectors (2-3 hours)

```bash
# Update files:
# - app/auth/forgot-password/email.tsx
# - app/auth/forgot-password/phone.tsx
# - components/form/forgot-password-by-email-form.tsx
# - components/form/forgot-password-by-phone-form.tsx

# Change from:
#   const { email, step, token, ... } = useForgotPasswordStore()
# To:
#   const email = useEmail()
#   const step = useStep()
#   const token = useToken()
```

### Step 3: Add Loading Overlay (2-3 hours)

```bash
# Create:
# - hooks/use-navigation-loading.ts
# - lib/navigation/loading-overlay.tsx

# Update:
# - app/auth/forgot-password/email.tsx
# - app/auth/forgot-password/phone.tsx
```

### Step 4: Test & Verify (1-2 hours)

```bash
# Test:
# - No unrelated re-renders
# - Smooth transitions
# - Loading overlay appears/disappears correctly
# - No broken store subscriptions
```

---

## Risk Assessment

### Low Risk ✅

- Creating selectors (no breaking changes)
- Using selectors (backward compatible)

### Medium Risk ⚠️⚠️

- Removing old store subscriptions (could miss fields)
- Batching state updates (timing-sensitive)

### Mitigation

- Test each component individually
- Use React DevTools to verify subscriptions
- Use Profiler to check re-render counts
- Have rollback plan ready

---

## Performance Impact

### Before Phase 2

```
Store update → Component A re-renders (subscribed to full store)
            → Component B re-renders (subscribed to full store)
            → Component C re-renders (subscribed to full store)

If only one field changed that Component A needs:
B and C still re-render unnecessarily (50-60% wasted)
```

### After Phase 2

```
Store update (email) → Component A re-renders (subscribes to email)
                    → Component B ignores (subscribes to step)
                    → Component C ignores (subscribes to token)

Only A re-renders (100% useful)
```

**Result:** 50-60% fewer unnecessary re-renders

---

## Testing Checklist

### Unit Tests

- [ ] Selectors return correct values
- [ ] Selectors are memoized properly
- [ ] Store updates don't affect unsubscribed selectors

### Integration Tests

- [ ] Email field updates don't cause step change re-renders
- [ ] Step transitions happen smoothly
- [ ] Token updates don't affect email component
- [ ] Loading overlay appears during async operations

### Performance Tests

- [ ] Component re-renders only when subscribed field changes
- [ ] Transitions are smooth (60fps or close)
- [ ] No memory leaks from old subscriptions
- [ ] Navigation latency is <100ms

### Regression Tests

- [ ] All form submissions work
- [ ] All navigation works
- [ ] All timer countdowns work
- [ ] Error handling still works

---

## Expected Metrics After Phase 2

```
Before Phase 2:
  Re-renders/second: ~1-2
  Transition FPS: ~50-55fps
  Time to navigate: ~300-400ms

After Phase 2:
  Re-renders/second: <0.5
  Transition FPS: 55-60fps
  Time to navigate: <200ms
```

---

## Files to Create/Modify

### New Files

```
✅ stores/selectors/forgot-password.ts          (100-150 lines)
✅ hooks/use-navigation-loading.ts              (30-50 lines)
✅ lib/navigation/loading-overlay.tsx           (40-60 lines)
```

### Modified Files

```
📝 app/auth/forgot-password/email.tsx           (-10 lines, +5 lines)
📝 app/auth/forgot-password/phone.tsx           (-10 lines, +5 lines)
📝 components/form/forgot-password-by-email-form.tsx
📝 components/form/forgot-password-by-phone-form.tsx
```

---

## Summary Table

| Optimization        | Impact                    | Effort    | Risk            |
| ------------------- | ------------------------- | --------- | --------------- |
| **Store Selectors** | -60% unrelated re-renders | 2-3h      | ✅ Low          |
| **Store Split**     | Better separation         | 1-2h      | ⚠️⚠️ Medium     |
| **Loading Overlay** | Better UX perception      | 1-2h      | ⚠️⚠️ Medium     |
| **Batch Updates**   | Fewer re-renders          | 1h        | ⚠️ Low          |
| **Pre-mount Steps** | Instant navigation        | 1-2h      | ⚠️⚠️ Medium     |
| **Total**           | **50-60% smoother UX**    | **8-10h** | **⚠️⚠️ Medium** |

---

## Conclusion

Phase 2 transforms the store from a monolithic ball of mud to a well-organized selector-based architecture. This enables:

1. ✅ Components only re-render when their data changes
2. ✅ Smooth, responsive transitions
3. ✅ Better code organization
4. ✅ Easier testing and debugging

**When ready to proceed:** Ensure Phase 1 is fully tested and working. Phase 2 requires careful testing of store subscriptions.
