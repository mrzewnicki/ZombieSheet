/**
 * Feature flags driven by Vite env variables.
 *
 * VITE_CHAT_ENABLED=true        — shows the chat sidebar with the message list.
 * VITE_CHAT_INPUT_ENABLED=true  — shows the input area so users can type messages.
 *                                  Requires VITE_CHAT_ENABLED=true to have any effect.
 *                                  When false, only system-generated messages (dice rolls etc.)
 *                                  can appear; the list is read-only for all users.
 *
 * VITE_MUSIC_SYNC=workers       — use Cloudflare Workers WebSocket for live playback sync.
 *                                  Default: 'firestore' (existing Firestore onSnapshot path).
 * VITE_MUSIC_SYNC_URL            — WSS URL for the sync Worker, e.g.
 *                                  wss://zombie-sheet-sync.<account>.workers.dev
 *                                  Required when VITE_MUSIC_SYNC=workers.
 */
export const FEATURES = {
  chat: import.meta.env.VITE_CHAT_ENABLED === 'true',
  chatInput: import.meta.env.VITE_CHAT_INPUT_ENABLED === 'true',
  musicSync: (import.meta.env.VITE_MUSIC_SYNC ?? 'firestore') as 'firestore' | 'workers',
  musicSyncUrl: import.meta.env.VITE_MUSIC_SYNC_URL as string | undefined,
} as const
