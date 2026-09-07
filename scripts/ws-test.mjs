/**
 * Manual WS smoke-test for GameRoom (Etap 1).
 * Run against: npm run dev (in server/)
 *
 * Usage:
 *   node scripts/ws-test.mjs [gameId] [token]
 *
 * Without a real Firebase token the server will reject hello with AUTH_FAILED.
 * Set SKIP_AUTH=1 to run against a local wrangler.dev build that has auth disabled.
 */

import { WebSocket } from 'ws'

const GAME_ID = process.argv[2] ?? 'test-game'
const TOKEN = process.argv[3] ?? 'dev-token'
const WS_URL = `ws://localhost:8787/ws/${GAME_ID}`

let clientCount = 0

function makeClient(label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)

    ws.on('open', () => {
      console.log(`[${label}] connected`)
      ws.send(JSON.stringify({ type: 'hello', gameId: GAME_ID, token: TOKEN }))
    })

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString())
      console.log(`[${label}] ←`, JSON.stringify(msg, null, 2))

      if (msg.type === 'welcome' || msg.type === 'error') {
        clientCount++
        resolve({ ws, msg })
      }
    })

    ws.on('error', reject)
  })
}

async function run() {
  console.log('=== ws-test connecting to', WS_URL)

  // Check health first
  const health = await fetch('http://localhost:8787/health')
  console.log('health:', health.status, await health.text())

  const client1 = await makeClient('client1')
  const client2 = await makeClient('client2')

  // Send ping from client1
  console.log('\n[client1] sending ping')
  client1.ws.send(JSON.stringify({ type: 'ping', clientTimeMs: Date.now() }))

  await new Promise((r) => setTimeout(r, 200))

  // GM play command (will be rejected without real GM token)
  console.log('\n[client1] sending play cmd')
  client1.ws.send(
    JSON.stringify({
      type: 'cmd',
      action: 'play',
      channel: 'music',
      payload: {
        trackId: 'track-abc',
        source: 'track',
        loopMode: 'off',
        trackVolume: 0.8,
      },
    }),
  )

  await new Promise((r) => setTimeout(r, 500))
  console.log('\n=== done')
  client1.ws.close()
  client2.ws.close()
}

run().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
