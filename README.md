# express-songs

Express backend for the song/tab management app. Handles authentication, song data, guitar tabs, and associated YouTube videos — all scoped to the authenticated user.

## What the app does

Users log in with Google OAuth. Once authenticated, they can:

- Store songs with a title and artist
- Attach guitar tab text to each song, with an optional auto-scroll speed
- Attach up to 5 YouTube videos per song
- Search their library by title or artist
- Delete songs (cascades to tabs and videos)

All data is private: every query is filtered by the authenticated user's ID.

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, Express 5 |
| Database | PostgreSQL, Sequelize ORM |
| Auth | Google OAuth 2.0, JWT (HttpOnly cookie) |
| Process manager | `forever` (production) |
| Tests | Jest, Supertest |
| Dev server | nodemon |

## Running locally

**Prerequisites:** Node.js 20+, PostgreSQL running locally.

```bash
# 1. Install dependencies
npm install

# 2. Create the database
createdb song_project_db

# 3. Create a .env file (see Environment variables below)
cp .env.example .env   # or create it manually

# 4. Start the dev server (auto-restarts on file changes)
npm run dev
```

The server starts on port 3001 by default.

## Environment variables

Create a `.env` file in the project root with the following:

| Variable | Description |
|---|---|
| `DB_NAME` | PostgreSQL database name |
| `DB_USER` | PostgreSQL user |
| `DB_PASSWORD` | PostgreSQL password |
| `DB_HOST` | Database host (usually `localhost`) |
| `DB_PORT` | Database port (usually `5432`) |
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console |
| `JWT_SECRET` | Random secret used to sign session JWTs — keep this long and random |
| `PORT` | HTTP port (defaults to `3001`) |
| `NODE_ENV` | Set to `production` in production (enables `Secure` flag on cookie) |

## Database schema

The app uses four tables:

**users**
- `id` UUID, primary key
- `google_id` string — Google's identifier for the user
- `email` string
- `name` string

**songs**
- `id` UUID, primary key
- `user_id` UUID, foreign key → users
- `title` string
- `artist` string

**tabs**
- `id` UUID, primary key
- `song_id` UUID, foreign key → songs
- `text` text — the guitar tab content
- `scroll_speed` integer (nullable) — auto-scroll speed in the frontend

**videos**
- `id` UUID, primary key
- `song_id` UUID, foreign key → songs
- `url` string — YouTube URL (normalized to embed format on response)
- `video_type` string

## Running tests

```bash
npm test                # run all tests once
npm run test:watch      # watch mode
npm run test:coverage   # with coverage report
```

Tests use Jest and Supertest and run against a real in-memory SQLite database. No running PostgreSQL instance is required.

## How authentication works

```
Browser                   Backend                    Google
  |                          |                           |
  |-- Google login --------->|                           |
  |                          |-- verify token ---------->|
  |                          |<-- user payload ----------|
  |                          |                           |
  |                          | look up or create user in DB
  |                          |                           |
  |<-- Set-Cookie: session_jwt (HttpOnly, SameSite=Strict, Secure in prod)
  |<-- JSON: { name, email, user_id }
  |                          |
  | (subsequent requests)    |
  |-- Cookie sent automatically (browser handles this)
  |                          |
  |                          | verify JWT from cookie
  |                          | attach decoded token to req.token
  |                          | proceed to route handler
```

**Why HttpOnly cookies?** The `session_jwt` cookie cannot be read by JavaScript, which prevents token theft via XSS attacks. `SameSite=Strict` blocks the cookie from being sent in cross-site requests, mitigating CSRF. In production, `Secure` ensures the cookie is only sent over HTTPS.

**Token expiry:** JWTs expire after 7 days. After expiry the server returns 401, which the frontend handles by returning the user to the login screen.

## API reference

All endpoints except auth require a valid `session_jwt` cookie. The server returns `401` if the token is missing, invalid, or expired.

---

### `POST /api/auth/google`

Exchange a Google OAuth credential for a session cookie.

**Request body:**
```json
{ "token": "<google-id-token>" }
```

**Response** (on success):
- Sets `Set-Cookie: session_jwt=...; HttpOnly; SameSite=Strict`
- Body:
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "user_id": "uuid-here"
}
```

---

### `POST /api/auth/logout`

Clears the session cookie.

**Response:** `204 No Content`

---

### `GET /api/songs`

List the authenticated user's songs.

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | 10 | Max results to return |
| `offset` | number | 0 | Pagination offset |
| `query` | string | — | Case-insensitive search against title and artist |

**Response:**
```json
[
  { "id": "uuid", "title": "Blackbird", "artist": "Beatles" }
]
```

---

### `POST /api/songs`

Create a new song with a tab and optional videos.

**Request body:**
```json
{
  "title": "Blackbird",
  "artist": "Beatles",
  "tab_text": "Am G C ...",
  "scroll_speed": 20,
  "videos": [
    { "url": "https://youtu.be/...", "video_type": "tutorial" }
  ]
}
```

`title`, `artist`, and `tab_text` are required. `videos` is optional (max 5). Each video requires `url` and `video_type`.

**Response:** `201 Created`
```json
{
  "song": { "id": "uuid", "title": "Blackbird", "artist": "Beatles" },
  "tab": { "id": "uuid", "text": "Am G C ...", "scroll_speed": 20 },
  "videos": [{ "id": "uuid", "video_type": "tutorial", "url": "https://www.youtube.com/embed/..." }]
}
```

---

### `PUT /api/songs/:songId`

Update a song's title, artist, tab text, scroll speed, or videos.

All body fields are optional. Videos are replaced in full when provided — include existing video IDs to keep them, omit to delete them.

**Request body:**
```json
{
  "title": "Let It Be",
  "tab_text": "C G Am F ...",
  "scroll_speed": 30,
  "videos": [
    { "id": "existing-uuid", "url": "https://youtu.be/...", "video_type": "tutorial" },
    { "url": "https://youtu.be/...", "video_type": "cover" }
  ]
}
```

**Response:** `200 OK` — same shape as `POST /api/songs`.

---

### `DELETE /api/songs/:songId`

Delete a song and all associated tabs and videos.

**Response:** `204 No Content`

---

### `GET /api/tabs/:songId`

Get the tab for a song.

**Response:**
```json
{ "id": "uuid", "text": "Am G C ...", "scroll_speed": 20 }
```

---

### `GET /api/videos/:songId`

Get videos for a song. YouTube URLs are normalized to embed format.

**Response:**
```json
[
  { "id": "uuid", "video_type": "tutorial", "url": "https://www.youtube.com/embed/..." }
]
```

---

### Error responses

All error responses follow this shape:

```json
{
  "status": "error",
  "message": "Description of the error",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

| Status | Meaning |
|---|---|
| `400` | Bad request — missing or invalid fields |
| `401` | Unauthorized — missing, invalid, or expired session |
| `404` | Song not found (or belongs to a different user) |
| `500` | Internal server error |

## Deployment

Pushes to `master` trigger a GitHub Actions pipeline:

```
push to master
    │
    ▼
[test job]
  npm ci
  npm test
    │
    ▼ (on success)
[deploy job]
  SSH into EC2
  git pull
  npm ci
  write .env from secrets
  forever stopall
  forever start app.js
```

### Required GitHub secrets and variables

| Name | Type | Description |
|---|---|---|
| `EC2_HOST` | Secret | Public IP or hostname of the EC2 instance |
| `EC2_USER` | Secret | SSH user (e.g. `ec2-user`) |
| `EC2_SSH_KEY` | Secret | Private SSH key for the EC2 instance |
| `DB_NAME` | Secret | Production database name |
| `DB_USER` | Secret | Production database user |
| `DB_PASSWORD` | Secret | Production database password |
| `DB_HOST` | Secret | Production database host |
| `DB_PORT` | Secret | Production database port |
| `GOOGLE_CLIENT_ID` | Secret | Google OAuth client ID |
| `JWT_SECRET` | Secret | Production JWT signing secret (different from local) |
| `BACKEND_PORT` | Variable | Port the server listens on (e.g. `3001`) |
