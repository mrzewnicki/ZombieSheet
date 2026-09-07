/**
 * GameRoom — Durable Object (SQLite-backed, WebSocket Hibernation API).
 *
 * One instance per gameId. Holds live playback state for 3 channels
 * and broadcasts to all connected WebSocket clients.
 */

import type {
  ChannelState,
  ClientMsg,
  CmdMsg,
  MusicChannel,
  PlaybackSnapshot,
  PlayPayload,
  PausePayload,
  SeekPayload,
  SkipPayload,
  SetTrackVolumePayload,
} from './protocol.js'
import {
  idleChannelState,
  computePositionMs,
  nextPlaylistIndex,
  stepPlaylistIndex,
  clampVolume,
} from './musicHelpers.js'
import { verifyFirebaseToken, resolveRole, type ClientRole } from './auth.js'

export interface Env {
  GAME_ROOM: DurableObjectNamespace
  FIREBASE_PROJECT_ID: string
  FIREBASE_SERVICE_ACCOUNT_JSON: string
}

interface SocketMeta {
  uid: string
  role: ClientRole
}

const MUSIC_CHANNELS: MusicChannel[] = ['ambient', 'music', 'effects']

export class GameRoom implements DurableObject {
  private readonly state: DurableObjectState
  private readonly env: Env

  /** In-memory playback state — rebuilt from SQLite on wake-up if needed */
  private channelStates: PlaybackSnapshot
  private revision = 0

  /**
   * Maps WebSocket → metadata.
   * Note: after hibernation the DO is reconstructed; we repopulate from
   * ctx.getWebSockets() in the first handler call.
   */
  private socketMeta = new Map<WebSocket, SocketMeta>()

  /** Per-channel alarm tracking: which channel is awaiting auto-advance */
  private alarmChannel: MusicChannel | null = null
  /** Stored so mirror can write to the right game path */
  private gameId: string | null = null

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.channelStates = {
      ambient: idleChannelState('ambient'),
      music: idleChannelState('music'),
      effects: idleChannelState('effects'),
    }
    // Restore persisted state from SQLite on wake after hibernation
    void this.restoreState()
  }

  // ── Entry point ─────────────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return new Response('ok', { status: 200 })
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket()
    }

    return new Response('Not found', { status: 404 })
  }

  // ── WebSocket (Hibernation API) ──────────────────────────────────────────────

  private handleWebSocket(): Response {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]

    // Hibernation API — DO sleeps between messages → no GB-s cost when idle
    this.state.acceptWebSocket(server)

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  /** Hibernation handler — called when a message arrives from any client */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return

    let msg: ClientMsg
    try {
      msg = JSON.parse(message) as ClientMsg
    } catch {
      this.sendTo(ws, { type: 'error', code: 'PARSE_ERROR', message: 'Invalid JSON' })
      return
    }

    switch (msg.type) {
      case 'hello':
        await this.handleHello(ws, msg.token, msg.gameId)
        break
      case 'ping':
        this.sendTo(ws, { type: 'pong', serverTimeMs: Date.now() })
        break
      case 'cmd':
        await this.handleCmd(ws, msg)
        break
      default:
        this.sendTo(ws, { type: 'error', code: 'UNKNOWN_TYPE', message: 'Unknown message type' })
    }
  }

  /** Hibernation handler — client disconnected */
  webSocketClose(ws: WebSocket): void {
    this.socketMeta.delete(ws)
  }

  /** Hibernation handler — error on a socket */
  webSocketError(ws: WebSocket): void {
    this.socketMeta.delete(ws)
  }

  /** Alarm handler — fires when a track is expected to end (playlist advance) */
  async alarm(): Promise<void> {
    if (!this.alarmChannel) return
    const channel = this.alarmChannel
    const state = this.channelStates[channel]
    if (state.status !== 'playing') return

    const trackIds = state.trackIds ?? []
    const currentIndex = state.playlistIndex ?? 0
    const nextIdx = nextPlaylistIndex(trackIds, currentIndex, state.loopMode)

    if (nextIdx === null) {
      // End of playlist — go idle
      const idle = idleChannelState(channel)
      this.channelStates[channel] = idle
    } else {
      const nextTrackId = trackIds[nextIdx] ?? ''
      this.channelStates[channel] = {
        ...state,
        trackId: nextTrackId,
        playlistIndex: nextIdx,
        positionMs: 0,
        startedAtMs: Date.now(),
      }
      // If we know durationMs for the new track, set another alarm
      // (durationMs is unknown server-side unless passed in play cmd — alarm will be
      // re-set by the next play cmd from GM or not set at all; graceful degradation)
    }

    this.revision++
    await this.persistState()
    this.broadcast({
      type: 'state',
      revision: this.revision,
      serverTimeMs: Date.now(),
      playback: this.channelStates,
    })
    // Mirror to Firestore (alarm advance is a significant state change)
    void this.mirrorToFirestore(channel)
  }

  // ── Message handlers ─────────────────────────────────────────────────────────

  private async handleHello(ws: WebSocket, token: string, gameId: string): Promise<void> {
    // Store gameId for mirror writes
    if (!this.gameId) {
      this.gameId = gameId
      await this.state.storage.put('gameId', gameId)
    }
    const projectId = this.env.FIREBASE_PROJECT_ID
    const saJson = this.env.FIREBASE_SERVICE_ACCOUNT_JSON

    // Verify token
    let uid: string
    try {
      const payload = await verifyFirebaseToken(token, projectId)
      uid = payload.sub
    } catch (err) {
      this.sendTo(ws, {
        type: 'error',
        code: 'AUTH_FAILED',
        message: err instanceof Error ? err.message : 'Auth failed',
      })
      ws.close(4001, 'Unauthorized')
      return
    }

    // Resolve role (GM or player)
    let role: ClientRole | null = null
    try {
      role = await resolveRole(uid, gameId, projectId, saJson)
    } catch {
      // Non-fatal — treat as player if Firestore unreachable
      role = 'player'
    }

    if (role === null) {
      this.sendTo(ws, { type: 'error', code: 'NOT_MEMBER', message: 'Not a game member' })
      ws.close(4003, 'Not a member')
      return
    }

    this.socketMeta.set(ws, { uid, role })

    this.sendTo(ws, {
      type: 'welcome',
      role,
      serverTimeMs: Date.now(),
      revision: this.revision,
      playback: this.channelStates,
    })
  }

  private async handleCmd(ws: WebSocket, msg: CmdMsg): Promise<void> {
    const meta = this.socketMeta.get(ws)
    if (!meta || meta.role !== 'gm') {
      this.sendTo(ws, { type: 'error', code: 'FORBIDDEN', message: 'GM only' })
      return
    }

    const { action, channel, payload } = msg
    const now = Date.now()
    const current = this.channelStates[channel]

    switch (action) {
      case 'play': {
        const p = payload as PlayPayload
        this.channelStates[channel] = {
          channel,
          status: 'playing',
          source: p.source,
          trackId: p.trackId,
          playlistId: p.playlistId,
          playlistIndex: p.playlistIndex,
          trackIds: p.trackIds,
          loopMode: p.loopMode,
          trackVolume: clampVolume(p.trackVolume),
          positionMs: 0,
          startedAtMs: now,
          durationMs: p.durationMs,
        }
        // Schedule alarm for playlist advance when duration is known
        if (p.source === 'playlist' && typeof p.durationMs === 'number' && p.durationMs > 0) {
          this.alarmChannel = channel
          await this.state.storage.setAlarm(now + p.durationMs)
        }
        break
      }

      case 'pause': {
        const p = payload as PausePayload
        this.channelStates[channel] = {
          ...current,
          status: 'paused',
          positionMs: Math.max(0, Math.trunc(p.positionMs)),
          startedAtMs: null,
        }
        // Cancel pending alarm for this channel
        if (this.alarmChannel === channel) {
          await this.state.storage.deleteAlarm()
          this.alarmChannel = null
        }
        // Mirror to Firestore on pause
        void this.mirrorToFirestore(channel)
        break
      }

      case 'seek': {
        const p = payload as SeekPayload
        const newPos = Math.max(0, Math.trunc(p.positionMs))
        this.channelStates[channel] = {
          ...current,
          positionMs: newPos,
          startedAtMs: current.status === 'playing' ? now : null,
        }
        // Update alarm if playing in playlist with known duration
        if (current.status === 'playing' && current.source === 'playlist' && typeof current.durationMs === 'number') {
          const remaining = current.durationMs - newPos
          if (remaining > 0) {
            this.alarmChannel = channel
            await this.state.storage.setAlarm(now + remaining)
          }
        }
        break
      }

      case 'skip': {
        const p = payload as SkipPayload
        const trackIds = current.trackIds ?? []
        const currentIndex = current.playlistIndex ?? 0
        const nextIdx = stepPlaylistIndex(trackIds, currentIndex, p.delta)
        if (nextIdx === null || trackIds.length === 0) break
        const nextTrackId = trackIds[nextIdx] ?? ''
        this.channelStates[channel] = {
          ...current,
          trackId: nextTrackId,
          playlistIndex: nextIdx,
          positionMs: 0,
          startedAtMs: now,
          status: 'playing',
        }
        break
      }

      case 'setTrackVolume': {
        const p = payload as SetTrackVolumePayload
        this.channelStates[channel] = {
          ...current,
          trackVolume: clampVolume(p.trackVolume),
        }
        break
      }

      default:
        this.sendTo(ws, { type: 'error', code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` })
        return
    }

    this.revision++
    await this.persistState()
    this.broadcast({
      type: 'state',
      revision: this.revision,
      serverTimeMs: Date.now(),
      playback: this.channelStates,
    })
    // Mirror updated channel to Firestore for late-joining clients
    void this.mirrorToFirestore(channel)
  }

  // ── State persistence (SQLite via DO storage) ────────────────────────────────

  private async persistState(): Promise<void> {
    await this.state.storage.put('channelStates', JSON.stringify(this.channelStates))
    await this.state.storage.put('revision', this.revision)
    if (this.alarmChannel) {
      await this.state.storage.put('alarmChannel', this.alarmChannel)
    } else {
      await this.state.storage.delete('alarmChannel')
    }
  }

  private async restoreState(): Promise<void> {
    const raw = await this.state.storage.get<string>('channelStates')
    if (raw) {
      try {
        this.channelStates = JSON.parse(raw) as PlaybackSnapshot
      } catch {
        // corrupt state — reset to idle
        for (const ch of MUSIC_CHANNELS) {
          this.channelStates[ch] = idleChannelState(ch)
        }
      }
    }
    const rev = await this.state.storage.get<number>('revision')
    if (typeof rev === 'number') this.revision = rev
    const alarmCh = await this.state.storage.get<MusicChannel>('alarmChannel')
    if (alarmCh) this.alarmChannel = alarmCh
    const gid = await this.state.storage.get<string>('gameId')
    if (gid) this.gameId = gid
  }

  // ── Firestore mirror (on pause / periodic) ───────────────────────────────────

  private async mirrorToFirestore(channel: MusicChannel): Promise<void> {
    const projectId = this.env.FIREBASE_PROJECT_ID
    const saJson = this.env.FIREBASE_SERVICE_ACCOUNT_JSON
    if (!projectId || !saJson || !this.gameId) return

    const { default: mirrorFn } = await import('./firestoreMirror.js')
    await mirrorFn(channel, this.channelStates[channel], projectId, saJson, this.gameId)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private sendTo(ws: WebSocket, msg: unknown): void {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      // socket may be closing
    }
  }

  private broadcast(msg: unknown, exclude?: WebSocket): void {
    for (const ws of this.state.getWebSockets()) {
      if (ws === exclude) continue
      this.sendTo(ws, msg)
    }
  }

  // kept for potential debug use
  private computePosition(channel: MusicChannel): number {
    return computePositionMs(this.channelStates[channel])
  }
}
