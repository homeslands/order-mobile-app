# Gift Card Feature Locking: Admin & Client-Side Logic

## 1. Quick Overview

**Feature locking system cho gift card hoạt động như thế này:**

```
Admin Panel: Toggle feature lock
    ↓
API: PATCH /feature-flag/bulk-toggle
    ↓
Database: Update isLocked flag
    ↓
Client: Fetch flags on next load
    ↓
UI: Disable/enable option based on isLocked
```

**3 loại gift card có thể khoá riêng:**
- **SELF**: Top-up cho mình
- **GIFT**: Tặng cho người khác
- **BUY**: Mua như sản phẩm

---

## 2. Feature Flag System Architecture

### 2.1 Database Schema

**File**: Migration v3.0.0-09

**Two Tables:**

```sql
-- Feature Groups
feature_group_tbl {
  id: UUID (PK),
  slug: string (unique),
  name: string (unique),      -- e.g., "GIFT_CARD"
  order: int
}

-- Feature Flags
feature_flag_tbl {
  id: UUID (PK),
  slug: string (unique),
  name: string (unique),      -- e.g., "SELF", "GIFT", "BUY"
  groupName: string,          -- e.g., "GIFT_CARD"
  groupSlug: string (FK),
  isLocked: boolean,          -- Lock status
  order: int,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Example Data:**

```sql
-- Group
INSERT INTO feature_group_tbl (id, slug, name, order)
VALUES (uuid(), 'random-slug-xyz', 'GIFT_CARD', 1);

-- Flags
INSERT INTO feature_flag_tbl (slug, name, groupName, groupSlug, isLocked, order)
VALUES
  (uuid(), 'SELF', 'GIFT_CARD', 'random-slug-xyz', false, 1),  -- Unlocked
  (uuid(), 'GIFT', 'GIFT_CARD', 'random-slug-xyz', false, 2),  -- Unlocked
  (uuid(), 'BUY',  'GIFT_CARD', 'random-slug-xyz', false, 3);  -- Unlocked
```

### 2.2 Feature Flag Structure

**Entities**: `src/gift-card-modules/feature-flag/entities/`

```typescript
@Entity('feature_group_tbl')
export class FeatureGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  slug: string          // Randomly generated identifier

  @Column({ unique: true })
  name: string          // "GIFT_CARD"

  @Column()
  order: number

  @OneToMany(() => FeatureFlag, (flag) => flag.group)
  features: FeatureFlag[]  // Related flags
}

@Entity('feature_flag_tbl')
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  slug: string          // Unique per flag

  @Column({ unique: true })
  name: string          // "SELF", "GIFT", or "BUY"

  @Column()
  groupName: string

  @Column()
  groupSlug: string

  @Column({ default: false })
  isLocked: boolean     // ← THE LOCK STATUS

  @Column()
  order: number

  @ManyToOne(() => FeatureGroup, (group) => group.features)
  @JoinColumn({ name: 'groupSlug' })
  group: FeatureGroup
}
```

### 2.3 Gift Card Types

**Constants**: `src/constants/gift-card.ts`

```typescript
export enum GiftCardType {
  SELF = 'SELF',      // Buy for myself
  GIFT = 'GIFT',      // Gift to others
  BUY = 'BUY',        // Purchase gift card
  NONE = 'NONE'       // All locked fallback
}

export enum GiftCardFlagGroup {
  GIFT_CARD = 'GIFT_CARD'  // Group name in database
}
```

**Each type has independent flag:**
- SELF ↔ Feature flag (name='SELF', isLocked=boolean)
- GIFT ↔ Feature flag (name='GIFT', isLocked=boolean)
- BUY ↔ Feature flag (name='BUY', isLocked=boolean)

---

## 3. Admin Interface: Toggling Features

### 3.1 Two Admin UIs for Feature Flags

**Option 1: System Tab (Stores Settings)**

**File**: `src/components/app/tabscontent/system-feature-flag.tabscontent.tsx`

```typescript
export const SystemFeatureFlagTabContent = () => {
  // Fetch feature flags
  const { data: featureFlagsResponse } = useGetFeatureFlagsByGroup(
    GiftCardFlagGroup.GIFT_CARD
  )

  const featureFlags = featureFlagsResponse?.result || []

  // Local state for optimistic UI
  const [localFlags, setLocalFlags] = useState<IGiftCardFlagFeature[]>([])

  // Initialize local state when data loads
  useEffect(() => {
    setLocalFlags(featureFlags)
  }, [featureFlags])

  // Toggle individual flag
  const handleToggleFlag = (slug: string) => {
    setLocalFlags((prev) =>
      prev.map((flag) =>
        flag.slug === slug ? { ...flag, isLocked: !flag.isLocked } : flag
      )
    )
  }

  // Toggle all flags at once
  const handleToggleAll = () => {
    const allLocked = localFlags.every((flag) => flag.isLocked)
    setLocalFlags((prev) =>
      prev.map((flag) => ({ ...flag, isLocked: !allLocked }))
    )
  }

  // Save changes to server
  const { mutate: bulkToggle, isPending } = useBulkToggleFeatureFlags()

  const handleSave = () => {
    const updates = localFlags.map((flag) => ({
      slug: flag.slug,
      isLocked: flag.isLocked
    }))

    bulkToggle(updates, {
      onSuccess: () => {
        toast.success('Feature flags updated successfully')
        // Refetch to confirm server state
        queryClient.invalidateQueries({
          queryKey: ['feature-flags', GiftCardFlagGroup.GIFT_CARD]
        })
      },
      onError: () => {
        toast.error('Failed to update feature flags')
        // Reset to previous state
        setLocalFlags(featureFlags)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Header with toggle all */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Gift Card Types</h3>
        <Button
          variant="outline"
          onClick={handleToggleAll}
          disabled={isPending}
        >
          {localFlags.every((f) => f.isLocked) ? 'Unlock All' : 'Lock All'}
        </Button>
      </div>

      {/* Individual toggles */}
      <div className="space-y-2">
        {localFlags.map((flag) => (
          <div key={flag.slug} className="flex items-center justify-between p-3 border rounded">
            <div>
              <p className="font-semibold">{flag.name}</p>
              <p className="text-sm text-gray-500">
                Status: {flag.isLocked ? '🔒 Locked' : '🔓 Unlocked'}
              </p>
            </div>

            <Switch
              checked={!flag.isLocked}  // ← Note: inverted (checked = enabled)
              onCheckedChange={() => handleToggleFlag(flag.slug)}
              disabled={isPending}
            />
          </div>
        ))}
      </div>

      {/* Save/Reset buttons */}
      <div className="flex gap-2 pt-4">
        <Button
          onClick={handleSave}
          disabled={isPending || JSON.stringify(localFlags) === JSON.stringify(featureFlags)}
        >
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>

        <Button
          variant="outline"
          onClick={() => setLocalFlags(featureFlags)}
          disabled={isPending}
        >
          Reset
        </Button>
      </div>
    </div>
  )
}
```

**Option 2: Dedicated Management Page**

**File**: `src/app/system/feature-lock-management/page.tsx`

- Same logic as System Tab
- Standalone page: `/system/feature-lock-management`
- Same UI, isolated route

### 3.2 Admin UI Flow

```
┌──────────────────────────────────────┐
│ Admin Feature Lock Management        │
├──────────────────────────────────────┤
│                                      │
│ Load component                       │
│   ↓                                  │
│ useGetFeatureFlagsByGroup()          │
│   ↓                                  │
│ GET /feature-flag?group=GIFT_CARD    │
│   ↓ Response received                │
│ Render 3 toggles:                    │
│ ☑️ SELF (Unlocked)                   │
│ ☑️ GIFT (Unlocked)                   │
│ ☑️ BUY  (Unlocked)                   │
│ [Lock/Unlock All]                    │
│                                      │
│ Admin clicks toggle on GIFT:         │
│   ↓                                  │
│ Local state: GIFT.isLocked = true    │
│ UI updates immediately               │
│ ☑️ SELF (Unlocked)                   │
│ ☐ GIFT (🔒 Locked)                   │
│ ☑️ BUY  (Unlocked)                   │
│                                      │
│ Admin clicks "Save Changes":         │
│   ↓                                  │
│ useBulkToggleFeatureFlags()          │
│   ↓                                  │
│ PATCH /feature-flag/bulk-toggle      │
│ Body: [                              │
│   {slug: 'xyz-gift', isLocked: true} │
│ ]                                    │
│   ↓ Request sent                     │
│ Backend validates & updates DB       │
│   ↓ 204 response received            │
│ Toast: "Saved successfully"          │
│ Invalidate React Query cache         │
│ Refetch latest flags                 │
│                                      │
└──────────────────────────────────────┘
```

---

## 4. Admin APIs

### 4.1 API Endpoints

**File**: `src/gift-card-modules/feature-flag/feature-flag.controller.ts`

#### Get Feature Flags by Group

```
Endpoint: GET /feature-flag?group=GIFT_CARD

Response:
{
  statusCode: 200,
  timestamp: "2024-04-01T12:00:00Z",
  result: [
    {
      id: "uuid-1",
      slug: "xyz-self",
      name: "SELF",
      groupName: "GIFT_CARD",
      groupSlug: "abc-xyz",
      isLocked: false,    // ← Current lock status
      order: 1
    },
    {
      id: "uuid-2",
      slug: "xyz-gift",
      name: "GIFT",
      groupName: "GIFT_CARD",
      groupSlug: "abc-xyz",
      isLocked: false,    // ← Can be toggled
      order: 2
    },
    {
      id: "uuid-3",
      slug: "xyz-buy",
      name: "BUY",
      groupName: "GIFT_CARD",
      groupSlug: "abc-xyz",
      isLocked: false,
      order: 3
    }
  ]
}
```

#### Bulk Toggle Feature Flags

```
Endpoint: PATCH /feature-flag/bulk-toggle

Request Body:
{
  updates: [
    {
      slug: "xyz-gift",
      isLocked: true      // ← New state
    }
  ]
}

Response:
204 No Content
```

**Backend Implementation:**

```typescript
@Patch('bulk-toggle')
async bulkToggleFeatureFlags(
  @Body() body: BulkUpdateFeatureFlagDto
) {
  // Validate input
  if (!body.updates || body.updates.length === 0) {
    throw new BadRequestException('Updates required')
  }

  // Process updates in transaction
  const results = await this.transactionService.execute(
    async (manager) => {
      // For each update
      const updated = []
      for (const { slug, isLocked } of body.updates) {
        // Find flag by slug
        const flag = await manager.findOne(FeatureFlag, {
          where: { slug }
        })

        if (!flag) {
          throw new NotFoundException(`Flag ${slug} not found`)
        }

        // Update isLocked status
        flag.isLocked = isLocked
        const saved = await manager.save(flag)
        updated.push(saved)
      }

      return updated
    },
    (results) => {
      // Log success
      console.log(`Updated ${results.length} feature flags`)
    },
    (error) => {
      // Log error
      console.error('Failed to bulk toggle:', error)
      throw error
    }
  )

  return null  // 204 No Content
}
```

### 4.2 Error Codes

**Error Code Range: 158800-158899**

```typescript
enum FeatureFlagErrorCode {
  CREATE_ERROR = 158801,        // Error when creating flag
  ORDER_NOT_FOUND = 158802,     // Card order not found
  UPDATE_ERROR = 158803,        // Error when updating flag
  REMOVE_ERROR = 158804,        // Error when removing flag
  PARAM_REQUIRED = 158805,      // Missing required param
  FEATURE_LOCKED = 158806       // ← Feature is locked!
}
```

---

## 5. Client-Side Feature Flag Logic

### 5.1 Fetching Feature Flags

**File**: `src/hooks/use-gift-card.ts` (Lines 306-326)

```typescript
// Hook to fetch feature flags
export const useGetFeatureFlagsByGroup = (group: string) => {
  return useQuery({
    queryKey: ['feature-flags', group],
    queryFn: () => getFeatureFlagsByGroup(group),
    // Caching strategy:
    staleTime: 5 * 60 * 1000,      // 5 minutes
    gcTime: 30 * 60 * 1000,         // 30 minutes (garbage collect)
    refetchOnWindowFocus: true,     // Refetch when user refocuses tab
    refetchOnMount: 'stale'         // Refetch if stale
  })
}

// Mutation for bulk toggle (admin only)
export const useBulkToggleFeatureFlags = () => {
  return useMutation({
    mutationFn: async (
      updates: Array<{ slug: string; isLocked: boolean }>
    ) => {
      return bulkToggleFeatureFlags(updates)
    }
  })
}
```

**API Client**: `src/api/gift-card.ts` (Lines 145-170)

```typescript
export async function getFeatureFlagsByGroup(
  group: string
): Promise<IApiResponse<IGiftCardFlagFeature[]>> {
  const response = await http.get<IApiResponse<IGiftCardFlagFeature[]>>(
    `/feature-flag`,
    {
      params: { group }
    }
  )

  return response.data
}

export async function bulkToggleFeatureFlags(
  updates: Array<{ slug: string; isLocked: boolean }>
): Promise<void> {
  await http.patch<void>(
    `/feature-flag/bulk-toggle`,
    { updates }
  )
}
```

### 5.2 Checking Feature Status

**In Gift Card Checkout Components:**

**File**: `src/components/app/gift-card/checkout/page.tsx` (or similar)

```typescript
export const GiftCardCheckoutComponent = () => {
  // Fetch feature flags
  const { data: featureFlagsResponse, isLoading } = useGetFeatureFlagsByGroup(
    GiftCardFlagGroup.GIFT_CARD
  )

  const featureFlags = featureFlagsResponse?.result || []

  // Check if all types are locked
  const isAllLocked = featureFlags.length > 0 &&
    featureFlags.every((flag) => flag.isLocked)

  // Determine available types
  const availableTypes = featureFlags
    .filter((flag) => !flag.isLocked)
    .map((flag) => flag.name as GiftCardType)

  // Check if specific type is locked
  const isTypeLocked = (type: GiftCardType): boolean => {
    const flag = featureFlags.find((f) => f.name === type)
    return flag?.isLocked ?? true  // Default: locked if not found
  }

  // Determine default type
  const defaultType =
    isAllLocked
      ? GiftCardType.NONE
      : availableTypes[0] || GiftCardType.SELF

  // State for selected type
  const [selectedType, setSelectedType] = useState<GiftCardType>(defaultType)

  // Handle type change
  const handleTypeChange = (newType: GiftCardType) => {
    if (isTypeLocked(newType)) {
      // Don't allow locked types
      toast.warning('This feature is temporarily unavailable')
      return
    }

    setSelectedType(newType)

    // Reset form if switching from GIFT
    if (selectedType === GiftCardType.GIFT && newType !== GiftCardType.GIFT) {
      setReceivers([])  // Clear receivers
    }
  }

  return (
    <div>
      {isLoading && <div>Loading feature status...</div>}

      {isAllLocked && (
        <Alert variant="info">
          <AlertCircle className="w-4 h-4" />
          <span>All gift card types are currently locked.</span>
        </Alert>
      )}

      {/* Type selection UI */}
      <div className="space-y-2">
        <Label>Gift Card Type</Label>

        {/* SELF Option */}
        <div>
          <Radio
            value={GiftCardType.SELF}
            checked={selectedType === GiftCardType.SELF}
            onChange={() => handleTypeChange(GiftCardType.SELF)}
            disabled={isTypeLocked(GiftCardType.SELF)}
            label="Top Up Coins (Self)"
          />
          {isTypeLocked(GiftCardType.SELF) && (
            <span className="text-xs text-gray-500">🔒 Locked</span>
          )}
        </div>

        {/* GIFT Option */}
        <div>
          <Radio
            value={GiftCardType.GIFT}
            checked={selectedType === GiftCardType.GIFT}
            onChange={() => handleTypeChange(GiftCardType.GIFT)}
            disabled={isTypeLocked(GiftCardType.GIFT)}
            label="Gift to Others"
          />
          {isTypeLocked(GiftCardType.GIFT) && (
            <span className="text-xs text-gray-500">🔒 Locked</span>
          )}
        </div>

        {/* BUY Option */}
        <div>
          <Radio
            value={GiftCardType.BUY}
            checked={selectedType === GiftCardType.BUY}
            onChange={() => handleTypeChange(GiftCardType.BUY)}
            disabled={isTypeLocked(GiftCardType.BUY)}
            label="Purchase Gift Card"
          />
          {isTypeLocked(GiftCardType.BUY) && (
            <span className="text-xs text-gray-500">🔒 Locked</span>
          )}
        </div>
      </div>

      {/* Receivers (show only if GIFT selected and not locked) */}
      {selectedType === GiftCardType.GIFT && !isTypeLocked(GiftCardType.GIFT) && (
        <GiftCardReceiversForm />
      )}

      {/* Proceed button */}
      <Button
        disabled={isAllLocked || isLoading}
        onClick={handleProceed}
      >
        {isAllLocked ? 'All features locked' : 'Proceed to Payment'}
      </Button>
    </div>
  )
}
```

### 5.3 Caching & Real-Time Sync

```
┌─────────────────────────────────────────────┐
│ Feature Flag Caching & Sync                 │
├─────────────────────────────────────────────┤
│                                             │

Initial Load:
├─ Component mounts
├─ useGetFeatureFlagsByGroup('GIFT_CARD')
├─ React Query: Check cache?
│  ├─ NO cache: Fetch from API
│  └─ Has cache + not stale: Use cache
├─ GET /feature-flag?group=GIFT_CARD
└─ Store in cache

Cache Behavior:
├─ staleTime: 5 min
│  └─ Data considered fresh for 5 minutes
├─ gcTime: 30 min
│  └─ Keep in memory for 30 minutes total
├─ refetchOnWindowFocus: true
│  └─ User switches back to app? Refetch
└─ refetchOnMount: 'stale'
   └─ Component remounts? Refetch if stale

Real-Time Sync (Admin Updates):
├─ Admin toggles feature in admin panel
├─ POST PATCH /feature-flag/bulk-toggle
├─ Success: invalidateQueries()
│  └─ Marks cache as "stale"
├─ Next query: Cache stale, so refetch
├─ GET /feature-flag?group=GIFT_CARD
└─ Latest flags loaded

User Perspective:
├─ Admin changes lock status
├─ User refreshes page or navigates away/back
└─ Latest feature status loaded from server

No Polling:
├─ NOT continuous
├─ NOT automatic periodic updates
├─ Manual refetch triggers:
│  ├─ Component mount (if stale)
│  ├─ Window focus (if refetchOnWindowFocus=true)
│  ├─ Admin saves changes → invalidateQueries()
│  └─ Manual navigation to different page

│                                             │
└─────────────────────────────────────────────┘
```

---

## 6. Feature Locked: Client-Side Behavior

### 6.1 UI Changes When Feature Locked

**Scenario: Admin locks GIFT type**

**Before Lock:**
```
☑️ Top Up Coins (Self)        [enabled]
☑️ Gift to Others             [enabled]
☑️ Purchase Gift Card         [enabled]
```

**After Lock (GIFT type):**
```
☑️ Top Up Coins (Self)        [enabled]
☐ Gift to Others      🔒 Locked [disabled]
☑️ Purchase Gift Card         [enabled]
```

**Visual Changes:**
```typescript
<Radio
  disabled={isTypeLocked(GiftCardType.GIFT)}  // ← Disabled
  label="Gift to Others"
/>

{isTypeLocked(GiftCardType.GIFT) && (
  <span className="text-gray-400">🔒 Locked</span>  // ← Show lock icon
)}
```

### 6.2 Default Fallback

**When User Tries Locked Type:**

```typescript
const handleTypeChange = (newType: GiftCardType) => {
  if (isTypeLocked(newType)) {
    // Option locked, use fallback
    const fallback = availableTypes[0] || GiftCardType.SELF
    setSelectedType(fallback)
    toast.info(`${newType} is not available. Using ${fallback} instead.`)
    return
  }

  setSelectedType(newType)
}
```

**Example:**
```
User tries to select: GIFT (locked)
  ↓
Fallback: Use first available type
  ↓
if availableTypes = [SELF, BUY]
  ↓
setSelectedType(GiftCardType.SELF)
  ↓
Toast: "Gift to Others is not available. Using Top Up Coins instead."
```

### 6.3 All Locked Behavior

**When all types locked:**

```typescript
if (isAllLocked) {
  // Show message
  <Alert>All gift card types are currently locked.</Alert>

  // Disable proceed button
  <Button disabled={true}>All features locked</Button>

  // Set type to NONE
  setSelectedType(GiftCardType.NONE)

  // Don't show any type options
  setAvailableTypes([])
}
```

### 6.4 Form Reset on Lock Change

```typescript
// When switching away from GIFT (because it got locked)
const handleTypeChange = (newType: GiftCardType) => {
  if (selectedType === GiftCardType.GIFT && newType !== GiftCardType.GIFT) {
    // Clear GIFT-specific form fields
    setReceivers([])              // Clear receivers
    setReceiverQuantity(1)        // Reset quantity
    setMessage('')                // Clear message
  }

  setSelectedType(newType)
}
```

---

## 7. Complete Flow: Admin Lock → Client Update

### 7.1 Step-by-Step Timeline

```
TIME: T0 (Initial State)
────────────────────────
Admin Panel:
├─ Feature flags loaded
├─ SELF: ☑️ (unlocked)
├─ GIFT: ☑️ (unlocked)
└─ BUY: ☑️ (unlocked)

Customer Side:
├─ /client/gift-card page open
├─ Feature flags cached: SELF, GIFT, BUY all unlocked
├─ All 3 options available
└─ User browsing gift cards

                    ↓

TIME: T1 (Admin Toggles)
────────────────────────
Admin clicks toggle on GIFT:
├─ Local state: GIFT.isLocked = true
├─ UI updates to show 🔒 Locked
└─ Still showing in list (disabled)

                    ↓

TIME: T2 (Admin Saves)
─────────────────────
Admin clicks "Save Changes":
├─ useBulkToggleFeatureFlags() executes
├─ PATCH /feature-flag/bulk-toggle
│  └─ Body: [{slug: 'xyz-gift', isLocked: true}]
├─ Backend updates: UPDATE feature_flag_tbl SET isLocked = 1 WHERE slug = 'xyz-gift'
├─ Response: 204 No Content
├─ Frontend: queryClient.invalidateQueries(['feature-flags'])
└─ Toast: "Feature flags updated successfully"

Customer Browser (at T2):
├─ No immediate change (still has cached flags)
├─ Cache still valid (5 minutes stale time)
├─ Page still shows all 3 options

                    ↓

TIME: T3 (Customer Navigates)
─────────────────────────────
Customer closes /client/gift-card:
├─ Component unmounts
└─ Cache becomes irrelevant (not in use)

                    ↓

TIME: T4 (Customer Reopens)
──────────────────────────
Customer navigates back to /client/gift-card:
├─ Component mounts
├─ useGetFeatureFlagsByGroup() hook executes
├─ React Query: Check cache
│  └─ Cache still fresh (< 5 min)? Or refetchOnMount='stale'?
├─ If refetchOnMount='stale':
│  └─ Was cache invalidated? YES (at T2)
│  └─ So refetch: GET /feature-flag?group=GIFT_CARD
├─ Response: New flags with GIFT.isLocked = true
├─ Update React Query cache
└─ Component re-renders with new data

Customer UI Updates:
├─ SELF: ☑️ (enabled)
├─ GIFT: ☐ (🔒 locked, disabled)
├─ BUY: ☑️ (enabled)
└─ Default selected: SELF (first available)

OR If Refresh Page at T4:
├─ Cache invalidated on reload
├─ Fresh GET /feature-flag?group=GIFT_CARD
└─ Latest flags loaded

                    ↓

TIME: T5 (Customer Completes Checkout)
──────────────────────────────────────
Customer can only select from available types:
├─ Try to select GIFT (locked)?
│  └─ Disabled in UI, cannot click
├─ Select SELF or BUY
└─ Proceed with payment

│                                        │
└────────────────────────────────────────┘
```

---

## 8. Implementation Details

### 8.1 Feature Flag Service

**File**: `src/gift-card-modules/feature-flag/feature-flag.service.ts`

```typescript
@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly featureFlagRepository: Repository<FeatureFlag>,
    private readonly transactionService: TransactionService
  ) {}

  // Find by slug (for checking lock status)
  async findBySlug(slug: string): Promise<FeatureFlag> {
    return this.featureFlagRepository.findOne({
      where: { slug }
    })
  }

  // Query by group (for fetching all)
  async queryByGroup(groupName: string): Promise<FeatureFlag[]> {
    return this.featureFlagRepository.find({
      where: { groupName },
      order: { order: 'ASC' }
    })
  }

  // Bulk update (for admin toggling)
  async bulkToggle(updates: Array<{ slug: string; isLocked: boolean }>) {
    return this.transactionService.execute(
      async (manager) => {
        const updated = []

        for (const { slug, isLocked } of updates) {
          const flag = await manager.findOne(FeatureFlag, {
            where: { slug }
          })

          if (!flag) {
            throw new NotFoundException(`Feature flag ${slug} not found`)
          }

          flag.isLocked = isLocked
          const saved = await manager.save(flag)
          updated.push(saved)
        }

        return updated
      },
      (results) => {
        logger.log(`Updated ${results.length} feature flags`)
      },
      (error) => {
        logger.error('Bulk toggle failed:', error)
        throw error
      }
    )
  }
}
```

### 8.2 Frontend Hooks

**File**: `src/hooks/use-gift-card.ts` (Lines 306-326)

```typescript
// Query hook
export const useGetFeatureFlagsByGroup = (group: string) => {
  return useQuery({
    queryKey: ['feature-flags', group],
    queryFn: () => getFeatureFlagsByGroup(group),
    staleTime: 5 * 60 * 1000,           // 5 minutes
    gcTime: 30 * 60 * 1000,             // 30 minutes garbage collect
    refetchOnWindowFocus: true,         // Refetch on window focus
    refetchOnMount: 'stale'             // Refetch if stale on mount
  })
}

// Mutation hook (admin)
export const useBulkToggleFeatureFlags = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      updates: Array<{ slug: string; isLocked: boolean }>
    ) => {
      return bulkToggleFeatureFlags(updates)
    },
    onSuccess: () => {
      // Invalidate cache to force refetch
      queryClient.invalidateQueries({
        queryKey: ['feature-flags', GiftCardFlagGroup.GIFT_CARD]
      })
    }
  })
}
```

### 8.3 Constants

**File**: `src/constants/gift-card.ts`

```typescript
export enum GiftCardType {
  SELF = 'SELF',
  GIFT = 'GIFT',
  BUY = 'BUY',
  NONE = 'NONE'
}

export enum GiftCardFlagGroup {
  GIFT_CARD = 'GIFT_CARD'
}

export const GiftCardTypeLabels: Record<GiftCardType, string> = {
  [GiftCardType.SELF]: 'Top Up Coins (Self)',
  [GiftCardType.GIFT]: 'Gift to Others',
  [GiftCardType.BUY]: 'Purchase Gift Card',
  [GiftCardType.NONE]: 'No Option Available'
}
```

---

## 9. Error Handling

### 9.1 Error Codes

```typescript
enum FeatureFlagErrorCode {
  FEATURE_LOCKED = 158806  // The feature is temporarily locked
}
```

### 9.2 When Feature is Locked

```typescript
// During order creation, check if type is locked (server-side validation)
// This is optional - client-side prevents before reaching here

const validateGiftCardType = (type: GiftCardType, flags: FeatureFlag[]) => {
  const flag = flags.find((f) => f.name === type)

  if (!flag) {
    throw new NotFoundException(`Feature flag for type ${type} not found`)
  }

  if (flag.isLocked) {
    throw new BadRequestException({
      code: FeatureFlagErrorCode.FEATURE_LOCKED,
      message: 'The feature is temporarily locked.'
    })
  }

  return true
}
```

---

## 10. Summary Diagram: Admin ↔ Client Flow

```
┌────────────────────────────────────────────────────────────┐
│ ADMIN-CLIENT FEATURE LOCK SYNCHRONIZATION                  │
├────────────────────────────────────────────────────────────┤
│                                                            │

ADMIN SIDE:
────────────
┌─ /system/feature-lock-management
│
├─ useGetFeatureFlagsByGroup('GIFT_CARD')
│  └─ GET /feature-flag?group=GIFT_CARD
│     └─ Receives: [{name: 'SELF', isLocked: false}, ...]
│
├─ Admin toggles GIFT: isLocked = true
│
├─ handleSave()
│  └─ useBulkToggleFeatureFlags()
│     └─ PATCH /feature-flag/bulk-toggle
│        └─ Body: [{slug: 'xyz', isLocked: true}]
│
├─ Backend updates DB
│
├─ queryClient.invalidateQueries()
│
└─ Toast: "Saved!"

                        ↓
            DATABASE UPDATED
                        ↓

CLIENT SIDE:
────────────
┌─ /client/gift-card page (customer browsing)
│
├─ useGetFeatureFlagsByGroup('GIFT_CARD')
│  └─ Cache hit (still fresh)
│  └─ No API call needed
│  └─ Shows old data (GIFT unlocked)
│
│ [Customer doesn't see change yet]
│
├─ Customer navigates away or refreshes
│
├─ Component remount / cache invalidated
│
├─ useGetFeatureFlagsByGroup() executes
│  └─ GET /feature-flag?group=GIFT_CARD
│     └─ Response: [{name: 'GIFT', isLocked: true}, ...]
│
├─ Component re-renders
│
└─ GIFT option now disabled (🔒 Locked)
   Customer sees: Can only use SELF or BUY

            ✓ SYNCHRONIZED!

│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 11. Key Files Reference

### Backend (NestJS)
- **Service**: `src/gift-card-modules/feature-flag/feature-flag.service.ts`
- **Controller**: `src/gift-card-modules/feature-flag/feature-flag.controller.ts`
- **Entities**: `src/gift-card-modules/feature-flag/entities/feature-flag.entity.ts`
- **Constants**: `src/gift-card-modules/feature-flag/feature-flag.constant.ts`
- **Error Codes**: `src/gift-card-modules/feature-flag/feature-flag.validation.ts`

### Frontend (React)
- **API Client**: `src/api/gift-card.ts` (lines 145-170)
- **Hooks**: `src/hooks/use-gift-card.ts` (lines 306-326)
- **Constants**: `src/constants/gift-card.ts`
- **Admin UI**: `src/components/app/tabscontent/system-feature-flag.tabscontent.tsx`
- **Admin Page**: `src/app/system/feature-lock-management/page.tsx`
- **Gift Card Checkout**: `src/components/app/gift-card/checkout/page.tsx`

---

## 12. Conclusion

```
┌─────────────────────────────────────────────────────┐
│ FEATURE LOCK MECHANISM SUMMARY                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ARCHITECTURE:                                       │
│ ✓ Database: feature_flag_tbl with isLocked flag   │
│ ✓ Three types: SELF, GIFT, BUY (independent)      │
│ ✓ Group: GIFT_CARD (single group for all)         │
│                                                     │
│ ADMIN SIDE:                                         │
│ ✓ Two UIs: System Tab + Dedicated Page             │
│ ✓ Individual toggles for each type                 │
│ ✓ Lock/Unlock All button                           │
│ ✓ Save → API PATCH /feature-flag/bulk-toggle      │
│ ✓ Optimistic UI updates (local state first)        │
│ ✓ Invalidate React Query cache on save             │
│                                                     │
│ CLIENT SIDE:                                        │
│ ✓ Fetch flags on component mount                   │
│ ✓ Cache for 5 minutes (staleTime)                 │
│ ✓ Disable UI for locked types                      │
│ ✓ Fallback to first available if locked            │
│ ✓ No automatic polling (manual refetch)            │
│                                                     │
│ SYNC:                                               │
│ ✓ NOT real-time (cache-based)                      │
│ ✓ Updates visible on page refresh/navigate         │
│ ✓ Or when cache expires (5 min)                    │
│ ✓ Or on window focus (refetchOnWindowFocus)        │
│                                                     │
│ ERROR HANDLING:                                     │
│ ✓ Error code 158806: Feature locked                │
│ ✓ Client-side: Prevents selection                  │
│ ✓ Server-side: Optional validation                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```
