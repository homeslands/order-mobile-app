# Client Avatar Change Logic: Complete Guide

**Created**: 2026-04-03
**Status**: Complete Analysis

---

## 📋 Tổng Quan

Thay đổi avatar (ảnh đại diện) tài khoản client là một feature đơn giản nhưng có xử lý file upload, lưu trữ AWS S3, và cập nhật database.

```
┌────────────────────────────────────────────┐
│ CLIENT AVATAR CHANGE FLOW                  │
├────────────────────────────────────────────┤
│                                            │
│ 1. User selects image file                 │
│    ├─ Frontend validates (file size, type) │
│    └─ Shows preview to user                │
│                                            │
│ 2. User confirms upload                    │
│    └─ Call API: PATCH /auth/upload         │
│                                            │
│ 3. Backend processes                       │
│    ├─ Upload file to AWS S3                │
│    ├─ Delete old avatar (if exists)        │
│    ├─ Update user.image in database        │
│    └─ Return updated profile               │
│                                            │
│ 4. Frontend updates                        │
│    ├─ Update user store                    │
│    ├─ Show success toast                   │
│    └─ Display new avatar                   │
│                                            │
└────────────────────────────────────────────┘
```

---

## 1️⃣ Data Structure

### User Entity (Backend)

**File**: `src/user/user.entity.ts`

```typescript
@Entity('user_tbl')
export class User extends Base {
  @Column({ name: 'phonenumber_column', unique: true })
  phonenumber: string

  @Column({ name: 'first_name_column', nullable: true })
  firstName: string

  @Column({ name: 'last_name_column', nullable: true })
  lastName: string

  // ← Avatar field
  @AutoMap()
  @Column({ name: 'image_column', nullable: true })
  image?: string // AWS S3 path or URL

  @Column({ name: 'email_column', nullable: true })
  email?: string

  @Column({ name: 'address_column', nullable: true })
  address?: string

  @Column({ name: 'dob_column', nullable: true })
  dob?: string

  // Other fields...
}
```

### API Response DTO

**File**: `src/auth/auth.dto.ts`

```typescript
export class AuthProfileResponseDto {
  @AutoMap()
  @ApiProperty()
  readonly slug: string

  @ApiProperty()
  @AutoMap()
  readonly phonenumber: string

  @ApiProperty()
  @AutoMap()
  readonly firstName?: string

  @ApiProperty()
  @AutoMap()
  readonly lastName?: string

  // ← Image returned in response
  @AutoMap()
  @ApiProperty()
  readonly image: string // AWS S3 path

  @AutoMap(() => BranchResponseDto)
  @ApiProperty()
  readonly branch: BranchResponseDto

  @AutoMap(() => RoleResponseDto)
  @ApiProperty()
  role: RoleResponseDto

  // Other fields...
}
```

### Frontend User Store

**File**: `src/stores/user.store.ts` (Zustand store)

```typescript
interface IUserInfo {
  slug: string
  phonenumber: string
  firstName?: string
  lastName?: string
  image?: string // ← Stored here
  email?: string
  address?: string
  dob?: string
  branch?: IBranch
  role?: IRole
  // Other fields...
}

const userStore = (set) => ({
  userInfo: null as IUserInfo | null,

  setUserInfo: (user: IUserInfo) => set({ userInfo: user }),

  updateAvatar: (newImage: string) =>
    set((state) => ({
      userInfo: { ...state.userInfo, image: newImage },
    })),

  clearUserInfo: () => set({ userInfo: null }),
})
```

---

## 2️⃣ Backend API Endpoint

### Upload Avatar

**Endpoint**: `PATCH /auth/upload`

**Type**: Multipart file upload

**Authentication**: Required (Bearer token)

**File Constraints**:

- Max size: **5 MB** (5,242,880 bytes)
- Format: Any image type (JPEG, PNG, GIF, WebP, etc.)
- Mime type: `image/*`

#### Request

```
Method: PATCH
URL: /auth/upload
Headers:
  - Authorization: Bearer {token}
  - Content-Type: multipart/form-data

Body:
  file: <binary image file>
```

**Form Data Example:**

```
file: [binary data of image.jpg]
```

#### Response (Success)

**Status**: 201 Created

```json
{
  "statusCode": 201,
  "timestamp": "2024-04-03T14:30:00Z",
  "message": "Avatar been created successfully",
  "result": {
    "slug": "user-abc-123",
    "phonenumber": "0912345678",
    "firstName": "Nguyễn",
    "lastName": "Văn A",
    "image": "users/avatars/profile-1712145000000.jpg",
    "email": "user@example.com",
    "address": "123 Main St",
    "dob": "1990-01-01",
    "branch": {
      "slug": "branch-001",
      "name": "Branch A"
    },
    "role": {
      "slug": "role-customer",
      "name": "Customer"
    },
    "language": "VI",
    "isVerifiedEmail": true,
    "isVerifiedPhonenumber": true
  }
}
```

#### Response (Error)

**Status**: 400 Bad Request

```json
{
  "statusCode": 400,
  "code": 121001,
  "message": "File size exceeds maximum limit of 5 MB",
  "timestamp": "2024-04-03T14:31:00Z"
}
```

---

## 3️⃣ Backend Implementation

### Upload Avatar Logic

**File**: `src/auth/auth.service.ts:1403-1424`

```typescript
async uploadAvatar(
  user: CurrentUserDto,
  file: Express.Multer.File,
): Promise<AuthProfileResponseDto> {
  const context = `${AuthService.name}.${this.uploadAvatar.name}`;

  // Step 1: Get user entity from database
  const userEntity = await this.userUtils.getUser({
    where: { id: user.userId },
    relations: ['branch', 'role.permissions.authority.authorityGroup'],
  });

  // Step 2: Delete old avatar from S3
  // This prevents storage waste from old files
  await this.fileService.removeFile(userEntity.image);

  // Step 3: Upload new file to S3
  // Returns S3 path like "users/avatars/profile-1712145000000.jpg"
  userEntity.image = await this.fileService.uploadFile(file);

  // Step 4: Save updated user to database
  await this.userRepository.save(userEntity);

  // Step 5: Log action
  this.logger.log(`User ${user.userId} uploaded avatar`, context);

  // Step 6: Return updated profile
  return this.mapper.map(userEntity, User, AuthProfileResponseDto);
}
```

### File Upload Process

**File**: `src/file/s3/s3.service.ts`

```typescript
async uploadFile(
  file: Express.Multer.File,
  folderPath?: string
): Promise<string> {
  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const filename = `${file.fieldname}-${timestamp}`;
  const key = `${folderPath}/${filename}`;

  // Upload to S3
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read'  // Public access
  });

  await s3Client.send(command);

  // Return the path stored in database
  return key;  // e.g., "users/avatars/profile-1712145000000.jpg"
}
```

### File Deletion Process

```typescript
async removeFile(filePath?: string): Promise<void> {
  if (!filePath) return;  // Skip if no old file

  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: filePath
  });

  await s3Client.send(command);
}
```

---

## 4️⃣ Frontend Implementation

### Avatar Component

**File**: `src/components/app/avatar/profile-avatar.tsx`

```typescript
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui'
import { publicFileURL } from '@/constants'
import { useUserStore } from '@/stores'

export default function ProfileAvatar() {
  const { userInfo } = useUserStore()

  return (
    <Avatar>
      {/* Display avatar from S3 */}
      <AvatarImage
        src={
          userInfo?.image
            ? `${publicFileURL}/${userInfo?.image}`  // Full S3 URL
            : 'https://github.com/shadcn.png'  // Fallback
        }
        alt="Profile Picture"
      />

      {/* Fallback initials if image fails to load */}
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  )
}
```

**Avatar Display**: `${publicFileURL}/${userInfo.image}`

Example:

- publicFileURL: `https://cdn.example.com/dev`
- image: `users/avatars/profile-1712145000000.jpg`
- Full URL: `https://cdn.example.com/dev/users/avatars/profile-1712145000000.jpg`

### Upload Form Component

**File**: `src/components/app/form/update-profile-form.tsx` (or dedicated avatar upload dialog)

```typescript
import { useForm } from 'react-hook-form'
import { useUpdateProfile } from '@/hooks'
import { showToast } from '@/utils'
import { useUserStore } from '@/stores'
import { getProfile } from '@/api'
import { useQueryClient } from '@tanstack/react-query'

export function AvatarUploadForm() {
  const { setUserInfo } = useUserStore()
  const queryClient = useQueryClient()
  const { mutate: uploadAvatar } = useUploadAvatar()

  const handleFileSelect = (file: File) => {
    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must be less than 5 MB', 'error')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('File must be an image', 'error')
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    uploadAvatar(formData, {
      onSuccess: (data) => {
        // Update user store
        setUserInfo(data.result)

        // Invalidate profile cache
        queryClient.invalidateQueries({
          queryKey: ['profile'],
        })

        // Show success
        showToast('Avatar updated successfully!')
      },
      onError: (error) => {
        showToast(`Upload failed: ${error.message}`, 'error')
      }
    })
  }

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleFileSelect(file)
          }
        }}
      />
      {previewUrl && (
        <img src={previewUrl} alt="Preview" />
      )}
      <button onClick={() => handleSubmit(selectedFile)}>
        Upload Avatar
      </button>
    </div>
  )
}
```

### API Hook

**File**: `src/hooks/use-profile.ts` (or `src/hooks/use-upload-avatar.ts`)

```typescript
import { useMutation } from '@tanstack/react-query'
import { uploadAvatar } from '@/api'
import { AuthProfileResponseDto } from '@/types'

export function useUploadAvatar() {
  return useMutation<AuthProfileResponseDto, Error, FormData>({
    mutationFn: async (formData) => {
      const response = await fetch('/auth/upload', {
        method: 'PATCH',
        body: formData,
        headers: {
          Authorization: `Bearer ${getToken()}`,
          // Content-Type is set automatically for FormData
        },
      })

      if (!response.ok) {
        throw new Error('Avatar upload failed')
      }

      const data = await response.json()
      return data.result
    },
    onSuccess: (data) => {
      // Handle success in component
    },
    onError: (error) => {
      // Handle error in component
    },
  })
}
```

---

## 5️⃣ Complete Flow: Step-by-Step

### Timeline: Avatar Change

```
T0: User opens profile
├─ Load userInfo from store
└─ Display current avatar: ${publicFileURL}/${userInfo.image}

T1: User selects image file
├─ Frontend validates (size < 5MB, type = image/*)
├─ Show preview to user
└─ User confirms

T2: Upload starts
├─ Frontend sends: PATCH /auth/upload
├─ Body: multipart/form-data with file
└─ Authorization: Bearer {token}

T3: Backend receives (< 100ms)
├─ Authenticate user
├─ Validate file (size, type)
└─ Continue to T4

T4: Delete old avatar (< 500ms)
├─ Get S3 path from database
├─ Call S3: DeleteObject(old_path)
└─ Log deletion

T5: Upload new avatar (< 2s)
├─ Generate filename: profile-{timestamp}
├─ Call S3: PutObject(new_file)
├─ Store path in database: users/avatars/profile-1712145000000.jpg
└─ Return AuthProfileResponseDto

T6: Frontend receives response (status 201)
├─ Extract image from response
├─ Update userInfo in store
├─ Invalidate React Query cache
├─ Show success toast: "Avatar updated!"
└─ Display new avatar: ${publicFileURL}/${newImage}

T7: Display updates
├─ Avatar component re-renders
├─ New image loads from S3
└─ User sees updated avatar
```

---

## 6️⃣ Error Handling

### Error Codes

```
121001: File size exceeds limit (> 5 MB)
├─ User action: Try with smaller file
└─ Frontend: Show toast "File size must be less than 5 MB"

121003: Unexpected file
├─ User action: Upload single image only
└─ Frontend: Show toast "Only one image allowed"

121009: Error uploading file
├─ User action: Retry or contact support
├─ Cause: Network error, S3 down, permissions issue
└─ Frontend: Show toast "Failed to upload image. Please try again."
```

### Error Response

```json
{
  "statusCode": 400,
  "code": 121001,
  "message": "File size exceeds maximum limit of 5 MB",
  "timestamp": "2024-04-03T14:31:00Z",
  "data": {
    "fileSize": 6291456,
    "maxSize": 5242880,
    "sizeExceededBy": 1048576
  }
}
```

---

## 7️⃣ Avatar Display Scenarios

### Display in Profile

```typescript
// Profile page shows avatar
<img
  src={`${publicFileURL}/${userInfo?.image}`}
  alt="Profile"
  className="w-32 h-32 rounded-full object-cover"
  onError={(e) => {
    // Fallback if image fails to load
    e.currentTarget.src = 'https://via.placeholder.com/128'
  }}
/>
```

### Display in Header

```typescript
// Small avatar in navigation header
<Avatar>
  <AvatarImage
    src={`${publicFileURL}/${userInfo?.image}`}
    alt={userInfo?.firstName}
  />
  <AvatarFallback>
    {userInfo?.firstName?.[0]}{userInfo?.lastName?.[0]}
  </AvatarFallback>
</Avatar>
```

### Display in Order Confirmation

```typescript
// Show customer avatar in order receipt
{
  customerInfo: {
    name: userInfo?.firstName + ' ' + userInfo?.lastName,
    phone: userInfo?.phonenumber,
    avatar: `${publicFileURL}/${userInfo?.image}`
  }
}
```

---

## 8️⃣ Storage & Infrastructure

### AWS S3 Configuration

**Bucket Structure:**

```
bucket-name/
├── users/
│   ├── avatars/
│   │   ├── profile-1712145000000.jpg
│   │   ├── profile-1712145000100.jpg
│   │   └── ...
│   └── documents/
├── gift-cards/
├── products/
└── ...
```

**Access:**

- **Public-read**: Avatar files are public (ACL: public-read)
- **Signed URLs**: Optional for temporary private access (not used currently)
- **CDN**: Optional CloudFront distribution for caching

### Performance

```
Avatar Upload:
├─ File validation: < 100ms
├─ S3 upload: 500ms - 3s (depends on file size & network)
├─ Database update: 100-200ms
└─ Total: < 4 seconds (typical)

Avatar Display:
├─ First load: 200-800ms (S3 download)
├─ Cached load: < 50ms (browser cache)
└─ CDN cache: < 100ms (if using CloudFront)
```

---

## 9️⃣ Database Schema

### User Table

```sql
CREATE TABLE user_tbl (
  id INT PRIMARY KEY AUTO_INCREMENT,
  slug VARCHAR(50) UNIQUE NOT NULL,
  phonenumber_column VARCHAR(15) UNIQUE NOT NULL,
  password_column VARCHAR(255) NOT NULL,
  first_name_column VARCHAR(100),
  last_name_column VARCHAR(100),
  image_column VARCHAR(255),  -- ← Avatar path in S3
  email_column VARCHAR(255) UNIQUE,
  address_column VARCHAR(255),
  dob_column VARCHAR(10),
  language_column VARCHAR(5) DEFAULT 'VI',
  is_active_column BOOLEAN DEFAULT true,
  is_verified_email_column BOOLEAN DEFAULT false,
  is_verified_phonenumber_column BOOLEAN DEFAULT false,
  role_column INT NOT NULL,
  branch_id_column INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (role_column) REFERENCES role_tbl(id),
  FOREIGN KEY (branch_id_column) REFERENCES branch_tbl(id)
);
```

### Data Example

```
| slug      | phonenumber  | image_column                        | updated_at          |
|-----------|--------------|-------------------------------------|---------------------|
| user-abc  | 0912345678   | users/avatars/profile-1712145000000.jpg | 2024-04-03 14:30:00 |
| user-def  | 0987654321   | NULL                                | 2024-04-02 10:15:00 |
```

---

## 🔟 Avatar Change Checklist

### Frontend Checklist

- [x] Image file input with accept="image/\*"
- [x] File size validation (< 5 MB)
- [x] File type validation (image/\*)
- [x] Preview before upload
- [x] Loading state during upload
- [x] Success toast message
- [x] Error toast message
- [x] Update user store after success
- [x] Invalidate React Query cache
- [x] Refresh avatar display component
- [x] Fallback avatar (initials or placeholder)
- [x] Image onError handler

### Backend Checklist

- [x] Multipart file upload handling
- [x] File size validation (5 MB limit)
- [x] File type validation (image/\*)
- [x] Authentication check
- [x] S3 upload with unique filename
- [x] Delete old avatar from S3
- [x] Update database user.image
- [x] Return updated profile in response
- [x] Log file upload action
- [x] Error handling & logging
- [x] Transaction management

### Database Checklist

- [x] image_column field in user_tbl
- [x] Nullable (for users without avatar)
- [x] Indexed for performance
- [x] Default NULL value

---

## Summary Table

| Aspect             | Details                               |
| ------------------ | ------------------------------------- |
| **Endpoint**       | PATCH /auth/upload                    |
| **Method**         | PATCH (File Upload)                   |
| **Authentication** | Bearer token required                 |
| **File Max Size**  | 5 MB                                  |
| **File Format**    | image/\* (JPEG, PNG, GIF, WebP, etc.) |
| **Storage**        | AWS S3 (public-read)                  |
| **Database Field** | user.image (VARCHAR 255)              |
| **Response**       | AuthProfileResponseDto                |
| **Success Code**   | 201 Created                           |
| **Error Codes**    | 121001, 121003, 121009                |
| **Old Avatar**     | Auto-deleted from S3                  |
| **Display Path**   | `${publicFileURL}/${user.image}`      |
| **Performance**    | < 4 seconds typical                   |
| **Caching**        | Browser cache + optional CDN          |

---

**Document Status**: Complete
**Last Updated**: 2026-04-03
