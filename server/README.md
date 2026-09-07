# zombie-sheet-sync — Cloudflare Workers backend

Sync engine for ZombieSheet session music. Provides WebSocket rooms (one Durable Object per `gameId`) that act as a shared metronome — all clients hear play/pause/seek at the same server-anchored position.

Firebase handles auth, game data, track catalog, and audio file storage. This Worker handles only live playback state.

## Prerequisites

- Node 20+, npm
- Cloudflare account (free tier — Durable Objects available on Workers Free)

## Setup (one-time)

```bash
# Install dependencies
npm install

# Log in to Cloudflare (opens browser)
npx wrangler login

# First deploy (creates the DO namespace in your account)
npm run deploy
```

## Secrets

```bash
npx wrangler secret put FIREBASE_PROJECT_ID
# value: your Firebase project ID (e.g. zombie-sheet-abc12)

npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
# value: full JSON of a Firebase service account key (one line, paste when prompted)
```

Service account needs **Firestore → Cloud Datastore User** role (read-only is enough for auth checks).

## Local development

```bash
npm run dev
# Worker runs at http://localhost:8787
# WS endpoint: ws://localhost:8787/ws/:gameId
# Health: http://localhost:8787/health
```

## Deploy

```bash
npm run deploy
# Deploys to https://zombie-sheet-sync.<account>.workers.dev
```

CI deploys automatically on push to `master` when files under `server/` change (see `.github/workflows/deploy-api.yml`).

## Limits (Workers Free)

| Resource | Free limit | Typical session |
|---|---|---|
| Requests | 100k/day | ~few dozen connections + messages |
| Duration | 13k GB-s/day | ≈0 with Hibernation API |
| DO storage | 5 GB | <1 KB per game room |

WebSocket Hibernation means the DO is not billed for duration while clients are idle. Messages are billed at 20:1 ratio (20 incoming = 1 request). Upgrade to Workers Paid ($5/mo) when hard-stop errors appear.

## Rollback

Set `VITE_MUSIC_SYNC=firestore` in GitHub Pages secrets → rebuild frontend. Worker stays deployed and harmless (hibernates when no clients connect).

## Architecture

```
SPA (GitHub Pages)
  └── MusicSyncProvider
        ├── Firestore: tracks, playlists, loudness (catalog, read-only for players)
        └── WebSocket → Worker → GameRoom DO
              ├── hello + Firebase ID token → verify → welcome
              ├── cmd (GM): play/pause/seek/skip/setTrackVolume → broadcast state
              ├── ping → pong (clock sync)
              └── alarm: playlist advance without GM tab open
```

## WS protocol

See `src/protocol.ts` for full type definitions. Client mirror: `src/types/musicSync.ts` in the frontend repo — keep in sync when protocol changes.
