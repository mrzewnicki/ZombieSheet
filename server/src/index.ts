/**
 * Cloudflare Worker entrypoint — zombie-sheet-sync
 *
 * Routes:
 *   GET  /health           → 200 "ok"
 *   GET  /ws/:gameId       → WebSocket upgrade → GameRoom DO
 */

import { GameRoom } from './GameRoom.js'

export { GameRoom }

export interface Env {
  GAME_ROOM: DurableObjectNamespace
  FIREBASE_PROJECT_ID: string
  FIREBASE_SERVICE_ACCOUNT_JSON: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // ── CORS preflight ───────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(new Response(null, { status: 204 }))
    }

    // ── Health check ─────────────────────────────────────────────────────────
    if (url.pathname === '/health') {
      return corsResponse(new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    }

    // ── WebSocket upgrade → GameRoom per gameId ───────────────────────────────
    const wsMatch = url.pathname.match(/^\/ws\/([^/]+)$/)
    if (wsMatch) {
      const gameId = wsMatch[1]
      if (!gameId) return new Response('Missing gameId', { status: 400 })

      const upgradeHeader = request.headers.get('Upgrade')
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 })
      }

      // Route to the singleton DO for this gameId
      const id = env.GAME_ROOM.idFromName(gameId)
      const room = env.GAME_ROOM.get(id)
      return room.fetch(request)
    }

    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>

function corsResponse(res: Response): Response {
  const headers = new Headers(res.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return new Response(res.body, {
    status: res.status,
    headers,
  })
}
