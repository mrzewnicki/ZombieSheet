/**
 * WebSocket protocol types for music sync — client-side mirror of server/src/protocol.ts.
 *
 * Keep in sync with server/src/protocol.ts when protocol changes.
 */

export type SyncMusicChannel = 'ambient' | 'music' | 'effects'
export type SyncPlaybackStatus = 'idle' | 'playing' | 'paused'
export type SyncLoopMode = 'off' | 'track' | 'playlist'
export type SyncSource = 'track' | 'playlist'
export type SyncClientRole = 'gm' | 'player'

/** Server-side representation of one channel's playback state */
export interface SyncChannelState {
  channel: SyncMusicChannel
  status: SyncPlaybackStatus
  source: SyncSource
  trackId: string
  playlistId?: string
  playlistIndex?: number
  trackIds?: string[]
  loopMode: SyncLoopMode
  trackVolume: number
  positionMs: number
  /** Server epoch ms when playing started; null when paused/idle */
  startedAtMs: number | null
  durationMs?: number
}

export type SyncPlaybackSnapshot = Record<SyncMusicChannel, SyncChannelState>

// ─── Client → Server ──────────────────────────────────────────────────────────

export interface HelloMsg {
  type: 'hello'
  gameId: string
  token: string
}

export interface PingMsg {
  type: 'ping'
  clientTimeMs: number
}

export type SyncCmdAction = 'play' | 'pause' | 'seek' | 'skip' | 'setTrackVolume'

export interface PlayCmdPayload {
  trackId: string
  source: SyncSource
  loopMode: SyncLoopMode
  trackVolume: number
  playlistId?: string
  playlistIndex?: number
  trackIds?: string[]
  durationMs?: number
}

export interface PauseCmdPayload {
  positionMs: number
}

export interface SeekCmdPayload {
  positionMs: number
}

export interface SkipCmdPayload {
  delta: 1 | -1
}

export interface SetTrackVolumeCmdPayload {
  trackVolume: number
}

export type SyncCmdPayload =
  | PlayCmdPayload
  | PauseCmdPayload
  | SeekCmdPayload
  | SkipCmdPayload
  | SetTrackVolumeCmdPayload

export interface CmdMsg {
  type: 'cmd'
  action: SyncCmdAction
  channel: SyncMusicChannel
  payload: SyncCmdPayload
}

export type ClientMsg = HelloMsg | PingMsg | CmdMsg

// ─── Server → Client ──────────────────────────────────────────────────────────

export interface WelcomeMsg {
  type: 'welcome'
  role: SyncClientRole
  serverTimeMs: number
  revision: number
  playback: SyncPlaybackSnapshot
}

export interface PongMsg {
  type: 'pong'
  serverTimeMs: number
}

export interface StateMsg {
  type: 'state'
  revision: number
  serverTimeMs: number
  playback: SyncPlaybackSnapshot
}

export interface ErrorMsg {
  type: 'error'
  code: string
  message: string
}

export type ServerMsg = WelcomeMsg | PongMsg | StateMsg | ErrorMsg
