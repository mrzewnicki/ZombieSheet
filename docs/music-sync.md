# Music Sync — Cloudflare Workers + Durable Objects

## Overview

Live music playback is synchronized via a **Cloudflare Worker** (`zombie-sheet-sync`) running one **Durable Object** per `gameId`. All clients receive play/pause/seek events at the same server-anchored position, eliminating the clock drift inherent in the previous Firestore `onSnapshot` approach.

Firebase remains the source of truth for:
- Auth (Google), game data, lobby, NPC, settlement, chat
- Music catalog: `musicTracks`, `musicPlaylists`, `musicChannels` (loudness)
- Audio files — Firebase Storage

**Only live playback state** routes through the Worker.

---

## Architecture

```
SPA (GitHub Pages)
  └── MusicSyncProvider
        ├── Firestore (always): tracks, playlists, loudness (catalog)
        └── workers mode: WebSocket → CF Worker → GameRoom DO per gameId
              ├── hello + Firebase ID token → JWT verify → welcome + playback snapshot
              ├── cmd (GM only): play/pause/seek/skip/setTrackVolume → broadcast state
              ├── ping → pong  (clock offset measurement)
              └── alarm: playlist auto-advance without GM tab open
```

---

## WebSocket Protocol

Defined in `server/src/protocol.ts`. Client-side mirror: `src/types/musicSync.ts`.

| Direction | Type | Key fields |
|---|---|---|
| C→S | `hello` | `{ gameId, token }` |
| S→C | `welcome` | `{ role, serverTimeMs, revision, playback }` |
| C→S | `ping` | `{ clientTimeMs }` |
| S→C | `pong` | `{ serverTimeMs }` |
| C→S | `cmd` | `{ action, channel, payload }` — GM only |
| S→C | `state` | `{ revision, serverTimeMs, playback }` |
| S→C | `error` | `{ code, message }` |

**Actions**: `play | pause | seek | skip | setTrackVolume`

**Clock sync**: client computes `clockOffset = serverTimeMs - Date.now()` from pong, applies when computing playhead position (`computePositionMs`).

---

## Environment Variables

### Frontend (GitHub Pages secrets)

| Variable | Example | Notes |
|---|---|---|
| `VITE_MUSIC_SYNC` | `workers` | `firestore` (default) to use legacy Firestore path |
| `VITE_MUSIC_SYNC_URL` | `wss://zombie-sheet-sync.<acct>.workers.dev` | Required when mode=workers |

### Worker (set via `wrangler secret put`)

| Secret | Content |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project ID string |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full service account JSON (one line) — needs Firestore read access |

---

## Rollback

```bash
# Set in GitHub Pages → Settings → Secrets and variables → Actions
VITE_MUSIC_SYNC=firestore

# Then trigger a Pages rebuild (push or workflow_dispatch)
```

The Worker continues running but receives no connections (hibernates → no cost).

---

## CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| `.github/workflows/deploy.yml` | push to master (excluding `server/**`) | Build & deploy frontend to GitHub Pages |
| `.github/workflows/deploy-api.yml` | push to master with `server/**` changes | `npm ci && wrangler deploy` in `server/` |

**Required GitHub Secrets for API workflow:**
- `CLOUDFLARE_API_TOKEN` — Wrangler-compatible CF API token
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

---

## Free Tier Limits (Workers Free)

| Resource | Free limit | Session estimate |
|---|---|---|
| Requests | 100k/day | Tiny (WebSocket upgrade = 1 req/client/session) |
| Duration (GB-s) | 13k/day | ~0 with Hibernation API |
| DO storage | 5 GB | <1 KB per game room |
| DO reads/writes | 1M/day | Few per command |

WS messages are billed at 20:1 ratio (20 incoming = 1 request unit). A 4-hour session with 5 clients sending a ping every 5s = ~14k WS messages = ~700 request-equivalent units. Well within limits.

Upgrade to Workers Paid ($5/mo) if `exceededMemory` or hard-stop errors appear.

---

## Local Development

```bash
# 1. Copy and fill secrets
cp server/.dev.vars.example server/.dev.vars

# 2. Start Worker locally
cd server && npm run dev
# → http://localhost:8787/health
# → ws://localhost:8787/ws/:gameId

# 3. Frontend with workers mode
echo "VITE_MUSIC_SYNC=workers\nVITE_MUSIC_SYNC_URL=ws://localhost:8787" >> .env.local
npm run dev

# 4. Smoke-test WebSocket (requires `ws` package or Node 22+)
node scripts/ws-test.mjs test-game <firebase-id-token>
```

---

## Key Files

| File | Role |
|---|---|
| `server/src/index.ts` | Worker entrypoint, routes `/health` and `/ws/:gameId` |
| `server/src/GameRoom.ts` | Durable Object — state machine for 3 channels, WS hibernation, alarm |
| `server/src/auth.ts` | Firebase JWT verify + Firestore role check via service account |
| `server/src/protocol.ts` | Master copy of WS message types |
| `server/src/musicHelpers.ts` | Pure helpers (computePositionMs, nextPlaylistIndex) — server-side mirror |
| `server/src/firestoreMirror.ts` | Best-effort PATCH to Firestore on state changes |
| `src/types/musicSync.ts` | Client-side copy of protocol types (keep in sync with server) |
| `src/utils/musicSyncClient.ts` | WS connection manager (connect, ping, reconnect, sendCmd) |
| `src/contexts/MusicSyncContext.tsx` | Dual-mode provider (firestore/workers branch) |
| `src/config/features.ts` | `FEATURES.musicSync` flag |
| `src/components/music/SyncDisconnectedBanner.tsx` | Toast shown when WS is retrying |
