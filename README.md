# 🏆 LiveQuiz Pro — Realtime Live Quiz Platform for College Events

LiveQuiz Pro is a **production-ready, server-authoritative live multiplayer technical quiz competition platform** engineered for high-concurrency college events and auditoriums. Designed to reliably accommodate **200+ simultaneous participants** on mobile phones and a central auditorium projector screen, it eliminates polling overhead using persistent WebSockets and guarantees mathematical scoring integrity.

---

## 🚀 Key Architectural Capabilities

| Feature | Production Implementation |
|---|---|
| **Realtime Engine** | Persistent WebSockets (`/ws`) with automatic heartbeat (25s ping-pong), room pub/sub (`event:<id>`), and exponential backoff reconnect. Zero polling. |
| **Server-Authoritative Scoring** | Base points + decaying time bonus calculated exclusively server-side from `question_started_at` with network jitter grace period. Clients cannot tamper with scores. |
| **Participant Recovery** | State persistence in `sessionStorage` with cryptographic UUID tokens. Seamless page refresh recovery mid-question or mid-event. |
| **Auditorium Projector** | Fullscreen 1080p/4K responsive stage display with synchronized millisecond countdown ring, live response counter, and answer reveal. |
| **Duplicate Prevention** | Unique composite index `(event_id, display_name)` at the PostgreSQL layer prevents collisions while allowing reconnection by existing session token owners. |
| **Question Bank** | 200 real technical multiple-choice questions across 9 core engineering domains (DSA, OOPS, DBMS, C/C++, Java, Python, OS, Networks, AI/ML), with full CSV import & export capabilities. |

---

## 🏗️ System Architecture & Deployment

```
   ┌─────────────────────────────────────────────────────────┐
   │             AUDITORIUM PROJECTOR / DESKTOP              │
   │               (1080p/4K Big Screen View)                │
   └───────────────────────────┬─────────────────────────────┘
                               │
   ┌───────────────────────────┴─────────────────────────────┐
   │             200+ MOBILE STUDENT PARTICIPANTS            │
   │             (Game PIN → Waiting Room → Live)            │
   └───────────────────────────┬─────────────────────────────┘
                               │ HTTPS / WSS
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │            VERCEL EDGE HOSTING (Frontend SPA)           │
   │           Vite + React 19 + Tailwind CSS                │
   └───────────────────────────┬─────────────────────────────┘
                               │ REST API + WebSocket
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │           RAILWAY BACKEND (Node.js + Express)           │
   │     • Express REST API (Rate-limited public routes)     │
   │     • WebSocket Server (`ws` on `/ws` with rooms)       │
   │     • In-Memory Store Fallback for local development    │
   └───────────────────────────┬─────────────────────────────┘
                               │ Connection Pool (pg)
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │         RAILWAY POSTGRESQL (Production Database)        │
   │     • Admins, Events, Questions, Participants, Answers  │
   │     • Normalized schema with b-tree & composite indexes │
   └─────────────────────────────────────────────────────────┘
```

---

## 🧮 Server-Authoritative Scoring Formula

Scores are computed entirely on the backend in `server/services/scoringService.ts`:

$$\text{Final Score} = \text{Base Points} + \text{Time Bonus}$$

- **Base Points**: 1,000 points for a correct answer; 0 points for incorrect.
- **Time Bonus**: Up to 1,000 additional points proportional to how quickly the answer was received.
- **Network Jitter Grace Period**: A 350ms grace window is subtracted from elapsed time to neutralize mobile Wi-Fi latency, ensuring students in the back row have the exact same advantage as front-row participants.
- **Strict Server Deadline**: Submissions arriving after `question_deadline + 1000ms` grace are rejected with `TIME_EXPIRED`.

---

## 🛠️ Environment Variables

### Backend Configuration (Railway / Server)
| Variable | Description | Default |
|---|---|---|
| `PORT` | Server HTTP and WebSocket port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` (Falls back to zero-config in-memory store if absent) |
| `JWT_SECRET` | Secret key for admin session signing | Custom secure string |
| `FRONTEND_URL` | Allowed CORS origins | `*` (or your Vercel URL) |
| `ADMIN_DEFAULT_EMAIL` | Default host admin email | `admin@college.edu` |
| `ADMIN_DEFAULT_PASSWORD` | Default host admin password | `AdminCollege2026!` |

### Frontend Configuration (Vercel)
| Variable | Description |
|---|---|
| `VITE_API_URL` | URL to your Railway backend API (e.g., `https://your-quiz-backend.up.railway.app`) |
| `VITE_WS_URL` | WebSocket URL to your Railway backend (e.g., `wss://your-quiz-backend.up.railway.app`) |

*(When deployed together or during local preview, leaving `VITE_API_URL` and `VITE_WS_URL` blank will automatically resolve to the current browser origin).*

---

## 🚀 Step-by-Step Deployment Guide

### A. Deploy Backend to Railway
1. Go to [Railway.app](https://railway.app) and create a **New Project**.
2. Click **+ New** → **Database** → **Add PostgreSQL**. Railway will automatically create a managed PostgreSQL instance and inject `DATABASE_URL`.
3. Click **+ New** → **GitHub Repo** (or upload this codebase).
4. In the service settings, add the environment variables:
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
   - `JWT_SECRET`: Generate a random 32-character string.
   - `NODE_ENV`: `production`
5. Railway will automatically run `npm run build` and `npm start`. On startup, `server.ts` runs the SQL migrations in `database/migrations/001_init.sql`, creates required indexes, and seeds the 200 questions.
6. Generate a public domain under **Settings** → **Networking** (e.g., `https://livequiz-production.up.railway.app`).

### B. Deploy Frontend to Vercel
1. Import the repository into [Vercel](https://vercel.com).
2. Framework Preset: **Vite**.
3. Under **Environment Variables**, set:
   - `VITE_API_URL`: `https://livequiz-production.up.railway.app`
   - `VITE_WS_URL`: `wss://livequiz-production.up.railway.app`
4. Deploy! The included `vercel.json` automatically ensures client-side routing works cleanly for `/join`, `/play`, `/admin`, and `/leaderboard`.

---

## 🧪 Self-Audit & Concurrency Testing

| Verification Step | Test Procedure & Result |
|---|---|
| **Join Flow** | Input Game PIN (`483921`) and name. Successfully transitions into the animated Waiting Room. |
| **Duplicate Prevention** | Attempting to join with the same name from a second device rejects with clean HTTP 400 error. Re-joining with the same session token restores existing state. |
| **Live Progression** | Host starts Quiz / advances question. All connected clients receive the `QUESTION_STARTED` WebSocket payload simultaneously. |
| **Answer Submission** | Participant selects Option A/B/C/D. Instant local feedback, server records answer, updates rank, and broadcasts `ANSWER_RECEIVED` count to projector. |
| **Timer Synchronization** | Server timestamp authoritative timer counts down to 0 on both projector and phones. When timer expires, options disable automatically. |
| **Refresh Recovery** | Refreshing the browser mid-question retains the submitted answer and ongoing timer without score loss. |
| **CSV Import & Export** | Custom technical questions can be imported via CSV parser with line-by-line syntax validation; current question bank and final leaderboard export to CSV in 1 click. |
