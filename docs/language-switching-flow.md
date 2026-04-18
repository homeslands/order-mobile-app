# Language Switching (English-Vietnamese) Flow

## Overview

The application supports two languages: English (EN) and Vietnamese (VI). The language switching feature allows users to change their preferred language through the Settings dropdown menu. The selected language is persisted at both the client-side (localStorage, Zustand store) and server-side (database).

**Key Flow:**

1. User selects language in Settings dropdown
2. Frontend calls API to save preference to server
3. Server updates user's language in database
4. Frontend updates Zustand store and i18n instance
5. UI automatically re-renders with new language

---

## Part 1: Frontend Implementation

### 1.1 i18n Configuration (`src/i18n.ts`)

**What it does:**

- Initializes i18next with all translation resources (41 namespaces across 2 languages)
- Sets up language detection (userInfo > localStorage > default VI)
- Configures React-i18next integration

**Key Points:**

- **i18nextLng localStorage key:** Browser automatically saves current language
- **Language Priority:** userInfo.language (from server) > localStorage > 'vi' (default)
- **Namespaces:** 41 namespaces like toast, auth, common, menu, etc.
- **XSS Protection:** interpolation.escapeValue = false (React handles escaping)

```typescript
// i18n initialization
const initialLanguage = (() => {
  const userStore = useUserStore.getState()
  if (userStore.userInfo?.language) {
    return userStore.userInfo.language
  }
  return window.localStorage.getItem('i18nextLng') || 'vi'
})()
```

### 1.2 App Bootstrap (`src/app/App.tsx` - Lines 113-121)

**When app initializes:**

```typescript
// Sync language from userInfo (from server)
if (userStore.userInfo?.language) {
  try {
    i18n.changeLanguage(userStore.userInfo.language)
  } catch (error) {
    console.error('Failed to change language:', error)
    // Continue dengan default language
  }
}
```

**Purpose:** When app loads and userInfo is already cached, apply the saved language immediately.

### 1.3 Settings Dropdown UI (`src/components/app/dropdown/settings-dropdown.tsx`)

**Location:** Top-right settings icon button in header

**Component Structure:**

```
SettingsDropdown
├── Language Selection (Select dropdown)
│   ├── English (with US flag)
│   └── Tiếng Việt (with VN flag)
└── Theme Selection (Light/Dark)
```

**Key Code - `handleUpdateLanguage()` (Lines 29-47):**

```typescript
const handleUpdateLanguage = (language: string) => {
  // Path 1: If user is authenticated
  if (userInfo?.slug) {
    updateLanguage(
      { userSlug: userInfo.slug, language },
      {
        onSuccess: (response) => {
          // Update store with new language from server
          setUserInfo({
            ...userInfo,
            language: response.result.language,
          })
          // Update i18n instance
          i18n.changeLanguage(language)
        },
      },
    )
  }
  // Path 2: If user not authenticated
  else {
    // Save to localStorage only
    window.localStorage.setItem('i18nextLng', language)
    i18n.changeLanguage(language)
  }
}
```

**Flow Breakdown:**

1. **User selects language** in dropdown (value: 'en' or 'vi')
2. **Call handleUpdateLanguage()**
3. **Check userInfo.slug** (means user is logged in):
   - **YES (authenticated):**
     - Call API: `updateLanguage({ userSlug, language })`
     - On success: Update Zustand store → Update i18n → UI re-renders
   - **NO (not authenticated):**
     - Save directly to localStorage
     - Update i18n → UI re-renders

**Side Effect - useEffect (Lines 50-54):**

```typescript
useEffect(() => {
  if (userInfo?.language) {
    i18n.changeLanguage(userInfo.language)
  }
}, [userInfo?.language, i18n])
```

This ensures whenever userInfo.language changes, i18n is updated.

### 1.4 API Call (`src/api/language.ts`)

**Endpoint:** `PATCH /user/{userSlug}/language`

```typescript
export async function updateLanguage(
  userSlug: string,
  language: string,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.patch<IApiResponse<IUserInfo>>(
    `/user/${userSlug}/language`,
    { language },
  )
  return response.data
}
```

**Request:**

- Method: PATCH
- Path: `/user/{userSlug}/language`
- Body: `{ language: "en" | "vi" }`
- Auth: Bearer token (in header)

### 1.5 React Query Hook (`src/hooks/use-language.ts`)

```typescript
export const useUpdateLanguage = () => {
  return useMutation({
    mutationFn: async ({ userSlug, language }) => {
      return updateLanguage(userSlug, language)
    },
  })
}
```

**Purpose:** Wraps API call in React Query mutation for:

- Automatic error handling
- Loading states
- Retry logic
- Integration with global error handler

### 1.6 Zustand User Store (`src/stores/user.store.ts`)

**State:**

```typescript
{
  userInfo: IUserInfo | null,
  setUserInfo: (userInfo: IUserInfo) => void,
  removeUserInfo: () => void,
  // ... other methods
}
```

**Persistence:**

- Key: `'user-info'`
- Storage: localStorage
- Auto-synced across tabs/windows

**Language field** in IUserInfo (Line 15):

```typescript
export interface IUserInfo {
  slug: string
  image?: string
  phonenumber: string
  firstName: string
  lastName: string
  dob: string
  email: string
  address: string
  language: string // ← Stores user's language preference
  // ... other fields
}
```

---

## Part 2: Backend Implementation

### 2.1 Request DTO (`src/user/user.dto.ts` - Lines 238-243)

```typescript
export class UpdateUserLanguageRequestDto {
  @ApiProperty()
  @IsNotEmpty({ message: INVALID_LANGUAGE })
  @IsEnum(UserLanguage, { message: INVALID_LANGUAGE })
  language: string
}
```

**Validation:**

- Must not be empty
- Must be enum value: 'vi' | 'en'
- Error message: INVALID_LANGUAGE

### 2.2 User Entity (`src/user/user.entity.ts` - Lines 47-48)

```typescript
@AutoMap()
@Column({ name: 'language_column', default: UserLanguage.VI })
language: string;
```

**Database Column:**

- Column name: `language_column`
- Type: VARCHAR
- Default: 'vi'
- Auto-mapped for DTO conversion

### 2.3 Language Enum (`src/user/user.constant.ts`)

```typescript
export enum UserLanguage {
  VI = 'vi',
  EN = 'en',
}
```

### 2.4 Controller Endpoint (`src/user/user.controller.ts` - Lines 227-250)

```typescript
@Patch(':slug/language')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Update user language' })
@ApiResponseWithType({
  status: HttpStatus.OK,
  description: 'User language has been updated successfully',
  type: AuthProfileResponseDto,
})
async updateUserLanguage(
  @CurrentUser(new ValidationPipe({ validateCustomDecorators: true }))
  currentUserDto: CurrentUserDto,
  @Param('slug') slug: string,
  @Body() requestData: UpdateUserLanguageRequestDto,
) {
  const result = await this.userService.updateUserLanguage(
    currentUserDto.userId,
    requestData,
  );
  return {
    message: 'User language has been updated successfully',
    statusCode: HttpStatus.OK,
    timestamp: new Date().toISOString(),
    result,
  } as AppResponseDto<AuthProfileResponseDto>;
}
```

**Key Points:**

- Route parameter `slug` is NOT used (userId from token is used for security)
- Requires authentication (`@CurrentUser` decorator)
- Validates language enum
- Returns full AuthProfileResponseDto (user's complete profile)

### 2.5 Service Logic (`src/user/user.service.ts` - Lines 465-481)

```typescript
async updateUserLanguage(
  userId: string,
  requestData: UpdateUserLanguageRequestDto,
) {
  const context = `${UserService.name}.${this.updateUserLanguage.name}`;

  // Find user by ID (from JWT token)
  const user = await this.userRepository.findOne({
    where: { id: userId },
  });

  if (!user) {
    this.logger.warn(`User ${userId} not found`, context);
    throw new UserException(UserValidation.USER_NOT_FOUND);
  }

  // Update language field
  user.language = requestData.language;

  // Save to database
  await this.userRepository.save(user);

  // Log action
  this.logger.log(`User ${user.slug} language has been updated`, context);

  // Return mapped response DTO
  return this.mapper.map(user, User, AuthProfileResponseDto);
}
```

**Steps:**

1. Find user by ID (from JWT token)
2. Validate user exists
3. Update language field
4. Save to database
5. Log action
6. Map and return response

---

## Part 3: Data Flow & Timeline

### 3.1 Complete Request/Response Flow

**Authenticated User Flow:**

```
Frontend                          Backend
─────────────────────────────────────────────

User clicks language in dropdown
        │
        ├─→ Call handleUpdateLanguage('en')
        │
        ├─→ Call updateLanguage API
        │
        └──→ PATCH /user/{userSlug}/language
                    ├─ Header: Authorization: Bearer {token}
                    └─ Body: { language: 'en' }
                           │
                           └──→ UserController.updateUserLanguage()
                                   │
                                   ├─ Extract userId from JWT token
                                   │
                                   ├─ Validate UpdateUserLanguageRequestDto
                                   │   └─ language must be 'vi' or 'en'
                                   │
                                   └─→ UserService.updateUserLanguage()
                                       │
                                       ├─ Find user by id
                                       │
                                       ├─ Update user.language = 'en'
                                       │
                                       ├─ Save to database
                                       │   └─ UPDATE users SET language_column = 'en'
                                       │
                                       └─→ Return User entity mapped to AuthProfileResponseDto

        ←────────────────────────────────────

        Response received
        │
        ├─ Update Zustand store: setUserInfo({ ...userInfo, language: 'en' })
        │
        ├─ Update i18n: i18n.changeLanguage('en')
        │
        └─ UI automatically re-renders with English text
```

### 3.2 Timeline (T0 = User selects language)

| Time | Event                  | Component                       | Description                                     |
| ---- | ---------------------- | ------------------------------- | ----------------------------------------------- |
| T0   | User selects language  | SettingsDropdown                | User clicks 'English' or 'Tiếng Việt'           |
| T1   | handleUpdateLanguage() | SettingsDropdown                | Language selection handler runs                 |
| T2   | Check authentication   | SettingsDropdown                | Check if userInfo.slug exists                   |
| T3   | API call initiated     | useUpdateLanguage (React Query) | useMutation.mutate() called                     |
| T4   | HTTP request sent      | Axios                           | PATCH /user/{slug}/language                     |
| T5   | Request received       | UserController                  | Endpoint handler processes request              |
| T6   | Database update        | UserService                     | UPDATE users SET language_column = ...          |
| T7   | Response received      | Frontend                        | API returns updated user with new language      |
| T8   | Store updated          | Zustand                         | setUserInfo({ ...userInfo, language: 'en' })    |
| T9   | i18n updated           | i18next                         | i18n.changeLanguage('en')                       |
| T10+ | UI re-renders          | React                           | All components using useTranslation() re-render |

**Total Time:** ~500ms - 1000ms (depending on network)

---

## Part 4: Request/Response Examples

### 4.1 Request Example (Authenticated User)

**Scenario:** User logged in as 'john-doe' switches to English

**HTTP Request:**

```http
PATCH /user/john-doe/language HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "language": "en"
}
```

**Frontend Call:**

```typescript
// settings-dropdown.tsx
const handleUpdateLanguage = (language: string) => {
  updateLanguage({ userSlug: 'john-doe', language: 'en' })
}
```

### 4.2 Success Response (200 OK)

```json
{
  "statusCode": 200,
  "message": "User language has been updated successfully",
  "timestamp": "2026-04-03T10:45:30.123Z",
  "result": {
    "slug": "john-doe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phonenumber": "+84123456789",
    "address": "123 Main St",
    "dob": "1990-05-15",
    "language": "en",
    "image": "https://s3.amazonaws.com/images/john-doe.jpg",
    "isVerifiedEmail": true,
    "isVerifiedPhonenumber": true,
    "isActive": true,
    "branch": {
      "slug": "branch-1",
      "name": "Branch 1",
      "address": "123 Business Ave",
      "addressDetail": {
        "lat": 10.7769,
        "lng": 106.6966
      }
    },
    "role": {
      "slug": "staff",
      "name": "STAFF",
      "description": "Staff member",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "permissions": []
    },
    "membershipCard": {
      "slug": "card-1",
      "isActive": true,
      "createdAt": "2026-03-01T00:00:00.000Z",
      "expiredAt": "2027-03-01T00:00:00.000Z"
    },
    "userRequirements": []
  }
}
```

**Frontend Processing (settings-dropdown.tsx):**

```typescript
const handleUpdateLanguage = (language: string) => {
  if (userInfo?.slug) {
    updateLanguage(
      { userSlug: userInfo.slug, language },
      {
        onSuccess: (response) => {
          // Update store with response data
          setUserInfo({
            ...userInfo,
            language: response.result.language, // 'en'
          })
          // Update i18n
          i18n.changeLanguage(language) // 'en'
        },
      },
    )
  }
}
```

### 4.3 Error Response - Invalid Language (400 Bad Request)

**Scenario:** User sends invalid language 'fr' (French not supported)

```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "timestamp": "2026-04-03T10:45:30.123Z",
  "errors": [
    {
      "field": "language",
      "message": "Language must be one of: vi, en"
    }
  ]
}
```

### 4.4 Error Response - User Not Found (404 Not Found)

**Scenario:** User ID in JWT token doesn't exist in database

```json
{
  "statusCode": 404,
  "message": "User not found",
  "timestamp": "2026-04-03T10:45:30.123Z"
}
```

**Frontend Error Handling:**

- React Query mutation.onError callback is triggered
- Global error handler shows toast: "User not found"
- Language doesn't change

### 4.5 Error Response - Unauthorized (401)

**Scenario:** User sends request without valid JWT token

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "timestamp": "2026-04-03T10:45:30.123Z"
}
```

---

## Part 5: Unauthenticated User Flow

**Scenario:** User not logged in switches language

```typescript
// settings-dropdown.tsx - Line 42-45
else {
  // User not authenticated
  window.localStorage.setItem('i18nextLng', language)
  i18n.changeLanguage(language)
}
```

**What Happens:**

1. NO API call made (no userSlug)
2. Language saved to localStorage with key `i18nextLng`
3. i18n instance updated immediately
4. UI re-renders with new language

**Persistence:**

- Saved in localStorage
- When user logs in later, server's language setting will override this
- When user logs out, browser language returns to localStorage value

---

## Part 6: Language Synchronization

### 6.1 On App Load (src/app/App.tsx - Lines 113-121)

**Scenario:** App loads, userInfo already cached in localStorage

```typescript
// i18n.ts - Language initialization
const initialLanguage = (() => {
  const userStore = useUserStore.getState()
  if (userStore.userInfo?.language) {
    return userStore.userInfo.language // Use server language
  }
  return window.localStorage.getItem('i18nextLng') || 'vi' // Fallback
})()

// App.tsx - Sync on initialization
useEffect(() => {
  if (userStore.userInfo?.language) {
    i18n.changeLanguage(userStore.userInfo.language)
  }
}, [])
```

**Priority Order:**

1. **userInfo.language** (from server, most authoritative)
2. **localStorage['i18nextLng']** (from previous session)
3. **'vi'** (default fallback)

### 6.2 On userInfo Update

**Scenario:** userInfo changes (e.g., after language update or profile refresh)

```typescript
// settings-dropdown.tsx - Lines 50-54
useEffect(() => {
  if (userInfo?.language) {
    i18n.changeLanguage(userInfo.language)
  }
}, [userInfo?.language, i18n])
```

**Triggers:**

- When user changes language (setUserInfo in handleUpdateLanguage)
- When profile is refreshed from server
- When user logs out (userInfo becomes null)
- When user logs in (userInfo is loaded from server)

---

## Part 7: Technical Details

### 7.1 i18n Library Stack

```
i18next (core)
├── react-i18next (React integration)
├── i18next-browser-languagedetector (Auto-detect browser language)
└── i18next-http-backend (Load translations from HTTP)
```

**Usage in Components:**

```typescript
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t, i18n } = useTranslation('namespace')

  // t('key') returns translated string
  // i18n.language returns current language code
  // i18n.changeLanguage(lang) changes language
}
```

### 7.2 Translation Files Structure

**Location:** `src/locales/{lang}/{namespace}.json`

```
locales/
├── en/
│   ├── toast.json
│   ├── auth.json
│   ├── common.json
│   ├── menu.json
│   ├── setting.json
│   └── ... (41 namespaces total)
└── vi/
    ├── toast.json
    ├── auth.json
    ├── common.json
    ├── menu.json
    ├── setting.json
    └── ... (41 namespaces total)
```

**Example:** `locales/en/setting.json`

```json
{
  "setting": {
    "title": "Settings",
    "language": "Language",
    "selectLanguage": "Select language",
    "theme": "Theme",
    "selectTheme": "Select theme",
    "light": "Light",
    "dark": "Dark"
  }
}
```

### 7.3 Storage Locations

| Location      | Key                 | Scope    | Persistence               |
| ------------- | ------------------- | -------- | ------------------------- |
| localStorage  | `i18nextLng`        | Browser  | Permanent (until cleared) |
| localStorage  | `user-info`         | App-wide | Permanent (until logout)  |
| Zustand Store | `userInfo.language` | App-wide | RAM + localStorage sync   |
| i18n Instance | (in-memory)         | App-wide | Session only              |

### 7.4 Security Considerations

1. **JWT Token Validation:**
   - UserId extracted from JWT token, not from request path
   - Path param `slug` is NOT trusted for security
   - Ensures user can only update their own language

2. **Language Validation:**
   - UserLanguage enum restricts to: 'vi', 'en' only
   - DTO validation prevents injection attacks

3. **XSS Prevention:**
   - i18n.interpolation.escapeValue = false
   - React automatically escapes JSX values

---

## Part 8: Implementation Checklist

### Frontend Checklist

- [ ] i18n configuration with all namespaces
- [ ] SettingsDropdown component with Select dropdown
- [ ] handleUpdateLanguage() with auth check
- [ ] useUpdateLanguage() React Query hook
- [ ] API call: updateLanguage(slug, language)
- [ ] Zustand store with language persistence
- [ ] useEffect to sync language on app load
- [ ] useEffect to sync language on userInfo change
- [ ] All components using useTranslation()

### Backend Checklist

- [ ] UserLanguage enum (VI, EN)
- [ ] User entity with language column (default: VI)
- [ ] UpdateUserLanguageRequestDto with validation
- [ ] UserController.updateUserLanguage() endpoint
- [ ] UserService.updateUserLanguage() logic
- [ ] Authentication requirement (@CurrentUser)
- [ ] Error handling for user not found
- [ ] Logging for language updates
- [ ] Return AuthProfileResponseDto

### Database Checklist

- [ ] User table has language_column
- [ ] Default value: 'vi'
- [ ] Column type: VARCHAR
- [ ] Nullable: false
- [ ] Index: optional (not frequent query criteria)

---

## Part 9: Troubleshooting

### Issue: Language doesn't persist after reload

**Causes:**

- localStorage cleared
- Zustand store not persisted
- userInfo not loaded from server

**Solution:** Check localStorage and server userInfo

### Issue: Language not syncing across tabs

**Cause:** Each tab has separate i18n instance in memory

**Solution:** localStorage sync works, but i18n instance must reload from stored value

### Issue: UI still shows old language after change

**Cause:**

- Component not using useTranslation()
- Hardcoded strings instead of translation keys
- useTranslation() from wrong namespace

**Solution:** Use i18n keys and correct namespace

### Issue: API returns 400 Bad Request

**Cause:** Invalid language value (not 'vi' or 'en')

**Solution:** Validate frontend before sending, use enum

---

## Summary

**Flow in 5 Steps:**

1. **User selects language** in Settings dropdown
2. **Frontend API call** to PATCH /user/{slug}/language
3. **Backend updates** user.language in database
4. **Response returns** updated user with new language
5. **Frontend updates** Zustand store and i18n → UI re-renders

**Key Files:**

- Frontend: `settings-dropdown.tsx`, `use-language.ts`, `i18n.ts`, `user.store.ts`
- Backend: `user.controller.ts`, `user.service.ts`, `user.entity.ts`
- Config: `src/locales/{en,vi}/*.json`

**Storage:** Server (database) → Zustand store → localStorage → i18n instance → UI
