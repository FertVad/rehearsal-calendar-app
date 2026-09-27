# Rehearsal Calendar Native App - API Documentation

## Overview

The Rehearsal Calendar Native App API is a RESTful API built for managing theater rehearsal schedules. It provides comprehensive functionality for user authentication, project management, rehearsal scheduling, availability tracking, member management, and project invitations.

**Base URL:**
- Production: `https://server-fertvads-projects.vercel.app/api`
- Development: `http://localhost:3001/api`

**API Version:** 1.0

**Response Format:** JSON

## Authentication

The API uses JWT (JSON Web Token) based authentication with separate access and refresh tokens.

### Token Lifecycle

- **Access Token**: Used for API requests; default lifetime 30 days (`JWT_EXPIRES_IN`).
- **Refresh Token**: Used to obtain a new pair; default lifetime 90 days (`REFRESH_TOKEN_EXPIRES_IN`).

Each setting accepts a positive integer followed by `s`, `m`, `h` or `d`, such as
`15m` or `7d`. Outer whitespace is trimmed. Defaults apply only to absent variables;
blank values, bare numbers, fractional/negative durations and integer overflow are
configuration errors. Refresh must outlive access because the current client
renews after an expired access token receives 401. Invalid configuration stops
application initialization before authentication handlers can write data.

The process captures these settings at startup; a change requires a restart/new
deployment. Every new pair, including a refresh response, uses the configured
lifetimes. Previously issued tokens retain their own signed expiration and the
existing token-version revocation checks. Changing TTL does not revoke sessions
or impose an absolute session lifetime. Admin tokens keep their separate policy.

### How to Authenticate Requests

Include the access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

A token whose version was revoked answers `401`. A token of an account whose
address is still pending answers `403 { "code": "EMAIL_NOT_VERIFIED" }` on every
route: no route issues one, and should one exist it reaches nothing.

The version is checked before the handler runs. Handlers that change credentials
or the account itself — `PUT /auth/me`, `DELETE /auth/me`, `POST /auth/logout`,
unlinking a provider, registering a push device — check it again under the
account's row lock, so a request admitted just before a revocation changes
nothing after it.

### Token Refresh Flow

When an access token expires (401 error), use the refresh token to obtain a new access token pair via the `/auth/refresh` endpoint.

### Apple Sign-In

`POST /auth/apple` accepts a nonempty string `idToken` and optional first-login
`user` name data. The server verifies the token's RS256 signature, Apple issuer,
expiration and exact intended audience before account lookup or token issuance.
`APPLE_CLIENT_ID` must explicitly name the single native/service audience being
offered. Outer whitespace is trimmed; an empty value or embedded whitespace/list
syntax disables Apple login. No audience is inferred from the submitted token.

| Response | Meaning |
|---|---|
| 200 | Verified Apple identity; user/accessToken/refreshToken/isNewUser/linked/passwordRevoked response |
| 400 | Missing, blank or non-string idToken; `PROVIDER_EMAIL_REQUIRED` or `PROVIDER_EMAIL_UNVERIFIED` (below) |
| 401 | Token verification failed, including a different audience |
| 403 | `EMAIL_NOT_VERIFIED`: the linked account is a pending registration and Apple proved nothing |
| 503 | Apple sign-in is unavailable because provider configuration is missing or invalid |
| 500 | Internal failure after verification, including account storage failure |

Rejections do not return token claims or internal verifier details. An unavailable
Apple provider does not stop the other application routes. Verify the expected
audience against the **active deployment** before offering Apple login; successful
server startup alone does not confirm it.

### Google and Apple: what the provider's address settles

`POST /auth/google` and `POST /auth/apple` decide the account in one locked
transaction. The provider's address counts as proof only when the provider says
it is verified; it is trimmed and lower-cased like every other address.

- **Already linked provider**: signs in to that account — for Apple even when the
  token carries no address. Google refuses a token whose address it has not
  verified, linked or not (`400 PROVIDER_EMAIL_UNVERIFIED`), as it did before.
- **Not linked**: a proven address joins the account that has it (`linked: true`)
  or creates one (`isNewUser: true`). Without an address, or with one the provider
  did not verify, nothing is joined or created: `400 PROVIDER_EMAIL_REQUIRED` /
  `PROVIDER_EMAIL_UNVERIFIED` (Google answers the latter before any lookup).
- **Proof for an account whose address nobody had proven** — a pending
  registration, or an account from before email confirmation, linked now or long
  ago: the address becomes verified by the provider, and whatever got in before
  it goes — every session, live code and registered push device (they register
  again on the next launch). A password on that account was never proven to be
  the owner's, so it is removed too, and the response says `passwordRevoked: true`. The app
  is to tell the person and offer a password reset (`POST
  /auth/password-reset/request`); the client part is a later item. The person can
  also set a first password in the profile, the address being verified now. A confirmed account is only linked.
- **Pending account without proof** (a linked provider whose token carries no
  address): `403 EMAIL_NOT_VERIFIED`, no tokens.

---

## Endpoints

### Authentication Endpoints

#### 1. Register New User

Create an account whose address is not yet confirmed. No session is issued:
the emailed six-digit code, entered with the same password through
`POST /auth/verify-email`, is what signs the person in.

**Endpoint:** `POST /auth/register`

**Authentication Required:** No

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "timezone": "Europe/Berlin",
  "locale": "de",
  "verification": "code"
}
```

**Parameters:**
- `email` (string, required): trimmed and lower-cased before it is stored or compared
- `password` (string, required): at least 8 characters, at most 72 bytes
- `firstName` (string, required), `lastName` (string, optional): up to 100 characters
- `timezone` (string, optional): a named IANA zone; offsets such as `+02:00` are refused
- `locale` (string, optional): `en`, `ru`, `es` or `de` — the language of the code email; default `en`
- `verification` (string, required): `"code"`. An app from before email confirmation does not send it and is told to update.

**Success Response (201):**
```json
{ "status": "verification_required", "email": "user@example.com", "delivery": "sent" }
```
`delivery` is `sent` (the provider accepted the email), `failed` (it refused)
or `unknown` (no answer — the email may still arrive). The account exists in
every case; the app offers to resend.

**Error Responses:**
- `400 Bad Request`: `{ "error": "...", "code": "CLIENT_UPGRADE_REQUIRED" }` without `verification`,
  before anything is written; otherwise a field error `{ "error", "code", "field" }` —
  `EMAIL_INVALID`, `PASSWORD_POLICY`, `NAME_INVALID`, `TEXT_INVALID`, `TIMEZONE_INVALID`, `LOCALE_INVALID`
- `409 Conflict`: `{ "error": "An account with this email already exists", "code": "EMAIL_TAKEN" }`, whatever the case typed.
  The app turns the code into its own "sign in or reset the password" in the person's language.
- `503 Service Unavailable`: `{ "error": "Email is not available right now", "code": "EMAIL_UNAVAILABLE" }` —
  no email can be sent, so no account is created
- `500 Internal Server Error`: `{ "error": "Failed to register user" }`

---

#### 1a. Confirm Email Address

Enter the emailed code. Works for a pending registration and for an account from
before email confirmation, whose address was never proven.

**Endpoint:** `POST /auth/verify-email`

**Authentication Required:** No (the password is part of the request)

**Request Body:**
```json
{ "email": "user@example.com", "password": "securePassword123", "code": "123456" }
```

**Success Response (200):** the same body as login — `user`, `accessToken`, `refreshToken`.

**Error Responses:**
- `401 Unauthorized`: `{ "error": "Invalid email or password" }` — the code is not looked at, and no attempt is spent
- `400 Bad Request`: `{ "error": "The code is not valid", "code": "CODE_INVALID" }` — a wrong code, one of five attempts;
  `CODE_LOCKED` on the fifth, `CODE_EXPIRED` after 15 minutes, `CODE_MISSING` when there is no live code
- `409 Conflict`: `{ "error": "This address is already confirmed", "code": "ALREADY_VERIFIED" }`

---

#### 1b. Resend Confirmation Code

Replace the code with a new one; the previous code stops working.

**Endpoint:** `POST /auth/verify-email/resend`

**Authentication Required:** No (the password is part of the request)

**Request Body:**
```json
{ "email": "user@example.com", "password": "securePassword123" }
```

**Success Response (202):**
```json
{ "status": "code_sent", "delivery": "sent" }
```

**Error Responses:**
- `401 Unauthorized`: `{ "error": "Invalid email or password" }`
- `409 Conflict`: `ALREADY_VERIFIED`
- `429 Too Many Requests`: `{ "error": "Wait before asking for another code", "code": "RATE_LIMITED", "retryAfter": 42 }` —
  one code a minute, five an hour
- `503 Service Unavailable`: `EMAIL_UNAVAILABLE`

---

#### 1c. Request a Password Reset

Email a six-digit code for setting a new password.

**Endpoint:** `POST /auth/password-reset/request`

**Authentication Required:** No

**Request Body:**
```json
{ "email": "user@example.com" }
```

**Response (202):** `{ "status": "reset_requested" }` — the same status and body
whether or not the address has an account, whether or not the email went out,
and when a code was already sent less than a minute ago (then nothing is sent).
There is no `delivery` field: it would tell which addresses have an account. The
response time is not made equal: the email is sent, and waited for, only when
the address has an account.

**Error Responses:**
- `400 Bad Request`: `EMAIL_INVALID`
- `503 Service Unavailable`: `EMAIL_UNAVAILABLE`, before the address is looked at

---

#### 1d. Reset the Password

Set a new password with the emailed code and sign in.

**Endpoint:** `POST /auth/password-reset/confirm`

**Authentication Required:** No

**Request Body:**
```json
{ "email": "user@example.com", "code": "123456", "newPassword": "newSecurePassword123" }
```

**Success Response (200):** the same body as login — `user`, `accessToken`, `refreshToken`.

The code proves the mailbox, so the reset also settles who owns the address:
every other session, live code and push device of the account is revoked, the
address becomes verified, and the new password replaces any old one. This is how
the owner of a mailbox takes back an account someone else registered with it.

**Error Responses:**
- `400 Bad Request`: `PASSWORD_POLICY` (`field: newPassword`) or `EMAIL_INVALID`,
  before the code is looked at; `CODE_INVALID` (one of five attempts),
  `CODE_LOCKED`, `CODE_EXPIRED`, `CODE_MISSING` — an address without an account
  answers `CODE_MISSING` as well, so after a request an expired code tells an
  account from none. Existence is not hidden further: registration answers 409
  for a taken address anyway

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
- `403 Forbidden`: the password is right but the account is a registration whose code
  was never entered (pending); no tokens. Answered only after the right password, so
  it tells a stranger nothing. An account from before email confirmation has no
  pending state and signs in as it always did, though its address was never proven.
  ```json
  { "error": "Confirm your email address first", "code": "EMAIL_NOT_VERIFIED", "email": "user@example.com" }
  ```
- `500 Internal Server Error`: Server error
  ```json
  { "error": "Failed to login" }
  ```

The email is trimmed and lower-cased before it is looked up.

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
- `403 Forbidden`: `{ "error": "Confirm your email address first", "code": "EMAIL_NOT_VERIFIED" }` —
  a token of an account whose address is pending is not renewed

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

Update the authenticated user's profile, or their password.

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
  "weekStartDay": "monday",
  "onboardingCompleted": true,
  "currentPassword": "oldSecurePassword123",
  "password": "newSecurePassword123"
}
```

**Parameters (all optional):**
- `firstName` (string): 1–100 characters
- `lastName` (string or null): up to 100 characters; `""` or `null` clears it
- `phone` (string or null): up to 50 characters
- `timezone` (string): a named IANA zone (e.g. "America/New_York"); offsets are refused
- `locale` (string): `en`, `ru`, `es` or `de`
- `notificationsEnabled`, `emailNotifications`, `onboardingCompleted` (boolean)
- `weekStartDay` (string): `monday` or `sunday`
- `password` (string): 8 characters to 72 bytes. When the account has a password,
  `currentPassword` must prove it. An account without one (Google/Apple only) may
  set its first only once its address is verified.
- `email`: only the current address is accepted; changing it needs a confirmed
  new address — `POST /auth/me/email/change` — and is refused here.

**Success Response (200):**
```json
{ "user": { "id": 1, "email": "user@example.com", "firstName": "Jane", "lastName": "Smith" } }
```
After a password change the response also carries `accessToken` and
`refreshToken`: every other session of the account is revoked, this device keeps
signing in.

**Error Responses:**
- `400 Bad Request`: a field error `{ "error", "code", "field" }` (`NAME_INVALID`,
  `TEXT_INVALID`, `TIMEZONE_INVALID`, `LOCALE_INVALID`, `BOOLEAN_REQUIRED`,
  `WEEK_START_INVALID`, `PASSWORD_POLICY`); `EMAIL_CHANGE_REQUIRES_VERIFICATION`;
  `{ "error": "No fields to update" }`
- `401 Unauthorized`: invalid or missing token, or `Session revoked` — also when the
  revocation committed while this request was already under way; nothing is written
- `403 Forbidden`: `CURRENT_PASSWORD_INVALID` (`field: currentPassword`);
  `EMAIL_NOT_VERIFIED` (`field: password`) for a first password on an address
  nobody has proven

---

#### 5a. Change the Sign-in Address

Two steps. The first sends a code to the current address and a code to the new
one; the second moves the account with both.

**Endpoint:** `POST /auth/me/email/change`

**Authentication Required:** Yes

**Request Body:**
```json
{ "newEmail": "new@example.com", "currentPassword": "securePassword123" }
```
A session alone does not move an account, and neither does a password: a session
can set a first password in the profile and unlink Google or Apple. Every change
therefore needs the code sent to the **current** address; `currentPassword` is
asked for as well when the account has a password.

**Response (202):**
```json
{ "status": "codes_sent", "delivery": { "newAddress": "sent", "currentAddress": "sent" } }
```
`delivery` values are `sent`, `failed`, `unknown` (see registration).

**Error Responses:**
- `400 Bad Request`: `EMAIL_INVALID`, `EMAIL_UNCHANGED` (`field: newEmail`)
- `401 Unauthorized`: invalid token, or `Session revoked`
- `403 Forbidden`: `CURRENT_PASSWORD_INVALID` (`field: currentPassword`)
- `409 Conflict`: `EMAIL_TAKEN`
- `429 Too Many Requests`: `RATE_LIMITED` with `retryAfter` — one pair a minute, five an hour
- `503 Service Unavailable`: `EMAIL_UNAVAILABLE`, before anything is written

**Endpoint:** `POST /auth/me/email/change/confirm`

**Request Body:**
```json
{ "code": "123456", "currentCode": "654321" }
```
`code` came to the new address, `currentCode` to the current one. The new address
is the one the latest request named.

**Success Response (200):** `user` with the new address, `accessToken`,
`refreshToken`. The address, its verification and the password sign-in method
change together; every other session and every live code of the account is
revoked. The old address is sent a notice; its delivery is not guaranteed and
does not affect the change. Push devices stay: the change was confirmed from the
current mailbox.

**Error Responses:**
- `400 Bad Request`: `CODE_INVALID`, `CODE_LOCKED`, `CODE_EXPIRED`, `CODE_MISSING`,
  with `field: code` or `field: currentCode`. Both codes are checked before either
  is spent: a wrong one counts its attempt, a right one stays usable
- `401 Unauthorized`: `Session revoked` — also when another confirmation moved the
  account while this one waited
- `409 Conflict`: `EMAIL_TAKEN` — the address was registered meanwhile; the account
  keeps its old one

---

#### 6. Delete Account

Permanently delete the authenticated user's account.

**Endpoint:** `DELETE /auth/me`

**Authentication Required:** Yes

**Success Response (200):**
```json
{
  "message": "Account deleted successfully",
  "deletedProjects": 0
}
```

**Error Responses:**
- `401 Unauthorized`: invalid or missing token, or `Session revoked` — also when the
  revocation committed while this request was already under way; nothing is deleted
- `500 Internal Server Error`: Server error

**Notes:**
- This action is irreversible
- All user data and project memberships will be deleted

`POST /auth/logout` revokes every session of the account. A session revoked while
its logout was under way changes nothing more: bumping the version again would
sign out whoever revoked it. `DELETE /auth/me/providers/:provider` answers `401
Session revoked` in the same case and leaves the link.

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
      "inviteCode": "K7M3XQ2P",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "2",
      "name": "Romeo and Juliet",
      "description": "",
      "timezone": "America/New_York",
      "is_admin": false,
      "inviteCode": null,
      "created_at": "2024-02-01T14:00:00.000Z",
      "updated_at": "2024-02-01T14:00:00.000Z"
    }
  ]
}
```

**Notes:**
- Only returns projects where the user has an active membership
- `is_admin` indicates whether the user is an owner or admin of the project
- `inviteCode` carries the live invite so a list of projects can offer it
  without a request per card. It is `null` for anyone who is not an admin and
  for invites that have expired — the code is a way into the project, and a
  plain member handing it out is not something the owner agreed to
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
- `participant_ids` (array, optional): The people on the rehearsal — user ids,
  as numbers or digit strings, each counted once. Every one must be an active
  member of the project, or the whole request is refused before anything is
  written (at most 500).

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
- `400 Bad Request`, `code: "PARTICIPANTS_INVALID"`: `participant_ids` is not a list of user ids
- `400 Bad Request`, `code: "NOT_PROJECT_MEMBERS"`: someone on the list is not an active member of the project; nothing is written
  ```json
  { "error": "Participants must be active members of the project", "code": "NOT_PROJECT_MEMBERS", "userIds": [42] }
  ```
- `403 Forbidden`: User is not an admin/owner
  ```json
  { "error": "Only admins can create rehearsals" }
  ```

**Notes:**
- Everyone on `participant_ids` is invited and has not seen it yet (`response: "no"`); each of them gets a busy availability slot for its time
- Who is on a rehearsal is decided in one place, `server/services/rehearsals/roster.js`
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
Same as Create Rehearsal (supports both new and old formats). `participant_ids`
left out keeps the roster as it is; `[]` clears it; a list makes it exactly
that list — those who stay keep their answers, newcomers are added as `"no"`.

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
- `400 Bad Request`, `code: "PARTICIPANTS_INVALID"`: `participant_ids` is not a list of user ids
- `400 Bad Request`, `code: "NOT_PROJECT_MEMBERS"`: someone on the list is not an active member of the project; nothing is written
  ```json
  { "error": "Participants must be active members of the project", "code": "NOT_PROJECT_MEMBERS", "userIds": [42] }
  ```
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

#### 5. Mark Seen/Unseen Rehearsal

The eye toggle: marks a rehearsal seen or not yet seen. Only someone already on
the rehearsal can answer, and answering never changes who is on it
(`server/services/rehearsals/roster.js`).

**Endpoint:** `POST /native/rehearsals/:rehearsalId/respond`

**Authentication Required:** Yes — the caller must be on the rehearsal

**Path Parameters:**
- `rehearsalId` (string, required): The rehearsal ID

**Request Body:**
```json
{ "response": "yes" }
```

**Parameters:**
- `response` (string, required): `"yes"` — seen; `"no"` — invited and not yet seen
- `notes` (string, optional)

**Success Response (200):** the rehearsal's counts, over the people on it who
are still active members of the project
```json
{ "confirmed": 5, "invited": 8 }
```

**Error Responses:**
- `400 Bad Request`, `code: "RESPONSE_INVALID"`: `response` is neither `"yes"` nor `"no"`
- `403 Forbidden`, `code: "NOT_ON_REHEARSAL"`: the caller may see the rehearsal (an admin of its project) but is not on it; nothing is written
- `404 Not Found`: the rehearsal does not exist, or the caller may not see it — the two are indistinguishable

**Notes:**
- The caller's row is updated, never created or deleted. Having a row is what puts someone on a rehearsal, and only an admin's edit changes that — an answer used to create one, so anyone in the project could put themselves on a rehearsal by knowing its id
- `"no"` is not a decline: it means invited and not yet seen
- The project's admins get a push when someone marks a rehearsal seen

---

#### 6. Get All Responses for Rehearsal

Retrieve the people on a rehearsal with their answers.

**Endpoint:** `GET /native/rehearsals/:rehearsalId/responses`

**Authentication Required:** Yes — the caller must be able to see the
rehearsal: an admin of its project, or someone on it. Anyone else gets `404`,
as for a rehearsal that does not exist. Lists only people who are still active
members of the project.

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
    "invited": 1
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
- Stats: `confirmed` is how many said 'yes', `invited` is how many are on this
  rehearsal — not how many are in the project. Every path that reports the
  counter divides by the same thing
- The seen system is binary - users either have 'yes' response or no response at all

---

#### 7. Get Current User's Response

Retrieve the authenticated user's answer on a rehearsal.

**Endpoint:** `GET /native/rehearsals/:rehearsalId/my-response`

**Authentication Required:** Yes — the caller must be able to see the
rehearsal (an admin of its project, or someone on it); anyone else gets `404`

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

**Success Response (200) - an admin who is not on the rehearsal:**
```json
{
  "response": null
}
```

**Error Responses:**
- `404 Not Found`: the rehearsal does not exist, or the caller may not see it
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

#### 2. Save Days (the editor)

Replace the hand-entered availability of the days named — the days the person
changed — each with exactly the entries given; `[]` clears a day. Days not
named are not touched, so a day loaded earlier on one device never overwrites
what another device saved since. The whole request is checked before anything
is written, and one person's saves run one at a time.

**Endpoint:** `PUT /native/availability/days`

**Authentication Required:** Yes

**Request Body:**
```json
{
  "days": [
    { "date": "2026-10-01", "entries": [
      { "startsAt": "2026-10-01T13:00:00+02:00", "endsAt": "2026-10-01T15:00:00+02:00", "type": "busy", "isAllDay": false }
    ] },
    { "date": "2026-10-02", "entries": [
      { "startsAt": "2026-10-02T00:00:00.000Z", "endsAt": "2026-10-02T23:59:59.999Z", "type": "available", "isAllDay": true }
    ] },
    { "date": "2026-10-03", "entries": [] }
  ]
}
```

**Parameters:**
- `days` (array, 1–366): each `date` a real calendar date (`YYYY-MM-DD`), named once
- `entries` (array, at most 48 per day), each:
  - `type`: `"available"` or `"busy"`
  - `isAllDay` (boolean, default `false`): a whole day is sent as that date's UTC bounds, `T00:00:00.000Z`–`T23:59:59.999Z`
  - `startsAt`, `endsAt`: for a timed slot, local time with its offset (or UTC); the start falls on `date`, the end after the start and at most a day later (through midnight is allowed)

**Success Response (200):**
```json
{ "success": true, "days": ["2026-10-01", "2026-10-02", "2026-10-03"] }
```

**Error Responses:**
- `400 Bad Request`, `code: "AVAILABILITY_INVALID"`, with a `reason` (`END_NOT_AFTER_START`, `NOT_ON_THIS_DAY`, `DATE_INVALID`, `DATE_REPEATED`, …) and where it was found (`date`, `index`); nothing is written

**Notes:**
- Only hand-entered rows are replaced; rehearsal and imported rows on the same day stay
- The app sends only days with unsaved edits, and keeps an edit made while a save was out as unsaved

---

#### 2a. Bulk Set Availability

Used by app versions from before `PUT /days` and before the import sync (4).
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
- Every date named by a manual entry has all its manual slots deleted before the new ones go in — the whole day, not only the matching hours
- Slots from rehearsals or calendar sync are preserved
- Runs behind the same per-person lock as `PUT /days`
- Hand-entered entries (no `source`, or `"manual"`) are checked by the rules of `PUT /days` before anything is deleted, on the day their start names: `400 AVAILABILITY_INVALID`, nothing written. `source` may only be `"manual"`, `"apple_calendar"` or `"google_calendar"` (`reason: "SOURCE_INVALID"` otherwise)
- Old format converts times using the user's configured timezone

---

#### 3. Delete Availability for a Date

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

#### 4. Sync Imported Calendar Events

One device's calendar import, reconciled on the server within the calendars
that device names, in one transaction. Calendar ids are the device's own, so
calendars the device does not name — other devices' — are never touched.

**Endpoint:** `POST /native/availability/imported/sync`

**Authentication Required:** Yes

**Request Body** (up to 2 MB; every other route keeps the default 100 KB):
```json
{
  "source": "apple_calendar",
  "window": { "from": "2026-10-01T00:00:00.000Z", "to": "2027-10-01T00:00:00.000Z" },
  "deviceCalendars": ["work-id", "home-id", "holidays-id"],
  "unreadable": ["home-id"],
  "calendars": [
    { "calendarId": "work-id", "events": [
      { "key": "E57AB294", "startsAt": "2026-10-02T09:00:00.000Z", "endsAt": "2026-10-02T10:00:00.000Z", "isAllDay": false }
    ] }
  ]
}
```

**Parameters:**
- `source`: `"apple_calendar"` or `"google_calendar"`
- `window`: the span read, at most 400 days
- `deviceCalendars` (1–100): every calendar on the device; ids without `|`
- `unreadable`: calendars of the device that could not be read — their rows are kept
- `calendars`: each calendar read, from `deviceCalendars`, not in `unreadable`, named once; its `events` (at most 5000 in all), each with a `key` unique in its calendar (1–512 chars), times with an offset, the end after the start

**What happens:**
- a calendar read becomes exactly its events inside the window; rows outside the window stay
- a calendar in `unreadable` keeps its rows
- a calendar in `deviceCalendars` that is neither read nor unreadable — no longer chosen on this device — is cleared
- rows are stored under `cal:<calendarId>|<key>`; a row from before, with a plain key sent now for a calendar read, is taken into that calendar

**Success Response (200):**
```json
{ "success": true, "added": 1, "updated": 0, "removed": 0, "adopted": 0, "unchanged": 4, "held": 5 }
```
`held` — the rows this device's calendars hold after the sync.

**Error Responses:**
- `400 Bad Request`, `code: "IMPORT_INVALID"`, with a `reason` (`SOURCE_INVALID`, `WINDOW_INVALID`, `DEVICE_CALENDARS_INVALID`, `CALENDAR_INVALID`, `KEY_REPEATED`, `TIME_INVALID`, `TOO_MANY_EVENTS`, …) and where (`calendarId`, `index`); nothing is written

**Related:**
- `DELETE /native/availability/imported/all` — every imported row of the person, from every device: `{ "success": true, "deletedCount": 7 }`
- `DELETE` and `PUT /native/availability/imported/batch` — kept for app versions from before the sync; they reach only rows with a plain key, never a `cal:` one

---

### Calendar Export Mappings

One mapping per connection, and a connection is one calendar of one device.
Only the two deletes are described here; both name the device's calendars, and
only mappings recorded under them go.

- `DELETE /native/calendar-sync/mappings/by-event/:eventType/:internalEventId`,
  body `{ "deviceCalendarIds": ["work-id", "home-id"] }`. Without the field — app
  versions from before — every connection of the person is reached, as before.
- `DELETE /native/calendar-sync/mappings`, body
  `{ "eventType": "rehearsal", "deviceCalendarIds": [...] }`, both required:
  `{ "success": true, "deletedCount": 2 }`.
- `deviceCalendarIds`: 1–100 non-empty strings; otherwise
  `400 DEVICE_CALENDARS_INVALID`, nothing deleted.

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
  "inviteCode": "K7M3XQ2P",
  "expiresAt": "2026-08-29T10:30:00.000Z",
  "inviteUrl": "https://rehearsly.me/invite/K7M3XQ2P"
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
- If a live invite already exists it is reused, so the link stays stable —
  unless it predates the short codes, in which case it is replaced
- Only one active invite can exist per project at a time
- Codes are 8 characters of Crockford base32 with the misreadable ones removed
  (no `I`, `L`, `O`, `U`, `0`, `1`), short enough to read aloud. Older codes are
  32 hexadecimal characters and still resolve — lookup is an exact match
- Invite preview and redemption share 20 requests per database-clock minute
  per IP (IPv6 uses a /56 subnet). Redemption also has a shared 20/minute
  authenticated-account budget. The legacy `/native/projects/:code/join`
  address consumes the same budgets; changing paths or codes does not reset them.

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
    "inviteCode": "K7M3XQ2P",
    "expiresAt": "2026-08-29T10:30:00.000Z",
    "inviteUrl": "https://rehearsly.me/invite/K7M3XQ2P"
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

### Rehearsal Response (Seen System)

```typescript
interface RehearsalResponse {
  id: string;
  rehearsalId: string;
  userId: string;
  response: "yes" | null;        // Binary seen system: 'yes' (seen) or null (unseen/deleted)
  notes: string | null;
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
  // Extended in GET responses:
  firstName?: string;
  lastName?: string;
  email?: string;
}
```

**Seen System Notes:**
- Binary system: only 'yes' (seen) or null (unseen/deleted)
- No 'no' or 'maybe' statuses
- Sending null deletes the response record
- Client uses optimistic updates with eye icon toggle

### Availability Slot

```typescript
interface AvailabilitySlot {
  id: number;
  startsAt: string;              // ISO 8601 timestamp with timezone
  endsAt: string;                // ISO 8601 timestamp with timezone
  type: "available" | "busy" | "tentative";
  title: string | null;
  notes: string | null;
  isAllDay: boolean;
  source: "manual" | "rehearsal" | "google_calendar" | "apple_calendar";
  externalEventId: string | null;  // Reference ID (e.g., rehearsal ID)
  createdAt: string;             // ISO 8601 timestamp
}
```

**Type Usage:**
- `"available"` - User is free
- `"busy"` - User is occupied (used in custom mode and for rehearsals)
- `"tentative"` - Used for imported calendar events (e.g., from Google Calendar, Apple Calendar)

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

Invite preview (`GET`/`HEAD /native/invite/:code`) and redemption
(`POST /native/invite/:code/join`, including the legacy
`POST /native/projects/:code/join`) share a database-backed 20/minute IP budget.
Authenticated redemption additionally consumes a 20/minute account budget across
all source IPs. Responses use `429` with `Retry-After` in seconds; unavailable or
full rate storage returns `503` before looking up a code or changing membership.
These counters use fixed database-clock minutes, not a rolling window.

Admin invite management (`GET`/`POST`/`DELETE /native/projects/:projectId/invite`)
is a separate operation protected by the active admin/owner policy. The old
`/native/invite/:projectId/invite` management aliases retain the same policy.
The HTML `/invite/:code` app-opening page does not perform an invite lookup.

All methods under `/api/auth` share 20 requests per IP per 60 seconds; all
methods under `/admin/api/login` share 5 per IP per 900 seconds. These two
budgets persist in PostgreSQL across application instances and restarts. Their
windows are anchored to the first admission using database time at whole-second
precision, unlike the calendar-minute invite budgets above. Successful and
unsuccessful requests both count. Parser/CORS rejections before these mounts
retain their existing behavior and do not spend these budgets.

Exhaustion returns the existing JSON `429` messages, `Retry-After` in seconds,
and `RateLimit-Policy`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
Unavailable/full storage or an invalid IP returns generic `503` before account
lookup, password/OAuth verification or token issuance. Responses through these
budgets use `Cache-Control: no-store`. Public HTML/health and authenticated admin
dashboard reads are outside these two budgets. Runtime initialization and
readiness are described in the [server runtime contract](server-runtime.md).

Each namespace retains at most 10,000 HMAC IP identities, with at most 64 expired
rows pruned during allocation and no scheduled cleanup. Active identities are
never evicted to admit a new one; existing identities can still spend their
own quota at capacity. IPv4-mapped aliases share an IPv4 identity; IPv6 uses a
canonical /56. Instances must use the same stable signing secret and shared
database, behind the configured single trusted ingress. Rotating the secret
changes IP identities. Raw IPs are not persisted in these budget tables.

Migration009 must precede any separately approved server deployment. Production
admission requires PostgreSQL and cannot silently fall back to SQLite. Local
SQLite fixtures are supported for sequential contracts; exact distributed
concurrency is tested with disposable PostgreSQL. A three-second HTTP admission
deadline and transaction-scoped SQL/lock timeouts deny access on stalled work.
The PostgreSQL adapter bounds pool acquisition to two seconds and removes timed-out
waiters. The HTTP deadline does not cancel already-acquired SQL: a late operation
may conservatively spend budget after `503`, but never invokes the handler or
retries/refunds the mutation.

Member availability retains its separate shared 60/minute/account budget and
request-size limits. These operation budgets are not a general ingress limit.

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

**Last Updated:** 2026-09-19

**API Version:** 1.2

**Recent Changes:**
- v1.2 (2026-02-19): Renamed "like system" to "seen system" (eye icon toggle), i18n updates
- v1.1 (2024-12-24): Like→seen system migration, token TTL increased, availability type fixes
- v1.0 (2024-12-11): Initial API release
