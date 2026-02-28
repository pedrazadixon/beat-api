# 🎵 Beat API

> **YouTube Music InnerTube API + yt-dlp Audio Streaming Server**

A Node.js REST API server that wraps the YouTube Music InnerTube API (translated from Kotlin) and provides audio stream extraction & proxying via yt-dlp. Designed to power music player front-ends with search, browse, playback, library management, and real-time audio streaming.

---

## 📑 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Server](#running-the-server)
  - [Docker](#docker)
- [Authentication](#-authentication)
- [API Endpoints](#-api-endpoints)
  - [Health Check](#health-check)
  - [API Documentation](#api-documentation)
  - [YouTube Music - Search](#search)
  - [YouTube Music - Albums](#albums)
  - [YouTube Music - Artists](#artists)
  - [YouTube Music - Playlists](#playlists)
  - [YouTube Music - Browse & Discover](#browse--discover)
  - [YouTube Music - Player & Queue](#player--queue)
  - [YouTube Music - Lyrics & Related](#lyrics--related)
  - [YouTube Music - Library & History](#library--history)
  - [YouTube Music - Likes & Subscribe](#likes--subscribe)
  - [YouTube Music - Playlist Management](#playlist-management)
  - [YouTube Music - Account](#account)
  - [Stream - yt-dlp Endpoints](#stream---yt-dlp-endpoints)
- [Response Format](#-response-format)
- [Error Handling](#-error-handling)
- [Testing](#-testing)
- [Project Structure](#-project-structure)
- [License](#-license)

---

## ✨ Features

- **YouTube Music InnerTube API** — Full search, browse, albums, artists, playlists, lyrics, charts, and more
- **Audio Streaming** — Extract, proxy, and play audio streams via yt-dlp
- **Bearer Token Auth** — All protected endpoints require a configurable bearer token
- **Cookie Support** — Automatic Netscape cookie file generation from browser cookie strings for authenticated YouTube requests
- **Range Request Support** — Seeking support for proxied audio streams (HTTP 206 Partial Content)
- **Docker Ready** — Includes Dockerfile and docker-compose for easy deployment
- **Request Logging** — Color-coded method/status/duration logging for every request
- **Retry Logic** — Exponential backoff for transient InnerTube API errors

---

## 🏗 Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────────┐
│   Client     │────▶│               Beat API Server                │
│  (Browser,   │◀────│                                              │
│   Mobile)    │     │  ┌────────────┐    ┌───────────────────────┐ │
└─────────────┘     │  │ Middleware  │    │      Routes           │ │
                    │  │  ├─ Auth    │    │  ├─ /api/youtube/*    │ │
                    │  │  └─ CORS    │    │  └─ /api/stream/*    │ │
                    │  └────────────┘    └───────────────────────┘ │
                    │                                              │
                    │  ┌──────────────────────────────────────────┐│
                    │  │           InnerTube Client                ││
                    │  │  ├─ innertube.js  (HTTP client)           ││
                    │  │  ├─ youtube.js    (high-level API)        ││
                    │  │  ├─ parsers.js    (response parsers)      ││
                    │  │  └─ constants.js  (clients & filters)     ││
                    │  └──────────────────────────────────────────┘│
                    │                                              │
                    │  ┌──────────────┐  ┌────────────────────┐   │
                    │  │   yt-dlp     │  │   cookies.txt      │   │
                    │  │  (binary)    │  │ (auto-generated)   │   │
                    │  └──────────────┘  └────────────────────┘   │
                    └──────────────────────────────────────────────┘
                              │                    │
                              ▼                    ▼
                    ┌──────────────┐     ┌──────────────────┐
                    │  YouTube     │     │  YouTube Music    │
                    │  (streams)   │     │  InnerTube API    │
                    └──────────────┘     └──────────────────┘
```

---

## 🛠 Tech Stack

| Technology   | Purpose                                    |
| ------------ | ------------------------------------------ |
| **Node.js**  | Runtime environment                        |
| **Express 5** | HTTP server framework                     |
| **Axios**    | HTTP client for InnerTube & stream proxying |
| **yt-dlp**   | Audio stream extraction binary             |
| **dotenv**   | Environment variable management            |
| **cors**     | Cross-origin resource sharing              |
| **uuid**     | Unique ID generation                       |
| **Vitest**   | Test runner                                |
| **Supertest**| HTTP assertion library for tests           |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18
- **yt-dlp** binary (included in `bin/` for Windows & Linux ARM64)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd beat-api

# Install dependencies
npm install
```

### Environment Variables

Copy the example file and configure:

```bash
cp .env.example .env
```

| Variable          | Default                          | Description                                                  |
| ----------------- | -------------------------------- | ------------------------------------------------------------ |
| `PORT`            | `3000`                           | Server port                                                  |
| `HOST`            | `0.0.0.0`                        | Server host                                                  |
| `BEARER_TOKEN`    | `beat-api-secret-token-change-me`| Authentication token for protected endpoints                 |
| `YT_LOCALE_GL`    | `US`                             | YouTube geolocation (country code)                           |
| `YT_LOCALE_HL`    | `en`                             | YouTube language code                                        |
| `YTDLP_PATH`      | `./bin/yt-dlp.exe`              | Path to yt-dlp binary                                        |
| `YT_COOKIE`       | —                                | Browser cookie string for authenticated YouTube requests     |
| `YT_VISITOR_DATA` | —                                | YouTube visitor data (optional)                              |
| `YT_DATA_SYNC_ID` | —                                | YouTube data sync ID (optional)                              |
| `PROXY_URL`       | —                                | HTTP proxy URL (optional)                                    |
| `PROXY_AUTH`      | —                                | Proxy authentication (optional)                              |

### Running the Server

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

The server starts with a banner showing the URL, environment, and available endpoint groups:

```
  ╔══════════════════════════════════════╗
  ║         🎵 Beat API Server 🎵        ║
  ╠══════════════════════════════════════╣
  ║  URL: http://0.0.0.0:3000            ║
  ║  Env: development                    ║
  ║  Auth: Bearer Token                  ║
  ╚══════════════════════════════════════╝

  Endpoints:
    GET  /api/health          (no auth)
    GET  /api                 (API docs)
    *    /api/youtube/*       (InnerTube)
    *    /api/stream/*        (yt-dlp)
```

### Docker

```bash
# Build and run with Docker Compose
docker compose up --build

# Or build manually
docker build -t beat-api .
docker run -p 3000:3000 --env-file .env beat-api
```

---

## 🔐 Authentication

All `/api/youtube/*` and `/api` endpoints require **Bearer token** authentication. The `/api/stream/*` endpoints and `/api/health` are **public** (no auth required).

Include the token in the `Authorization` header:

```
Authorization: Bearer <your-token>
```

| Status | Response                                              |
| ------ | ----------------------------------------------------- |
| `401`  | Missing `Authorization` header                        |
| `401`  | Invalid format (must be `Bearer <token>`)             |
| `403`  | Invalid / wrong token                                 |
| `500`  | `BEARER_TOKEN` not configured on the server           |

---

## 📖 API Endpoints

> **Base URL:** `http://localhost:3000`

### Health Check

| Method | Endpoint       | Auth | Description        |
| ------ | -------------- | ---- | ------------------ |
| `GET`  | `/api/health`  | ❌    | Server health check |

**Response:**
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2026-02-25T22:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "innertube": "active",
    "ytdlp": "active",
    "streaming": "active"
  }
}
```

---

### API Documentation

| Method | Endpoint | Auth | Description                          |
| ------ | -------- | ---- | ------------------------------------ |
| `GET`  | `/api`   | ✅    | Returns full API endpoint listing    |

---

### Search

| Method | Endpoint                              | Auth | Description                              |
| ------ | ------------------------------------- | ---- | ---------------------------------------- |
| `GET`  | `/api/youtube/search?q=`              | ✅    | Search songs, videos, albums, artists    |
| `GET`  | `/api/youtube/search/suggestions?q=`  | ✅    | Get search autocomplete suggestions      |
| `GET`  | `/api/youtube/search/summary?q=`      | ✅    | Search summary (top result + sections)   |
| `GET`  | `/api/youtube/search/continuation?token=` | ✅ | Paginate search results                 |

#### Query Parameters

| Parameter | Type     | Required | Description                                                                                       |
| --------- | -------- | -------- | ------------------------------------------------------------------------------------------------- |
| `q`       | `string` | ✅        | Search query text                                                                                 |
| `filter`  | `string` | ❌        | Filter type: `SONG`, `VIDEO`, `ALBUM`, `ARTIST`, `FEATURED_PLAYLIST`, `COMMUNITY_PLAYLIST`       |
| `token`   | `string` | ✅ *(continuation)* | Continuation token from a previous search response                               |

#### Example

```bash
# Search for songs
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/search?q=daft+punk&filter=SONG"

# Get suggestions
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/search/suggestions?q=daft"
```

---

### Albums

| Method | Endpoint                                  | Auth | Description                |
| ------ | ----------------------------------------- | ---- | -------------------------- |
| `GET`  | `/api/youtube/album/:browseId`            | ✅    | Album details + songs      |
| `GET`  | `/api/youtube/album/:playlistId/songs`    | ✅    | Album songs only           |

#### Query Parameters

| Parameter   | Type      | Required | Default | Description                        |
| ----------- | --------- | -------- | ------- | ---------------------------------- |
| `withSongs` | `boolean` | ❌        | `true`  | Include songs in album response    |

#### Example

```bash
# Get album details
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/album/MPREb_IQ2lhYRnNcO"

# Get album details without songs
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/album/MPREb_IQ2lhYRnNcO?withSongs=false"
```

---

### Artists

| Method | Endpoint                                                   | Auth | Description                        |
| ------ | ---------------------------------------------------------- | ---- | ---------------------------------- |
| `GET`  | `/api/youtube/artist/:browseId`                            | ✅    | Artist page                        |
| `GET`  | `/api/youtube/artist/:browseId/albums`                     | ✅    | Artist albums                      |
| `GET`  | `/api/youtube/artist/:browseId/items`                      | ✅    | Artist items (albums, singles, etc)|
| `GET`  | `/api/youtube/artist/items/continuation?token=`            | ✅    | Paginate artist items              |
| `GET`  | `/api/youtube/artist/albums/continuation?token=&visitorData=` | ✅ | Paginate artist albums             |

#### Query Parameters (Artist Items)

| Parameter | Type     | Required | Description                                         |
| --------- | -------- | -------- | --------------------------------------------------- |
| `params`  | `string` | ❌        | Browse params for artist items filtering             |

#### Query Parameters (Albums Continuation)

| Parameter     | Type     | Required | Description                                                      |
| ------------- | -------- | -------- | ---------------------------------------------------------------- |
| `token`       | `string` | ✅        | Continuation token from previous response                        |
| `visitorData` | `string` | ✅        | Visitor data returned alongside `continuation` in albums response|

#### Example

```bash
# Get artist page
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/artist/UCHqD2OBWbcWGmCve99uw47A"

# Get artist albums
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/artist/UCHqD2OBWbcWGmCve99uw47A/albums"
```

---

### Playlists

| Method | Endpoint                                          | Auth | Description                    |
| ------ | ------------------------------------------------- | ---- | ------------------------------ |
| `GET`  | `/api/youtube/playlist/:playlistId`               | ✅    | Playlist details + songs       |
| `GET`  | `/api/youtube/playlist/continuation?token=`       | ✅    | Paginate playlist songs        |

#### Example

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/playlist/OLAK5uy_mlJWyCnmaoUatY7UWznjuEMuCPz8r7voU"
```

---

### Browse & Discover

| Method | Endpoint                                  | Auth | Description                        |
| ------ | ----------------------------------------- | ---- | ---------------------------------- |
| `GET`  | `/api/youtube/home`                       | ✅    | Home page (chips, sections)        |
| `GET`  | `/api/youtube/explore`                    | ✅    | Explore page (new releases, moods) |
| `GET`  | `/api/youtube/charts`                     | ✅    | Music charts                       |
| `GET`  | `/api/youtube/new-releases`               | ✅    | New release albums                 |
| `GET`  | `/api/youtube/mood-and-genres`            | ✅    | Mood & genres categories           |
| `GET`  | `/api/youtube/browse/:browseId`           | ✅    | Generic browse endpoint            |

#### Query Parameters (Home)

| Parameter      | Type     | Required | Description                                  |
| -------------- | -------- | -------- | -------------------------------------------- |
| `continuation` | `string` | ❌        | Continuation token for pagination            |
| `params`       | `string` | ❌        | Filter params (e.g., chip selection)         |

#### Query Parameters (Charts)

| Parameter      | Type     | Required | Description                                  |
| -------------- | -------- | -------- | -------------------------------------------- |
| `continuation` | `string` | ❌        | Continuation token for pagination            |

#### Query Parameters (Browse)

| Parameter | Type     | Required | Description                                  |
| --------- | -------- | -------- | -------------------------------------------- |
| `params`  | `string` | ❌        | Additional browse params                     |

#### Example

```bash
# Get home page
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/home"

# Get charts
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/charts"
```

---

### Player & Queue

| Method | Endpoint                              | Auth | Description                        |
| ------ | ------------------------------------- | ---- | ---------------------------------- |
| `GET`  | `/api/youtube/player/:videoId`        | ✅    | Player info (stream URLs)          |
| `GET`  | `/api/youtube/next/:videoId`          | ✅    | Next/queue info                    |
| `POST` | `/api/youtube/queue`                  | ✅    | Get queue                          |

#### Player Query Parameters

| Parameter           | Type     | Required | Default       | Description                       |
| ------------------- | -------- | -------- | ------------- | --------------------------------- |
| `playlistId`        | `string` | ❌        | —             | Playlist context                  |
| `client`            | `string` | ❌        | `WEB_REMIX`   | InnerTube client (`WEB`, `WEB_REMIX`) |
| `signatureTimestamp`| `number` | ❌        | —             | Signature timestamp               |
| `poToken`           | `string` | ❌        | —             | Proof of Origin token             |

#### Next Query Parameters

| Parameter            | Type     | Required | Description                           |
| -------------------- | -------- | -------- | ------------------------------------- |
| `playlistId`         | `string` | ❌        | Playlist context                      |
| `playlistSetVideoId` | `string` | ❌        | Set video ID for playlist context     |
| `index`              | `number` | ❌        | Index in playlist                     |
| `params`             | `string` | ❌        | Additional params                     |
| `continuation`       | `string` | ❌        | Continuation token                    |

#### Queue Request Body

```json
{
  "videoIds": ["videoId1", "videoId2"],
  "playlistId": "PLxxxxxx"
}
```

#### Example

```bash
# Get player info
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/player/dQw4w9WgXcQ"

# Get next/queue info
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/next/dQw4w9WgXcQ?playlistId=RDdQw4w9WgXcQ"

# Get queue
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"videoIds": ["dQw4w9WgXcQ"]}' \
  "http://localhost:3000/api/youtube/queue"
```

---

### Lyrics & Related

| Method | Endpoint                              | Auth | Description                |
| ------ | ------------------------------------- | ---- | -------------------------- |
| `GET`  | `/api/youtube/lyrics/:browseId`       | ✅    | Song lyrics                |
| `GET`  | `/api/youtube/related/:browseId`      | ✅    | Related content            |
| `GET`  | `/api/youtube/transcript/:videoId`    | ✅    | Video transcript           |

#### Lyrics Query Parameters

| Parameter | Type     | Required | Description                |
| --------- | -------- | -------- | -------------------------- |
| `params`  | `string` | ❌        | Additional params          |

#### Example

```bash
# Get lyrics (browseId from the next endpoint's tabs)
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/lyrics/MPLYt_xxxx"
```

---

### Library & History

| Method | Endpoint                                          | Auth | Description                    |
| ------ | ------------------------------------------------- | ---- | ------------------------------ |
| `GET`  | `/api/youtube/library/:browseId`                  | ✅    | Library items                  |
| `GET`  | `/api/youtube/library/continuation?token=`        | ✅    | Paginate library items         |
| `GET`  | `/api/youtube/history`                            | ✅    | Listening history              |
| `POST` | `/api/youtube/library/add`                        | ✅    | Add song to library            |
| `POST` | `/api/youtube/library/remove`                     | ✅    | Remove song from library       |

#### Library Add/Remove Request Body

```json
{
  "videoId": "dQw4w9WgXcQ"
}
```

#### Example

```bash
# Get listening history
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/history"

# Add song to library
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"videoId": "dQw4w9WgXcQ"}' \
  "http://localhost:3000/api/youtube/library/add"
```

---

### Likes & Subscribe

| Method | Endpoint                        | Auth | Description                        |
| ------ | ------------------------------- | ---- | ---------------------------------- |
| `POST` | `/api/youtube/like/video`       | ✅    | Like or unlike a video             |
| `POST` | `/api/youtube/like/playlist`    | ✅    | Like or unlike a playlist          |
| `POST` | `/api/youtube/subscribe`        | ✅    | Subscribe or unsubscribe to artist |

#### Request Bodies

```jsonc
// Like Video
{ "videoId": "dQw4w9WgXcQ", "like": true }

// Like Playlist
{ "playlistId": "PLxxxxxx", "like": true }

// Subscribe
{ "channelId": "UCxxxxxx", "subscribe": true }
```

> **Note:** Set `like` / `subscribe` to `false` to unlike / unsubscribe.

---

### Playlist Management

| Method   | Endpoint                                | Auth | Description                              |
| -------- | --------------------------------------- | ---- | ---------------------------------------- |
| `POST`   | `/api/youtube/playlist/create`          | ✅    | Create a new playlist                    |
| `POST`   | `/api/youtube/playlist/rename`          | ✅    | Rename a playlist                        |
| `DELETE` | `/api/youtube/playlist/:playlistId`     | ✅    | Delete a playlist                        |
| `POST`   | `/api/youtube/playlist/add`             | ✅    | Add a video to a playlist                |
| `POST`   | `/api/youtube/playlist/remove`          | ✅    | Remove a video from a playlist           |

#### Request Bodies

```jsonc
// Create Playlist
{ "title": "My Playlist" }

// Rename Playlist
{ "playlistId": "PLxxxxxx", "name": "New Name" }

// Add to Playlist
{ "playlistId": "PLxxxxxx", "videoId": "dQw4w9WgXcQ" }

// Remove from Playlist
{ "playlistId": "PLxxxxxx", "videoId": "dQw4w9WgXcQ", "setVideoId": "xxx" }
```

#### Example

```bash
# Create playlist
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Chill Vibes"}' \
  "http://localhost:3000/api/youtube/playlist/create"

# Delete playlist
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/playlist/PLxxxxxx"
```

---

### Account

| Method | Endpoint               | Auth | Description      |
| ------ | ---------------------- | ---- | ---------------- |
| `GET`  | `/api/youtube/account`  | ✅    | Account info     |

#### Example

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/youtube/account"
```

---

### Stream — yt-dlp Endpoints

> ⚠️ These endpoints are **public** (no authentication required).

| Method | Endpoint                           | Description                                            |
| ------ | ---------------------------------- | ------------------------------------------------------ |
| `GET`  | `/api/stream/extract?videoId=`     | Extract audio stream URL(s) via yt-dlp                 |
| `GET`  | `/api/stream/info?videoId=`        | Get full video/audio metadata via yt-dlp               |
| `GET`  | `/api/stream/proxy?url=`           | Proxy/pipe a stream URL in real-time                   |
| `GET`  | `/api/stream/play?videoId=`        | Extract + stream in one step (use as `<audio>` src)    |

#### Extract — `/api/stream/extract`

Runs yt-dlp to extract the direct streamable audio URL(s).

| Parameter | Type     | Required | Description                              |
| --------- | -------- | -------- | ---------------------------------------- |
| `videoId`  | `string` | ✅*       | YouTube video ID                         |
| `url`      | `string` | ✅*       | Full YouTube URL (alternative to videoId)|

> \* One of `videoId` or `url` is required.

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "dQw4w9WgXcQ",
    "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "streamUrls": ["https://..."],
    "streamUrl": "https://...",
    "proxyUrls": [
      { "index": 0, "proxyUrl": "/api/stream/proxy?url=..." }
    ]
  }
}
```

#### Info — `/api/stream/info`

Returns full metadata (title, duration, thumbnail, formats, etc.) for a video.

| Parameter | Type     | Required | Description                              |
| --------- | -------- | -------- | ---------------------------------------- |
| `videoId`  | `string` | ✅*       | YouTube video ID                         |
| `url`      | `string` | ✅*       | Full YouTube URL                         |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "dQw4w9WgXcQ",
    "title": "Song Title",
    "duration": 212,
    "thumbnail": "https://...",
    "uploader": "Artist Name",
    "uploaderId": "UCxxxxxx",
    "viewCount": 1000000,
    "likeCount": 50000,
    "description": "...",
    "formats": [
      {
        "formatId": "251",
        "ext": "webm",
        "quality": 10,
        "abr": 160,
        "asr": 48000,
        "acodec": "opus",
        "filesize": 3000000,
        "url": "https://..."
      }
    ],
    "bestAudioUrl": "https://..."
  }
}
```

#### Proxy — `/api/stream/proxy`

Reverse proxy that pipes a remote stream URL to the client. Necessary because yt-dlp generated URLs are typically IP-locked to the server.

| Parameter | Type     | Required | Description                                |
| --------- | -------- | -------- | ------------------------------------------ |
| `url`     | `string` | ✅        | URL-encoded stream URL to proxy            |

- Supports `Range` headers for seeking (returns `206 Partial Content`)
- Forwards `Content-Type`, `Content-Length`, `Content-Range`, `Accept-Ranges`

#### Play — `/api/stream/play`

**Convenience endpoint** — extracts the audio URL and immediately streams it as a proxy. Can be used directly as an HTML `<audio>` source.

| Parameter | Type     | Required | Description                              |
| --------- | -------- | -------- | ---------------------------------------- |
| `videoId`  | `string` | ✅*       | YouTube video ID                         |
| `url`      | `string` | ✅*       | Full YouTube URL                         |

**Usage in HTML:**
```html
<audio src="http://localhost:3000/api/stream/play?videoId=dQw4w9WgXcQ" controls></audio>
```

#### Example

```bash
# Extract stream URL
curl "http://localhost:3000/api/stream/extract?videoId=dQw4w9WgXcQ"

# Get full metadata
curl "http://localhost:3000/api/stream/info?videoId=dQw4w9WgXcQ"

# Direct play (streams audio)
curl "http://localhost:3000/api/stream/play?videoId=dQw4w9WgXcQ" --output audio.webm
```

---

## 📦 Response Format

All JSON endpoints follow a consistent response format:

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error description message"
}
```

In `development` environment, error responses also include a `stack` trace:

```json
{
  "success": false,
  "error": "Error description",
  "stack": "Error: ...\n    at ..."
}
```

---

## ⚠️ Error Handling

| Status Code | Description                                          |
| ----------- | ---------------------------------------------------- |
| `400`       | Missing or invalid required parameters               |
| `401`       | Missing or malformed `Authorization` header          |
| `403`       | Invalid bearer token                                 |
| `404`       | Route not found                                      |
| `500`       | Internal server error / InnerTube API failure        |
| `502`       | Stream proxy failure / yt-dlp extraction failure     |

---

## 🧪 Testing

Tests are written with **Vitest** and **Supertest**.

```bash
# Run all tests
npm test
```

Test files:

| File                       | Description                              |
| -------------------------- | ---------------------------------------- |
| `tests/youtube.test.js`   | YouTube Music InnerTube route tests      |
| `tests/stream.test.js`    | yt-dlp streaming route tests             |
| `tests/test.config.js`    | Test configuration (IDs and parameters)  |

---

## 📁 Project Structure

```
beat-api/
├── bin/
│   ├── yt-dlp.exe               # Windows yt-dlp binary
│   └── yt-dlp_linux_aarch64     # Linux ARM64 yt-dlp binary
├── src/
│   ├── innertube/
│   │   ├── constants.js         # InnerTube clients, search filters, library filters
│   │   ├── innertube.js         # Low-level InnerTube HTTP client (request builder)
│   │   ├── youtube.js           # High-level YouTube Music API (combines requests + parsing)
│   │   └── parsers.js           # Response parsers (search, album, artist, home, etc.)
│   ├── middleware/
│   │   └── auth.js              # Bearer token authentication middleware
│   ├── routes/
│   │   ├── youtube.js           # YouTube Music REST route handlers
│   │   └── stream.js            # yt-dlp stream extraction & proxy route handlers
│   └── utils/
│       └── convertCookies.js    # Browser cookie string → Netscape cookie file converter
├── tests/
│   ├── youtube.test.js          # YouTube Music API tests
│   ├── stream.test.js           # Stream endpoint tests
│   └── test.config.js           # Test configuration
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── .dockerignore                # Docker ignore rules
├── Dockerfile                   # Docker image definition
├── docker-compose.yml           # Docker Compose configuration
├── package.json                 # Node.js project manifest
├── server.js                    # Application entry point
└── README.md                    # This file
```

---

## 📄 License

ISC
