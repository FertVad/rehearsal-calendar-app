# Rehearsal Calendar Native App - API Documentation

## Overview

The Rehearsal Calendar Native App API is a RESTful API built for managing theater rehearsal schedules. It provides comprehensive functionality for user authentication, project management, rehearsal scheduling, availability tracking, member management, and project invitations.

**Base URL:**
- Production: `https://rehearsal-calendar-app.onrender.com/api`
- Development: `http://localhost:3001/api`

**API Version:** 1.0

**Response Format:** JSON

## Authentication

The API uses JWT (JSON Web Token) based authentication with separate access and refresh tokens.

### Token Lifecycle

- **Access Token**: Short-lived token (15 minutes) used for API requests
- **Refresh Token**: Long-lived token (7 days) used to obtain new access tokens

### How to Authenticate Requests

Include the access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Token Refresh Flow

When an access token expires (401 error), use the refresh token to obtain a new access token pair via the `/auth/refresh` endpoint.

---

## Endpoints

### Authentication Endpoints

#### 1. Register New User

Create a new user account.

**Endpoint:** `POST /auth/register`

**Authentication Required:** No

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Parameters:**
- `email` (string, required): User's email address (must be unique)
- `password` (string, required): User's password (will be hashed)
- `firstName` (string, required): User's first name
- `lastName` (string, optional): User's last name

**Success Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "timezone": "Asia/Jerusalem",
    "locale": "en",
    "notificationsEnabled": true,
    "emailNotifications": true
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields
  ```json
  { "error": "Email, password and first name are required" }
  ```
- `409 Conflict`: Email already exists
  ```json
  { "error": "User with this email already exists" }
  ```
- `500 Internal Server Error`: Server error
  ```json
  { "error": "Failed to register user" }
  ```

---

#### 2. Login

Authenticate an existing user.

**Endpoint:** `POST /auth/login`

**Authentication Required:** No

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Parameters:**
- `email` (string, required): User's email address
- `password` (string, required): User's password

**Success Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "timezone": "Asia/Jerusalem",
    "locale": "en",
    "notificationsEnabled": true,
    "emailNotifications": true
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields
  ```json
  { "error": "Email and password are required" }
  ```
- `401 Unauthorized`: Invalid credentials
  ```json
  { "error": "Invalid email or password" }
  ```
- `500 Internal Server Error`: Server error
  ```json
  { "error": "Failed to login" }
  ```

---

#### 3. Refresh Access Token

Obtain new access and refresh tokens using a valid refresh token.

**Endpoint:** `POST /auth/refresh`

**Authentication Required:** No (but requires valid refresh token)

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Responses:**
- `400 Bad Request`: Missing refresh token
  ```json
  { "error": "Refresh token is required" }
  ```
- `401 Unauthorized`: Invalid or expired refresh token
  ```json
  { "error": "Invalid or expired refresh token" }
  ```

---

#### 4. Get Current User Info

Retrieve the authenticated user's profile information.

**Endpoint:** `GET /auth/me`

**Authentication Required:** Yes

**Success Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "avatarUrl": "https://example.com/avatar.jpg",
  "timezone": "Asia/Jerusalem",
  "locale": "en",
  "notificationsEnabled": true,
  "emailNotifications": true,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: User not found
  ```json
  { "error": "User not found" }
  ```

---

#### 5. Update Current User Info

Update the authenticated user's profile information.

**Endpoint:** `PUT /auth/me`

**Authentication Required:** Yes

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+1234567890",
  "timezone": "America/New_York",
  "locale": "en",
  "notificationsEnabled": true,
  "emailNotifications": false,
  "password": "newSecurePassword123"
}
```

**Parameters (all optional):**
- `firstName` (string): User's first name
- `lastName` (string): User's last name
- `phone` (string): User's phone number
- `timezone` (string): IANA timezone identifier (e.g., "America/New_York")
- `locale` (string): Locale code (e.g., "en", "es")
- `notificationsEnabled` (boolean): Enable/disable notifications
- `emailNotifications` (boolean): Enable/disable email notifications
- `password` (string): New password (will be hashed)

**Success Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+1234567890",
  "avatarUrl": "https://example.com/avatar.jpg",
  "timezone": "America/New_York",
  "locale": "en",
  "notificationsEnabled": true,
  "emailNotifications": false
}
```

**Error Responses:**
- `400 Bad Request`: No fields to update
  ```json
  { "error": "No fields to update" }
  ```
- `401 Unauthorized`: Invalid or missing token

---

#### 6. Delete Account

Permanently delete the authenticated user's account.

**Endpoint:** `DELETE /auth/me`

**Authentication Required:** Yes

**Success Response (200):**
```json
{
  "message": "Account deleted successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error

**Notes:**
- This action is irreversible
- All user data and project memberships will be deleted

---

### Projects Endpoints

#### 1. Get User's Projects

Retrieve all projects where the user is a member.

**Endpoint:** `GET /native/projects`

**Authentication Required:** Yes

**Success Response (200):**
```json
{
  "projects": [
    {
      "id": "1",
      "name": "Hamlet Production",
      "description": "Winter 2024 production of Hamlet",
      "timezone": "Asia/Jerusalem",
      "is_admin": true,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "2",
      "name": "Romeo and Juliet",
      "description": "",
      "timezone": "America/New_York",
      "is_admin": false,
      "created_at": "2024-02-01T14:00:00.000Z",
      "updated_at": "2024-02-01T14:00:00.000Z"
    }
  ]
}
```

**Notes:**
- Only returns projects where the user has an active membership
- `is_admin` indicates whether the user is an owner or admin of the project
- Projects are sorted by creation date (newest first)

---

#### 2. Create New Project

Create a new project.

**Endpoint:** `POST /native/projects`

**Authentication Required:** Yes

**Request Body:**
```json
{
  "name": "Hamlet Production",
  "description": "Winter 2024 production of Hamlet",
  "timezone": "Asia/Jerusalem"
}
```

**Parameters:**
- `name` (string, required): Project name
- `description` (string, optional): Project description
- `timezone` (string, optional): IANA timezone identifier (defaults to "Asia/Jerusalem")

**Success Response (201):**
```json
{
  "project": {
    "id": "1",
    "name": "Hamlet Production",
    "description": "Winter 2024 production of Hamlet",
    "timezone": "Asia/Jerusalem",
    "is_admin": true,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing project name
  ```json
  { "error": "Project name is required" }
  ```
- `401 Unauthorized`: Invalid or missing token

**Notes:**
- The user who creates the project automatically becomes the owner with admin privileges
- A project member record is automatically created with role "owner"

---

#### 3. Get Single Project

Retrieve details of a specific project.

**Endpoint:** `GET /native/projects/:projectId`

**Authentication Required:** Yes

**Path Parameters:**
- `projectId` (string, required): The project ID

**Success Response (200):**
```json
{
  "project": {
    "id": "1",
    "name": "Hamlet Production",
    "description": "Winter 2024 production of Hamlet",
    "timezone": "Asia/Jerusalem",
    "is_admin": true,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `403 Forbidden`: User is not a member
  ```json
  { "error": "Access denied" }
  ```
- `404 Not Found`: Project not found
  ```json
  { "error": "Project not found" }
  ```

---

### Rehearsals Endpoints

#### 1. Get All Rehearsals for a Project

Retrieve all rehearsals for a specific project.

**Endpoint:** `GET /native/projects/:projectId/rehearsals`

**Authentication Required:** Yes

**Path Parameters:**
- `projectId` (string, required): The project ID

**Success Response (200):**
```json
{
  "rehearsals": [
    {
      "id": "1",
      "projectId": "1",
      "title": "Act 1 Scene 3",
      "description": "Focus on blocking",
      "startsAt": "2024-03-15T14:00:00.000Z",
      "endsAt": "2024-03-15T17:00:00.000Z",
      "location": "Main Theatre",
      "createdAt": "2024-03-01T10:00:00.000Z",
      "updatedAt": "2024-03-01T10:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `403 Forbidden`: User is not a project member
  ```json
  { "error": "Access denied" }
  ```

**Notes:**
- Rehearsals are sorted by start time (newest first)
- All timestamps are in ISO 8601 format with timezone information
- `title` and `description` may be null

---

#### 2. Create New Rehearsal

Create a new rehearsal for a project.

**Endpoint:** `POST /native/projects/:projectId/rehearsals`

**Authentication Required:** Yes (must be admin/owner)

**Path Parameters:**
- `projectId` (string, required): The project ID

**Request Body (New Format - Recommended):**
```json
{
  "title": "Act 1 Scene 3",
  "description": "Focus on blocking",
  "startsAt": "2024-03-15T14:00:00.000Z",
  "endsAt": "2024-03-15T17:00:00.000Z",
  "location": "Main Theatre"
}
```

**Request Body (Old Format - Backward Compatibility):**
```json
{
  "title": "Act 1 Scene 3",
  "description": "Focus on blocking",
  "date": "2024-03-15",
  "startTime": "14:00",
  "endTime": "17:00",
  "location": "Main Theatre"
}
```

**Parameters:**
- `startsAt` (string, required if using new format): ISO 8601 timestamp
- `endsAt` (string, required if using new format): ISO 8601 timestamp
- `date` (string, required if using old format): Date in YYYY-MM-DD format
- `startTime` (string, required if using old format): Time in HH:mm format
- `endTime` (string, required if using old format): Time in HH:mm format
- `title` (string, optional): Rehearsal title
- `description` (string, optional): Rehearsal description
- `location` (string, optional): Rehearsal location

**Success Response (201):**
```json
{
  "rehearsal": {
    "id": "1",
    "projectId": "1",
    "title": "Act 1 Scene 3",
    "description": "Focus on blocking",
    "startsAt": "2024-03-15T14:00:00.000Z",
    "endsAt": "2024-03-15T17:00:00.000Z",
    "location": "Main Theatre",
    "createdAt": "2024-03-01T10:00:00.000Z",
    "updatedAt": "2024-03-01T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields or invalid format
  ```json
  { "error": "Either (startsAt, endsAt) or (date, startTime, endTime) are required" }
  ```
  ```json
  { "error": "Invalid date format" }
  ```
- `403 Forbidden`: User is not an admin/owner
  ```json
  { "error": "Only admins can create rehearsals" }
  ```

**Notes:**
- When a rehearsal is created, busy availability slots are automatically created for all project members
- The old format (date/startTime/endTime) converts times to the project's timezone
- Only users with "owner" or "admin" role can create rehearsals

---

#### 3. Update Rehearsal

Update an existing rehearsal.

**Endpoint:** `PUT /native/projects/:projectId/rehearsals/:rehearsalId`

**Authentication Required:** Yes (must be admin/owner)

**Path Parameters:**
- `projectId` (string, required): The project ID
- `rehearsalId` (string, required): The rehearsal ID

**Request Body:**
```json
{
  "title": "Act 1 Scene 3 - Updated",
  "description": "Focus on blocking and timing",
  "startsAt": "2024-03-15T15:00:00.000Z",
  "endsAt": "2024-03-15T18:00:00.000Z",
  "location": "Studio B"
}
```

**Parameters:**
Same as Create Rehearsal (supports both new and old formats)

**Success Response (200):**
```json
{
  "rehearsal": {
    "id": "1",
    "projectId": "1",
    "title": "Act 1 Scene 3 - Updated",
    "description": "Focus on blocking and timing",
    "startsAt": "2024-03-15T15:00:00.000Z",
    "endsAt": "2024-03-15T18:00:00.000Z",
    "location": "Studio B",
    "createdAt": "2024-03-01T10:00:00.000Z",
    "updatedAt": "2024-03-10T14:30:00.000Z"
  }
}
```

**Error Responses:**
- `403 Forbidden`: User is not an admin/owner
  ```json
  { "error": "Only admins can update rehearsals" }
  ```
- `404 Not Found`: Rehearsal not found
  ```json
  { "error": "Rehearsal not found" }
  ```

**Notes:**
- When a rehearsal time is updated, all associated availability slots are automatically updated
- Only affects availability slots that were created from this rehearsal

---

#### 4. Delete Rehearsal

Delete a rehearsal.

**Endpoint:** `DELETE /native/projects/:projectId/rehearsals/:rehearsalId`

**Authentication Required:** Yes (must be admin/owner)

**Path Parameters:**
- `projectId` (string, required): The project ID
- `rehearsalId` (string, required): The rehearsal ID

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**
- `403 Forbidden`: User is not an admin/owner
  ```json
  { "error": "Only admins can delete rehearsals" }
  ```
- `404 Not Found`: Rehearsal not found
  ```json
  { "error": "Rehearsal not found" }
  ```

**Notes:**
- This action cascades:
  - Deletes all availability slots associated with the rehearsal
  - Deletes all RSVP responses for the rehearsal
  - Deletes the rehearsal record

---

#### 5. RSVP to Rehearsal

Submit or update an RSVP response for a rehearsal.

**Endpoint:** `POST /native/rehearsals/:rehearsalId/respond`

**Authentication Required:** Yes (must be project member)

**Path Parameters:**
- `rehearsalId` (string, required): The rehearsal ID

**Request Body:**
```json
{
  "status": "confirmed",
  "notes": "I'll be there on time"
}
```

**Parameters:**
- `status` (string, required): RSVP status - one of:
  - `"confirmed"` or `"yes"` - User will attend
  - `"declined"` or `"no"` - User will not attend
  - `"tentative"` or `"maybe"` - User might attend
- `notes` (string, optional): Additional notes or comments

**Success Response (200):**
```json
{
  "response": {
    "id": "1",
    "rehearsalId": "1",
    "userId": "1",
    "response": "yes",
    "notes": "I'll be there on time",
    "createdAt": "2024-03-01T10:00:00.000Z",
    "updatedAt": "2024-03-01T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid status
  ```json
  { "error": "Invalid status. Must be confirmed, declined, tentative, yes, no, or maybe" }
  ```
- `403 Forbidden`: User is not a project member
  ```json
  { "error": "You must be a project member to RSVP" }
  ```
- `404 Not Found`: Rehearsal not found
  ```json
  { "error": "Rehearsal not found" }
  ```

**Notes:**
- If the user has already responded, this endpoint updates the existing response
- The response is stored in the database as "yes", "no", or "maybe"
- The API accepts both client-friendly ("confirmed", "declined", "tentative") and database values

---

#### 6. Get All Responses for Rehearsal

Retrieve all RSVP responses for a rehearsal.

**Endpoint:** `GET /native/rehearsals/:rehearsalId/responses`

**Authentication Required:** Yes (must be project member)

**Path Parameters:**
- `rehearsalId` (string, required): The rehearsal ID

**Success Response (200):**
```json
{
  "responses": [
    {
      "id": "1",
      "rehearsalId": "1",
      "userId": "1",
      "response": "yes",
      "notes": "I'll be there on time",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "createdAt": "2024-03-01T10:00:00.000Z",
      "updatedAt": "2024-03-01T10:00:00.000Z"
    },
    {
      "id": "2",
      "rehearsalId": "1",
      "userId": "2",
      "response": "no",
      "notes": "Conflict with another commitment",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com",
      "createdAt": "2024-03-01T11:30:00.000Z",
      "updatedAt": "2024-03-01T11:30:00.000Z"
    }
  ],
  "stats": {
    "confirmed": 1,
    "declined": 1,
    "tentative": 0,
    "invited": 0
  }
}
```

**Error Responses:**
- `403 Forbidden`: User is not a project member
  ```json
  { "error": "Access denied" }
  ```
- `404 Not Found`: Rehearsal not found
  ```json
  { "error": "Rehearsal not found" }
  ```

**Notes:**
- Includes user information (name, email) for each response
- Stats object provides a summary of all responses

---

#### 7. Get Current User's Response

Retrieve the authenticated user's RSVP response for a rehearsal.

**Endpoint:** `GET /native/rehearsals/:rehearsalId/my-response`

**Authentication Required:** Yes (must be project member)

**Path Parameters:**
- `rehearsalId` (string, required): The rehearsal ID

**Success Response (200) - User has responded:**
```json
{
  "response": {
    "id": "1",
    "rehearsalId": "1",
    "userId": "1",
    "response": "yes",
    "notes": "I'll be there on time",
    "createdAt": "2024-03-01T10:00:00.000Z",
    "updatedAt": "2024-03-01T10:00:00.000Z"
  }
}
```

**Success Response (200) - User has not responded:**
```json
{
  "response": null
}
```

**Error Responses:**
- `403 Forbidden`: User is not a project member
  ```json
  { "error": "Access denied" }
  ```
- `404 Not Found`: Rehearsal not found
  ```json
  { "error": "Rehearsal not found" }
  ```

---

### Availability Endpoints

#### 1. Get User's Availability

Retrieve all availability slots for the authenticated user.

**Endpoint:** `GET /native/availability`

**Authentication Required:** Yes

**Success Response (200):**
```json
[
  {
    "id": 1,
    "startsAt": "2024-03-15T09:00:00.000Z",
    "endsAt": "2024-03-15T17:00:00.000Z",
    "type": "free",
    "title": null,
    "notes": "Available all day",
    "isAllDay": false,
    "source": "manual",
    "externalEventId": null,
    "createdAt": "2024-03-01T10:00:00.000Z"
  },
  {
    "id": 2,
    "startsAt": "2024-03-16T14:00:00.000Z",
    "endsAt": "2024-03-16T17:00:00.000Z",
    "type": "busy",
    "title": "Rehearsal",
    "notes": null,
    "isAllDay": false,
    "source": "rehearsal",
    "externalEventId": "1",
    "createdAt": "2024-03-01T10:00:00.000Z"
  }
]
```

**Response Fields:**
- `id` (number): Availability slot ID
- `startsAt` (string): ISO 8601 timestamp for slot start
- `endsAt` (string): ISO 8601 timestamp for slot end
- `type` (string): Slot type - "free", "busy", or "tentative"
- `title` (string|null): Optional title for the slot
- `notes` (string|null): Optional notes
- `isAllDay` (boolean): Whether this is an all-day event
- `source` (string): Source of the slot - "manual", "rehearsal", "google_calendar", or "apple_calendar"
- `externalEventId` (string|null): ID of the external event (e.g., rehearsal ID)
- `createdAt` (string): Creation timestamp

**Notes:**
- All timestamps are in ISO 8601 format (UTC)
- Slots are sorted by start time (ascending)
- Slots from rehearsals have `source: "rehearsal"` and reference the rehearsal ID in `externalEventId`

---

#### 2. Bulk Set Availability

Create or update multiple availability slots at once.

**Endpoint:** `POST /native/availability/bulk`

**Authentication Required:** Yes

**Request Body (New Format):**
```json
{
  "entries": [
    {
      "startsAt": "2024-03-15T09:00:00.000Z",
      "endsAt": "2024-03-15T17:00:00.000Z",
      "type": "free",
      "title": "Available for rehearsals",
      "notes": "Prefer afternoon slots",
      "isAllDay": false
    },
    {
      "startsAt": "2024-03-16T00:00:00.000Z",
      "endsAt": "2024-03-16T23:59:00.000Z",
      "type": "busy",
      "isAllDay": true
    }
  ]
}
```

**Request Body (Old Format - Backward Compatibility):**
```json
{
  "entries": [
    {
      "date": "2024-03-15",
      "type": "free",
      "slots": [
        {
          "start": "09:00",
          "end": "17:00",
          "isAllDay": false
        }
      ],
      "title": "Available for rehearsals",
      "notes": "Prefer afternoon slots"
    }
  ]
}
```

**Parameters:**
- `entries` (array, required): Array of availability entries

**Entry Parameters (New Format):**
- `startsAt` (string, required): ISO 8601 timestamp
- `endsAt` (string, required): ISO 8601 timestamp
- `type` (string, required): "free", "busy", or "tentative"
- `title` (string, optional): Slot title
- `notes` (string, optional): Additional notes
- `isAllDay` (boolean, optional): Whether this is an all-day event

**Entry Parameters (Old Format):**
- `date` (string, required): Date in YYYY-MM-DD format
- `type` (string, required): "free", "busy", or "tentative"
- `slots` (array, required): Array of time slots
  - `start` (string): Start time in HH:mm format
  - `end` (string): End time in HH:mm format
  - `isAllDay` (boolean, optional): Whether this is an all-day event
- `title` (string, optional): Slot title
- `notes` (string, optional): Additional notes

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**
- `400 Bad Request`: Invalid entries
  ```json
  { "error": "Entries array is required" }
  ```

**Notes:**
- Only affects manually-created availability (source: "manual")
- Existing manual slots in the same time ranges are deleted before inserting new ones
- Slots from rehearsals or calendar sync are preserved
- Old format converts times using the user's configured timezone

---

#### 3. Set Availability for a Specific Date

Create or update availability slots for a specific date.

**Endpoint:** `PUT /native/availability/:date`

**Authentication Required:** Yes

**Path Parameters:**
- `date` (string, required): Date in YYYY-MM-DD format

**Request Body:**
```json
{
  "type": "free",
  "slots": [
    {
      "start": "09:00",
      "end": "12:00",
      "isAllDay": false
    },
    {
      "start": "14:00",
      "end": "18:00",
      "isAllDay": false
    }
  ],
  "title": "Available for rehearsals",
  "notes": "Flexible on exact times"
}
```

**Parameters:**
- `type` (string, required): "free", "busy", or "tentative"
- `slots` (array, required): Array of time slots
  - `start` (string): Start time in HH:mm format
  - `end` (string): End time in HH:mm format
  - `isAllDay` (boolean, optional): Whether this is an all-day event
- `title` (string, optional): Slot title
- `notes` (string, optional): Additional notes

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**
- `400 Bad Request`: Missing type
  ```json
  { "error": "Type is required" }
  ```

**Notes:**
- Deletes all existing manual availability for the specified date
- Preserves rehearsal and calendar sync availability
- Times are converted using the user's configured timezone

---

#### 4. Delete Availability for a Date

Delete all manually-created availability for a specific date.

**Endpoint:** `DELETE /native/availability/:date`

**Authentication Required:** Yes

**Path Parameters:**
- `date` (string, required): Date in YYYY-MM-DD format

**Success Response (200):**
```json
{
  "success": true
}
```

**Notes:**
- Only deletes manually-created availability (source: "manual")
- Preserves rehearsal and calendar sync availability

---

### Members Endpoints

#### 1. Get Project Members

Retrieve all active members of a project.

**Endpoint:** `GET /native/projects/:projectId/members`

**Authentication Required:** Yes (must be project member)

**Path Parameters:**
- `projectId` (string, required): The project ID

**Success Response (200):**
```json
{
  "members": [
    {
      "id": "1",
      "userId": "1",
      "role": "owner",
      "characterName": "Hamlet",
      "status": "active",
      "joinedAt": "2024-01-15T10:30:00.000Z",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "avatarUrl": "https://example.com/avatar.jpg"
    },
    {
      "id": "2",
      "userId": "2",
      "role": "member",
      "characterName": "Ophelia",
      "status": "active",
      "joinedAt": "2024-01-16T14:00:00.000Z",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com",
      "avatarUrl": null
    }
  ]
}
```

**Response Fields:**
- `id` (string): Membership record ID
- `userId` (string): User ID
- `role` (string): User's role - "owner", "admin", or "member"
- `characterName` (string|null): Character name assigned to this member
- `status` (string): Membership status ("active")
- `joinedAt` (string): When the user joined the project
- `firstName` (string): User's first name
- `lastName` (string): User's last name
- `email` (string): User's email
- `avatarUrl` (string|null): User's avatar URL

**Error Responses:**
- `403 Forbidden`: User is not a project member
  ```json
  { "error": "Access denied" }
  ```

**Notes:**
- Members are sorted by role (owner, admin, member) and then by join date
- Only returns active members

---

#### 2. Get Members' Availability

Retrieve availability for project members for a specific date or date range.

**Endpoint:** `GET /native/projects/:projectId/members/availability`

**Authentication Required:** Yes (must be project member)

**Path Parameters:**
- `projectId` (string, required): The project ID

**Query Parameters (Option 1 - Single Date):**
- `date` (string, required): Date in YYYY-MM-DD format

**Query Parameters (Option 2 - Date Range):**
- `startDate` (string, required): Start date in YYYY-MM-DD format
- `endDate` (string, required): End date in YYYY-MM-DD format

**Query Parameters (Optional):**
- `userIds` (string, optional): Comma-separated list of user IDs to filter

**Example Requests:**
```
GET /native/projects/1/members/availability?date=2024-03-15
GET /native/projects/1/members/availability?startDate=2024-03-15&endDate=2024-03-21
GET /native/projects/1/members/availability?startDate=2024-03-15&endDate=2024-03-21&userIds=1,2,3
```

**Success Response (200):**
```json
{
  "availability": [
    {
      "userId": "1",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "dates": [
        {
          "date": "2024-03-15",
          "timeRanges": [
            {
              "start": "09:00",
              "end": "12:00",
              "type": "free",
              "isAllDay": false
            },
            {
              "start": "14:00",
              "end": "17:00",
              "type": "busy",
              "isAllDay": false
            }
          ]
        },
        {
          "date": "2024-03-16",
          "timeRanges": [
            {
              "start": "00:00",
              "end": "23:59",
              "type": "free",
              "isAllDay": true
            }
          ]
        }
      ]
    },
    {
      "userId": "2",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com",
      "dates": [
        {
          "date": "2024-03-15",
          "timeRanges": [
            {
              "start": "10:00",
              "end": "18:00",
              "type": "free",
              "isAllDay": false
            }
          ]
        }
      ]
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Missing required parameters
  ```json
  { "error": "Either date or both startDate and endDate are required" }
  ```
- `403 Forbidden`: User is not a project member
  ```json
  { "error": "You must be a project member to view availability" }
  ```

**Notes:**
- Time ranges are returned in each user's local timezone
- Users with no availability for the requested dates will have empty `dates` arrays
- All dates in the range are included even if no availability is set

---

### Invites Endpoints

#### 1. Create Invite Link

Create an invite link for a project.

**Endpoint:** `POST /native/projects/:projectId/invite`

**Authentication Required:** Yes (must be admin/owner)

**Path Parameters:**
- `projectId` (string, required): The project ID

**Request Body:**
```json
{
  "expiresInDays": 7
}
```

**Parameters:**
- `expiresInDays` (number, optional): Number of days until the invite expires (default: 7)

**Success Response (200):**
```json
{
  "inviteCode": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "expiresAt": "2024-03-22T10:30:00.000Z",
  "inviteUrl": "rehearsalapp://invite/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Response Fields:**
- `inviteCode` (string): The unique invite code
- `expiresAt` (string): ISO 8601 timestamp when the invite expires
- `inviteUrl` (string): Complete invite URL for sharing
  - Development: Uses custom URL scheme (`rehearsalapp://`)
  - Production: Uses HTTPS URL with Universal Links support

**Error Responses:**
- `403 Forbidden`: User is not an admin/owner
  ```json
  { "error": "Only admins can create invite links" }
  ```

**Notes:**
- If an active invite already exists for the project, the existing invite is returned
- Only one active invite can exist per project at a time
- Invite codes are 32-character hexadecimal strings

---

#### 2. Get Current Invite Link

Retrieve the current active invite link for a project.

**Endpoint:** `GET /native/projects/:projectId/invite`

**Authentication Required:** Yes (must be admin/owner)

**Path Parameters:**
- `projectId` (string, required): The project ID

**Success Response (200) - Active invite exists:**
```json
{
  "invite": {
    "inviteCode": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "expiresAt": "2024-03-22T10:30:00.000Z",
    "inviteUrl": "rehearsalapp://invite/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
  }
}
```

**Success Response (200) - No active invite:**
```json
{
  "invite": null
}
```

**Error Responses:**
- `403 Forbidden`: User is not an admin/owner
  ```json
  { "error": "Only admins can view invite links" }
  ```

---

#### 3. Revoke Invite Link

Revoke the current invite link for a project.

**Endpoint:** `DELETE /native/projects/:projectId/invite`

**Authentication Required:** Yes (must be admin/owner)

**Path Parameters:**
- `projectId` (string, required): The project ID

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**
- `403 Forbidden`: User is not an admin/owner
  ```json
  { "error": "Only admins can revoke invite links" }
  ```

**Notes:**
- After revocation, the invite code can no longer be used to join the project
- A new invite can be created after revocation

---

#### 4. Get Invite Info (Public)

Get information about an invite without authentication (for preview before joining).

**Endpoint:** `GET /native/invite/:code`

**Authentication Required:** No

**Path Parameters:**
- `code` (string, required): The invite code

**Success Response (200):**
```json
{
  "projectId": "1",
  "projectName": "Hamlet Production",
  "projectDescription": "Winter 2024 production of Hamlet",
  "expiresAt": "2024-03-22T10:30:00.000Z"
}
```

**Error Responses:**
- `404 Not Found`: Invite not found
  ```json
  { "error": "Invite not found" }
  ```
- `410 Gone`: Invite has expired
  ```json
  { "error": "Invite has expired" }
  ```

**Notes:**
- This is a public endpoint that does not require authentication
- Used to display project information before a user decides to join

---

#### 5. Join Project Using Invite

Join a project using an invite code.

**Endpoint:** `POST /native/invite/:code/join`

**Authentication Required:** Yes

**Path Parameters:**
- `code` (string, required): The invite code

**Success Response (200):**
```json
{
  "success": true,
  "projectId": "1",
  "projectName": "Hamlet Production",
  "message": "Successfully joined the project"
}
```

**Error Responses:**
- `400 Bad Request`: User is already a member
  ```json
  { "error": "You are already a member of this project" }
  ```
- `404 Not Found`: Invite not found
  ```json
  { "error": "Invite not found" }
  ```
- `410 Gone`: Invite has expired
  ```json
  { "error": "Invite has expired" }
  ```

**Notes:**
- If the user was previously a member but left, their membership is reactivated
- New members are added with the "member" role (not admin)

---

## Data Models

### User

```typescript
interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  timezone: string;              // IANA timezone (e.g., "America/New_York")
  locale: string;                // Locale code (e.g., "en")
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
  lastLoginAt: string;           // ISO 8601 timestamp
}
```

### Project

```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  timezone: string;              // IANA timezone for project
  is_admin: boolean;             // Whether current user is admin/owner
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
}
```

### Rehearsal

```typescript
interface Rehearsal {
  id: string;
  projectId: string;
  title: string | null;
  description: string | null;
  startsAt: string;              // ISO 8601 timestamp with timezone
  endsAt: string;                // ISO 8601 timestamp with timezone
  location: string | null;
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}
```

### Rehearsal Response (RSVP)

```typescript
interface RehearsalResponse {
  id: string;
  rehearsalId: string;
  userId: string;
  response: "yes" | "no" | "maybe";  // Database values
  notes: string | null;
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
  // Extended in GET responses:
  firstName?: string;
  lastName?: string;
  email?: string;
}
```

### Availability Slot

```typescript
interface AvailabilitySlot {
  id: number;
  startsAt: string;              // ISO 8601 timestamp with timezone
  endsAt: string;                // ISO 8601 timestamp with timezone
  type: "free" | "busy" | "tentative";
  title: string | null;
  notes: string | null;
  isAllDay: boolean;
  source: "manual" | "rehearsal" | "google_calendar" | "apple_calendar";
  externalEventId: string | null;  // Reference ID (e.g., rehearsal ID)
  createdAt: string;             // ISO 8601 timestamp
}
```

### Project Member

```typescript
interface ProjectMember {
  id: string;
  userId: string;
  role: "owner" | "admin" | "member";
  characterName: string | null;
  status: "active" | "inactive";
  joinedAt: string;              // ISO 8601 timestamp
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
}
```

### Member Availability Response

```typescript
interface MemberAvailability {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  dates: Array<{
    date: string;                // YYYY-MM-DD format
    timeRanges: Array<{
      start: string;             // HH:mm format (in user's timezone)
      end: string;               // HH:mm format (in user's timezone)
      type: "free" | "busy" | "tentative";
      isAllDay: boolean;
    }>;
  }>;
}
```

### Invite

```typescript
interface Invite {
  inviteCode: string;            // 32-character hex string
  expiresAt: string;             // ISO 8601 timestamp
  inviteUrl: string;             // Complete shareable URL
}
```

---

## Error Handling

### Common Error Response Format

All error responses follow this format:

```json
{
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters or body
- `401 Unauthorized` - Missing, invalid, or expired authentication token
- `403 Forbidden` - User lacks permission for the requested action
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists (e.g., email already registered)
- `410 Gone` - Resource has expired (e.g., expired invite link)
- `500 Internal Server Error` - Server error

### Common Error Scenarios

#### Authentication Errors

**Missing Token:**
```json
{
  "error": "Access token required"
}
```

**Invalid or Expired Token:**
```json
{
  "error": "Invalid or expired token"
}
```

**Solution:** Use the refresh token endpoint to obtain a new access token.

#### Authorization Errors

**User Not a Project Member:**
```json
{
  "error": "Access denied"
}
```

**User Not an Admin:**
```json
{
  "error": "Only admins can create rehearsals"
}
```

#### Validation Errors

**Missing Required Field:**
```json
{
  "error": "Email, password and first name are required"
}
```

**Invalid Data Format:**
```json
{
  "error": "Invalid date format"
}
```

---

## Timezone Handling

The API uses comprehensive timezone support to ensure accurate time representation across different locations.

### Storage Format

**Database:**
- All timestamps are stored as PostgreSQL `TIMESTAMPTZ` (timestamp with timezone) columns
- PostgreSQL automatically stores timestamps in UTC internally
- Timezone conversion happens at query time

**API Communication:**
- All timestamps in API requests and responses use ISO 8601 format with timezone information
- Format: `YYYY-MM-DDTHH:mm:ss.sssZ` or `YYYY-MM-DDTHH:mm:ss.sss±HH:mm`
- Examples:
  - `2024-03-15T14:00:00.000Z` (UTC)
  - `2024-03-15T16:00:00.000+02:00` (UTC+2)

### Timezone Settings

**User Timezone:**
- Each user has a `timezone` setting (IANA timezone identifier)
- Default: `"Asia/Jerusalem"`
- Used for converting timestamps to user's local time in availability queries
- Examples: `"America/New_York"`, `"Europe/London"`, `"Asia/Tokyo"`

**Project Timezone:**
- Each project has a `timezone` setting
- Used for rehearsal scheduling when using legacy date/time format
- Default: `"Asia/Jerusalem"`

### Timestamp Conversion

**Client to Server:**
1. Client sends ISO 8601 timestamp with timezone: `"2024-03-15T14:00:00.000Z"`
2. Server accepts the timestamp as-is and stores it with timezone information
3. PostgreSQL converts to UTC for storage

**Server to Client:**
1. PostgreSQL retrieves timestamp in UTC
2. Server converts to ISO 8601 string: `timestampToISO(dbTimestamp)`
3. Client receives: `"2024-03-15T14:00:00.000Z"`
4. Client converts to local timezone for display

### Legacy Format Support

The API supports both new (ISO timestamps) and old (date + time) formats for backward compatibility:

**New Format (Recommended):**
```json
{
  "startsAt": "2024-03-15T14:00:00.000Z",
  "endsAt": "2024-03-15T17:00:00.000Z"
}
```

**Old Format (Deprecated):**
```json
{
  "date": "2024-03-15",
  "startTime": "14:00",
  "endTime": "17:00"
}
```

When using the old format:
- Times are interpreted in the project's or user's timezone
- Server converts to ISO timestamp using: `localToTimestamp(date, time, timezone)`

### All-Day Events

All-day events are stored with special handling:

```typescript
{
  "isAllDay": true,
  "startsAt": "2024-03-15T00:00:00.000Z",
  "endsAt": "2024-03-15T23:59:00.000Z"
}
```

- Stored as full day in UTC (00:00:00 to 23:59:00)
- The `isAllDay` flag indicates how to display in the UI
- Client should display as an all-day event without showing specific times

### Best Practices

1. **Always use ISO 8601 format** for timestamps in API requests
2. **Include timezone information** in all timestamps (use `.toISOString()` in JavaScript)
3. **Store user's timezone** preference and use it for display purposes
4. **Validate timezone identifiers** against IANA timezone database
5. **Handle DST transitions** properly (automatic with IANA timezones)
6. **Use the new format** (startsAt/endsAt) instead of the legacy format

### Example: Creating a Rehearsal

```javascript
// JavaScript example using the user's local time
const localDate = new Date('2024-03-15T14:00:00'); // User's local: 2PM
const startISO = localDate.toISOString(); // "2024-03-15T12:00:00.000Z" (UTC)

await fetch('/api/native/projects/1/rehearsals', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    startsAt: startISO,
    endsAt: new Date('2024-03-15T17:00:00').toISOString(),
    location: 'Main Theatre'
  })
});
```

### Example: Displaying a Rehearsal

```javascript
// JavaScript example converting UTC to user's local time
const response = await fetch('/api/native/projects/1/rehearsals');
const data = await response.json();

data.rehearsals.forEach(rehearsal => {
  // Parse ISO string and convert to local
  const localStart = new Date(rehearsal.startsAt);
  console.log(localStart.toLocaleString()); // Displays in user's timezone
});
```

---

## Rate Limiting

Currently, the API does not enforce rate limiting. This may be added in future versions.

---

## Versioning

The API is currently at version 1.0. Future versions may introduce:
- API version prefix (e.g., `/api/v2/...`)
- Backward compatibility guarantees
- Deprecation notices

---

## Support

For issues, questions, or feature requests, please contact the development team.

---

**Last Updated:** 2024-12-11

**API Version:** 1.0
