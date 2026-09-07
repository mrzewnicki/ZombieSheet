/**
 * WebSocket protocol contract shared between server (GameRoom DO)
 * and client (src/types/musicSync.ts — keep in sync manually).
 *
 * Convention: C→S = client-to-server, S→C = server-to-client.
 */

export type MusicChannel = 'ambient' | 'music' | 'effects'
export type MusicPlaybackStatus = 'idle' | 'playing' | 'paused'
export type MusicLoopMode = 'off' | 'track' | 'playlist'
export type MusicSource = 'track' | 'playlist'
export type ClientRole = 'gm' | 'player'

/** State of one mix channel — mirrors MusicPlaybackState but uses epoch ms instead of Firestore Timestamp */
export interface ChannelState {
  channel: MusicChannel
  status: MusicPlaybackStatus
  source: MusicSource
  trackId: string
  playlistId?: string
  playlistIndex?: number
  /** Ordered track IDs sent by GM on play — kept in DO for server-side advance */
  trackIds?: string[]
  loopMode: MusicLoopMode
  trackVolume: number
  positionMs: number
  /** Server epoch ms when playing started; null when paused/idle */
  startedAtMs: number | null
  /** Track duration (ms) — required for server-side alarm advance */
  durationMs?: number
}

export type PlaybackSnapshot = Record<MusicChannel, ChannelState>

// ─── Client → Server ──────────────────────────────────────────────────────────

/** First message after WS connect; must be sent before any cmd */
export interface HelloMsg {
  type: 'hello'
  gameId: string
  token: string
}

/** Heartbeat — client sends periodically to measure clock offset */
export interface PingMsg {
  type: 'ping'
  clientTimeMs: number
}

/** Playback command — GM only */
export interface CmdMsg {
  type: 'cmd'
  action: CmdAction
  channel: MusicChannel
  payload: CmdPayload
}

export type CmdAction = 'play' | 'pause' | 'seek' | 'skip' | 'setTrackVolume'

export interface PlayPayload {
  trackId: string
  source: MusicSource
  loopMode: MusicLoopMode
  trackVolume: number
  /** Required when source=playlist */
  playlistId?: string
  playlistIndex?: number
  /** Full ordered trackIds — required when source=playlist for server-side advance */
  trackIds?: string[]
  durationMs?: number
  /** Resume from this position (default 0) */
  positionMs?: number
}

export interface PausePayload {
  /** Client-computed positionMs snapshot at time of pause */
  positionMs: number
}

export interface SeekPayload {
  positionMs: number
}

export interface SkipPayload {
  delta: 1 | -1
}

export interface SetTrackVolumePayload {
  trackVolume: number
}

export type CmdPayload =
  | PlayPayload
  | PausePayload
  | SeekPayload
  | SkipPayload
  | SetTrackVolumePayload

export type ClientMsg = HelloMsg | PingMsg | CmdMsg

// ─── Server → Client ──────────────────────────────────────────────────────────

/** Sent after successful hello; includes full current playback snapshot */
export interface WelcomeMsg {
  type: 'welcome'
  role: ClientRole
  serverTimeMs: number
  revision: number
  playback: PlaybackSnapshot
}

/** Reply to ping */
export interface PongMsg {
  type: 'pong'
  serverTimeMs: number
}

/** Broadcast after any state change */
export interface StateMsg {
  type: 'state'
  revision: number
  serverTimeMs: number
  playback: PlaybackSnapshot
}

/** Error reply */
export interface ErrorMsg {
  type: 'error'
  code: string
  message: string
}

export type ServerMsg = WelcomeMsg | PongMsg | StateMsg | ErrorMsg
