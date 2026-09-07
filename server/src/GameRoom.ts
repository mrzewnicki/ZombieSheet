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

/**
 * After the last client disconnects, wait this long before forcing idle.
 * Covers brief WS reconnects without killing a live session.
 */
const EMPTY_SESSION_STOP_MS = 45_000

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
  /** Absolute time when empty-session stop should fire (null = not armed) */
  private emptyStopDueAt: number | null = null
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
  async webSocketClose(ws: WebSocket): Promise<void> {
    this.socketMeta.delete(ws)
    await this.maybeScheduleEmptyStop()
  }

  /** Hibernation handler — error on a socket */
  async webSocketError(ws: WebSocket): Promise<void> {
    this.socketMeta.delete(ws)
    await this.maybeScheduleEmptyStop()
  }

  /**
   * Alarm handler — either empty-session stop or playlist auto-advance.
   * DO has a single alarm; scheduleNextAlarm() picks the earliest due event.
   */
  async alarm(): Promise<void> {
    const now = Date.now()

    if (this.emptyStopDueAt != null && now >= this.emptyStopDueAt - 50) {
      if (this.authenticatedSocketCount() === 0) {
        await this.stopAllForEmptySession()
        return
      }
      // Someone reconnected — cancel empty stop and continue to playlist if needed
      this.emptyStopDueAt = null
      await this.state.storage.delete('emptyStopDueAt')
    }

    if (!this.alarmChannel) {
      await this.scheduleNextAlarm()
      return
    }
    const channel = this.alarmChannel
    const state = this.channelStates[channel]
    if (state.status !== 'playing') {
      this.alarmChannel = null
      await this.scheduleNextAlarm()
      return
    }

    const trackIds = state.trackIds ?? []
    const currentIndex = state.playlistIndex ?? 0
    const nextIdx = nextPlaylistIndex(trackIds, currentIndex, state.loopMode)

    if (nextIdx === null) {
      // End of playlist — go idle
      this.channelStates[channel] = idleChannelState(channel)
      this.alarmChannel = null
    } else {
      const nextTrackId = trackIds[nextIdx] ?? ''
      this.channelStates[channel] = {
        ...state,
        trackId: nextTrackId,
        playlistIndex: nextIdx,
        positionMs: 0,
        startedAtMs: now,
        durationMs: undefined,
      }
      // durationMs unknown for next track until a client sends play — no playlist alarm
      this.alarmChannel = null
    }

    this.revision++
    await this.persistState()
    this.broadcast({
      type: 'state',
      revision: this.revision,
      serverTimeMs: Date.now(),
      playback: this.channelStates,
    })
    void this.mirrorToFirestore(channel)
    await this.scheduleNextAlarm()
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
      console.log('[GameRoom] hello auth ok', { uid, gameId, projectId })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Auth failed'
      console.error('[GameRoom] AUTH_FAILED', message)
      this.sendTo(ws, {
        type: 'error',
        code: 'AUTH_FAILED',
        message,
      })
      ws.close(4001, 'Unauthorized')
      return
    }

    // Resolve role (GM or player)
    let role: ClientRole | null = null
    try {
      if (!saJson) {
        console.error('[GameRoom] SERVER_MISCONFIG missing SA')
        this.sendTo(ws, {
          type: 'error',
          code: 'SERVER_MISCONFIG',
          message: 'FIREBASE_SERVICE_ACCOUNT_JSON is not configured',
        })
        ws.close(1011, 'Misconfigured')
        return
      }
      role = await resolveRole(uid, gameId, projectId, saJson)
      console.log('[GameRoom] role', { uid, role })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Role check failed'
      console.error('[GameRoom] ROLE_CHECK_FAILED', message)
      this.sendTo(ws, {
        type: 'error',
        code: 'ROLE_CHECK_FAILED',
        message,
      })
      ws.close(1011, 'Role check failed')
      return
    }

    if (role === null) {
      this.sendTo(ws, { type: 'error', code: 'NOT_MEMBER', message: 'Not a game member' })
      ws.close(4003, 'Not a member')
      return
    }

    this.socketMeta.set(ws, { uid, role })
    try {
      ws.serializeAttachment({ uid, role })
    } catch {
      /* older runtime / attachment unavailable */
    }

    // A live client is present — cancel any pending empty-session stop
    await this.clearEmptyStop()

    this.sendTo(ws, {
      type: 'welcome',
      role,
      serverTimeMs: Date.now(),
      revision: this.revision,
      playback: this.channelStates,
    })
  }

  private async handleCmd(ws: WebSocket, msg: CmdMsg): Promise<void> {
    let meta = this.socketMeta.get(ws)
    if (!meta) {
      try {
        const attached = ws.deserializeAttachment() as SocketMeta | null
        if (attached?.uid && attached?.role) {
          meta = attached
          this.socketMeta.set(ws, meta)
        }
      } catch {
        /* no attachment */
      }
    }
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
        const startPos = Math.max(0, Math.trunc(p.positionMs ?? 0))
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
          positionMs: startPos,
          startedAtMs: now,
          durationMs: p.durationMs,
        }
        // Schedule alarm for playlist advance when duration is known
        if (p.source === 'playlist' && typeof p.durationMs === 'number' && p.durationMs > 0) {
          this.alarmChannel = channel
        } else if (this.alarmChannel === channel) {
          this.alarmChannel = null
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
        if (this.alarmChannel === channel) {
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
        // Keep playlist alarm channel so scheduleNextAlarm recomputes remaining time
        if (
          !(current.status === 'playing'
            && current.source === 'playlist'
            && typeof current.durationMs === 'number'
            && current.durationMs - newPos > 0)
          && this.alarmChannel === channel
        ) {
          this.alarmChannel = null
        } else if (
          current.status === 'playing'
          && current.source === 'playlist'
          && typeof current.durationMs === 'number'
          && current.durationMs - newPos > 0
        ) {
          this.alarmChannel = channel
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
    await this.scheduleNextAlarm()
  }

  // ── Empty-session stop ───────────────────────────────────────────────────────

  private hasActivePlayback(): boolean {
    return MUSIC_CHANNELS.some((ch) => {
      const status = this.channelStates[ch].status
      return status === 'playing' || status === 'paused'
    })
  }

  /** Count sockets that completed hello (uid attached). */
  private authenticatedSocketCount(): number {
    let count = 0
    for (const ws of this.state.getWebSockets()) {
      if (this.socketMeta.has(ws)) {
        count++
        continue
      }
      try {
        const attached = ws.deserializeAttachment() as SocketMeta | null
        if (attached?.uid && attached?.role) {
          this.socketMeta.set(ws, attached)
          count++
        }
      } catch {
        /* no attachment yet */
      }
    }
    return count
  }

  private async maybeScheduleEmptyStop(): Promise<void> {
    if (this.authenticatedSocketCount() > 0) return
    if (!this.hasActivePlayback()) {
      await this.clearEmptyStop()
      return
    }
    this.emptyStopDueAt = Date.now() + EMPTY_SESSION_STOP_MS
    await this.state.storage.put('emptyStopDueAt', this.emptyStopDueAt)
    console.log('[GameRoom] empty session stop armed', {
      gameId: this.gameId,
      dueAt: this.emptyStopDueAt,
    })
    await this.scheduleNextAlarm()
  }

  private async clearEmptyStop(): Promise<void> {
    if (this.emptyStopDueAt == null) return
    this.emptyStopDueAt = null
    await this.state.storage.delete('emptyStopDueAt')
    await this.scheduleNextAlarm()
  }

  private async stopAllForEmptySession(): Promise<void> {
    const changed: MusicChannel[] = []
    for (const ch of MUSIC_CHANNELS) {
      const status = this.channelStates[ch].status
      if (status === 'playing' || status === 'paused') {
        this.channelStates[ch] = idleChannelState(ch)
        changed.push(ch)
      }
    }
    this.alarmChannel = null
    this.emptyStopDueAt = null
    await this.state.storage.delete('emptyStopDueAt')
    await this.state.storage.deleteAlarm()

    if (changed.length === 0) return

    this.revision++
    await this.persistState()
    this.broadcast({
      type: 'state',
      revision: this.revision,
      serverTimeMs: Date.now(),
      playback: this.channelStates,
    })
    console.log('[GameRoom] stopped playback — empty session', {
      gameId: this.gameId,
      channels: changed,
    })
    for (const ch of changed) {
      void this.mirrorToFirestore(ch)
    }
  }

  /** Earliest absolute time for the current playlist alarm, if any. */
  private playlistAlarmDueAt(now = Date.now()): number | null {
    if (!this.alarmChannel) return null
    const state = this.channelStates[this.alarmChannel]
    if (state.status !== 'playing') return null
    if (!(typeof state.durationMs === 'number' && state.durationMs > 0)) return null
    const pos = computePositionMs(state, now)
    const remaining = state.durationMs - pos
    if (remaining <= 0) return now + 1
    return now + remaining
  }

  /**
   * Single DO alarm for both playlist advance and empty-session stop.
   * Always call after mutating alarmChannel / emptyStopDueAt.
   */
  private async scheduleNextAlarm(): Promise<void> {
    const candidates: number[] = []
    if (this.emptyStopDueAt != null) candidates.push(this.emptyStopDueAt)
    const playlistDue = this.playlistAlarmDueAt()
    if (playlistDue != null) candidates.push(playlistDue)

    if (candidates.length === 0) {
      await this.state.storage.deleteAlarm()
      return
    }
    await this.state.storage.setAlarm(Math.min(...candidates))
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
    const emptyDue = await this.state.storage.get<number>('emptyStopDueAt')
    if (typeof emptyDue === 'number' && Number.isFinite(emptyDue)) {
      this.emptyStopDueAt = emptyDue
    }
    const gid = await this.state.storage.get<string>('gameId')
    if (gid) this.gameId = gid
    // Re-arm the single DO alarm after wake (playlist and/or empty-session)
    await this.scheduleNextAlarm()
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
