/**
 * WebSocket client for the zombie-sheet-sync Worker.
 *
 * Manages the full lifecycle:
 *   connect → hello → receive state/welcome/pong → auto-reconnect
 *
 * Usage:
 *   const client = new MusicSyncClient({ ... })
 *   client.connect()
 *   client.on('state', (snapshot, serverTimeMs) => { ... })
 *   client.sendCmd({ action: 'play', channel: 'music', payload: { ... } })
 *   client.close()
 */

import type {
  CmdMsg,
  ServerMsg,
  SyncCmdAction,
  SyncCmdPayload,
  SyncMusicChannel,
  SyncPlaybackSnapshot,
  SyncClientRole,
} from '@/types/musicSync'

export interface MusicSyncClientOptions {
  baseUrl: string
  gameId: string
  /** Returns a fresh Firebase ID token */
  getToken: () => Promise<string>
  onState: (snapshot: SyncPlaybackSnapshot, serverTimeMs: number, revision: number) => void
  onRole: (role: SyncClientRole) => void
  onError?: (err: string) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

const PING_INTERVAL_MS = 5_000
const RECONNECT_BACKOFF = [1000, 2000, 4000, 8000, 16000, 30000]
const MAX_RECONNECT_ATTEMPTS = 8

export class MusicSyncClient {
  private readonly opts: MusicSyncClientOptions
  private ws: WebSocket | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private closed = false

  /** Best estimate of server clock offset: serverTime = Date.now() + clockOffset */
  clockOffset = 0

  constructor(opts: MusicSyncClientOptions) {
    this.opts = opts
  }

  connect(): void {
    this.closed = false
    this.reconnectAttempt = 0
    this._connect()
  }

  close(): void {
    this.closed = true
    this._clearTimers()
    if (this.ws) {
      this.ws.close(1000, 'client close')
      this.ws = null
    }
  }

  sendCmd(action: SyncCmdAction, channel: SyncMusicChannel, payload: SyncCmdPayload): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const msg: CmdMsg = { type: 'cmd', action, channel, payload }
    this.ws.send(JSON.stringify(msg))
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _connect(): void {
    if (this.closed) return
    const url = `${this.opts.baseUrl}/ws/${encodeURIComponent(this.opts.gameId)}`

    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch (err) {
      this._scheduleReconnect()
      return
    }

    this.ws = ws

    ws.addEventListener('open', () => {
      this.reconnectAttempt = 0
      this._sendHello()
      this._startPing()
      this.opts.onConnected?.()
    })

    ws.addEventListener('message', (event) => {
      let msg: ServerMsg
      try {
        msg = JSON.parse(event.data as string) as ServerMsg
      } catch {
        return
      }
      this._handleMessage(msg)
    })

    ws.addEventListener('close', () => {
      this._clearTimers()
      this.ws = null
      this.opts.onDisconnected?.()
      this._scheduleReconnect()
    })

    ws.addEventListener('error', () => {
      // close event fires right after — reconnect is handled there
    })
  }

  private async _sendHello(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    try {
      const token = await this.opts.getToken()
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
      this.ws.send(JSON.stringify({
        type: 'hello',
        gameId: this.opts.gameId,
        token,
      }))
    } catch {
      this.ws?.close()
    }
  }

  private _startPing(): void {
    this._clearPing()
    this.pingTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
      this.ws.send(JSON.stringify({ type: 'ping', clientTimeMs: Date.now() }))
    }, PING_INTERVAL_MS)
  }

  private _handleMessage(msg: ServerMsg): void {
    switch (msg.type) {
      case 'welcome':
        this.clockOffset = msg.serverTimeMs - Date.now()
        this.opts.onRole(msg.role)
        this.opts.onState(msg.playback, msg.serverTimeMs, msg.revision)
        break

      case 'state':
        this.opts.onState(msg.playback, msg.serverTimeMs, msg.revision)
        break

      case 'pong': {
        // Simple one-way offset: serverTime ≈ Date.now() + offset
        // RTT/2 correction is acceptable given small ping interval
        this.clockOffset = msg.serverTimeMs - Date.now()
        break
      }

      case 'error':
        this.opts.onError?.(`[${msg.code}] ${msg.message}`)
        break
    }
  }

  private _scheduleReconnect(): void {
    if (this.closed) return
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.opts.onError?.('sync_unavailable')
      return
    }
    const delay = RECONNECT_BACKOFF[Math.min(this.reconnectAttempt, RECONNECT_BACKOFF.length - 1)] ?? 30000
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => {
      this._connect()
    }, delay)
  }

  private _clearTimers(): void {
    this._clearPing()
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private _clearPing(): void {
    if (this.pingTimer != null) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }
}
