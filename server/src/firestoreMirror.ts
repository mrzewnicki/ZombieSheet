/**
 * Mirror playback state to Firestore on pause / periodically.
 * Gives new clients a "last known state" before WS reconnects.
 * This is a cache — NOT the source of truth.
 */

import type { ChannelState, MusicChannel } from './protocol.js'

let saTokenCache = { token: '', expiresAt: 0 }

async function getToken(saJson: string): Promise<string> {
  const now = Date.now()
  if (saTokenCache.token && saTokenCache.expiresAt > now + 60_000) return saTokenCache.token

  // Minimal service account JWT for Firestore scope
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string }
  const iat = Math.floor(now / 1000)
  const exp = iat + 3600
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const headerB64 = encode({ alg: 'RS256', typ: 'JWT' })
  const claimB64 = encode({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat,
  })
  const sigInput = `${headerB64}.${claimB64}`

  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const der = Uint8Array.from(atob(pemBody.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  )
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(sigInput),
  )
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  const jwt = `${sigInput}.${sigB64}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = (await res.json()) as { access_token: string; expires_in: number }
  saTokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 }
  return saTokenCache.token
}

function toFirestoreValue(v: unknown): unknown {
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'number') return { integerValue: String(Math.trunc(v)) }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (v === null || v === undefined) return { nullValue: null }
  return { stringValue: String(v) }
}

function channelToFirestoreFields(state: ChannelState): Record<string, unknown> {
  return {
    status: toFirestoreValue(state.status),
    source: toFirestoreValue(state.source),
    trackId: toFirestoreValue(state.trackId),
    playlistId: toFirestoreValue(state.playlistId ?? null),
    playlistIndex: toFirestoreValue(state.playlistIndex ?? null),
    loopMode: toFirestoreValue(state.loopMode),
    trackVolume: toFirestoreValue(state.trackVolume),
    positionMs: toFirestoreValue(state.positionMs),
    startedAt: { nullValue: null }, // WS-managed sessions don't write Timestamps
    updatedBy: toFirestoreValue('server'),
  }
}

/**
 * PATCH musicPlayback/{channel} in Firestore.
 * The gameId is stored in the DO via alarm/storage; for mirror we need it.
 * We encode it into the storage key on first play and retrieve it here.
 *
 * NOTE: gameId must be passed from GameRoom which knows it from the WS URL.
 */
export default async function mirrorChannelToFirestore(
  channel: MusicChannel,
  state: ChannelState,
  projectId: string,
  saJson: string,
  gameId?: string,
): Promise<void> {
  if (!projectId || !saJson || !gameId) return
  try {
    const token = await getToken(saJson)
    const path = `games/${gameId}/musicPlayback/${channel}`
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`
    await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: channelToFirestoreFields(state) }),
    })
  } catch {
    // Mirror is best-effort — never throw
  }
}
