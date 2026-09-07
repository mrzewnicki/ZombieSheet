/**
 * Firebase ID token verification + Firestore role check.
 *
 * Uses only fetch (no Firebase Admin SDK — runs in Workers runtime).
 * JWKS is cached in-memory for the DO lifetime (re-fetched on expiry).
 */

export type ClientRole = 'gm' | 'player'

interface JwkKey {
  kid: string
  n: string
  e: string
  alg: string
  use: string
}

interface JwksCache {
  keys: Map<string, CryptoKey>
  expiresAt: number
}

// Module-level cache shared across all GameRoom instances in the same isolate
let jwksCache: JwksCache | null = null

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

async function getJwks(): Promise<Map<string, CryptoKey>> {
  const now = Date.now()
  if (jwksCache && jwksCache.expiresAt > now) return jwksCache.keys

  const res = await fetch(JWKS_URL)
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`)

  const cacheControl = res.headers.get('Cache-Control') ?? ''
  const maxAgeMatch = /max-age=(\d+)/.exec(cacheControl)
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3_600_000

  const json = (await res.json()) as { keys: JwkKey[] }
  const keys = new Map<string, CryptoKey>()

  for (const jwk of json.keys) {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk as unknown as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    keys.set(jwk.kid, key)
  }

  jwksCache = { keys, expiresAt: now + maxAge }
  return keys
}

function base64ToUint8(b64: string): Uint8Array {
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (normalized.length % 4)) % 4
  const padded = normalized + '='.repeat(padLen)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

interface JwtPayload {
  sub: string
  aud: string
  exp: number
  iat: number
}

/**
 * Verify a Firebase ID token.
 * Returns the decoded payload (sub = uid) or throws on failure.
 */
export async function verifyFirebaseToken(
  token: string,
  projectId: string,
): Promise<JwtPayload> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')

  const [headerB64, payloadB64, sigB64] = parts as [string, string, string]

  const header = JSON.parse(new TextDecoder().decode(base64ToUint8(headerB64))) as {
    kid: string
    alg: string
  }

  if (header.alg !== 'RS256') throw new Error('Unexpected algorithm')

  const keys = await getJwks()
  const key = keys.get(header.kid)
  if (!key) throw new Error('Unknown key ID')

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const sig = base64ToUint8(sigB64)

  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    sig,
    signingInput,
  )
  if (!valid) throw new Error('Invalid signature')

  const payload = JSON.parse(
    new TextDecoder().decode(base64ToUint8(payloadB64)),
  ) as JwtPayload

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) throw new Error('Token expired')
  if (payload.aud !== projectId) throw new Error('Wrong audience')

  return payload
}

// ─── Service account OAuth2 ───────────────────────────────────────────────────

interface ServiceAccountJson {
  client_email: string
  private_key: string
}

/** Parse SA JSON from env — supports raw JSON or base64 (safer for .dev.vars). */
export function parseServiceAccountJson(raw: string): ServiceAccountJson {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('Empty service account JSON')

  const tryParse = (s: string): ServiceAccountJson | null => {
    try {
      return JSON.parse(s) as ServiceAccountJson
    } catch {
      return null
    }
  }

  let parsed = tryParse(trimmed)
  if (parsed?.private_key && parsed.client_email) return parsed

  // dotenv sometimes leaves \" escapes
  parsed = tryParse(trimmed.replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
  if (parsed?.private_key && parsed.client_email) return parsed

  // base64-encoded JSON (recommended for .dev.vars)
  try {
    const decoded = atob(trimmed)
    parsed = tryParse(decoded)
    if (parsed?.private_key && parsed.client_email) return parsed
  } catch {
    /* not base64 */
  }

  throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON (expected JSON or base64 JSON)')
}

/** Cache of service account access tokens (module-level, shared per isolate) */
const saTokenCache = {
  token: '',
  expiresAt: 0,
}

async function getServiceAccountToken(saJson: string): Promise<string> {
  const now = Date.now()
  if (saTokenCache.token && saTokenCache.expiresAt > now + 60_000) {
    return saTokenCache.token
  }

  const sa = parseServiceAccountJson(saJson)
  const iat = Math.floor(now / 1000)
  const exp = iat + 3600

  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat,
  }

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const headerB64 = encode(header)
  const claimB64 = encode(claim)
  const sigInput = `${headerB64}.${claimB64}`

  // Import PEM private key
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const der = base64ToUint8(pemBody)

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

  const sigB64 = bytesToBase64Url(sigBytes)

  const jwt = `${sigInput}.${sigB64}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  if (!tokenRes.ok) throw new Error(`SA token error: ${tokenRes.status}`)

  const tokenData = (await tokenRes.json()) as { access_token: string; expires_in: number }
  saTokenCache.token = tokenData.access_token
  saTokenCache.expiresAt = now + tokenData.expires_in * 1000
  return saTokenCache.token
}

// ─── Firestore role check ─────────────────────────────────────────────────────

async function firestoreGet(
  projectId: string,
  path: string,
  accessToken: string,
): Promise<Record<string, unknown> | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Firestore GET ${path} failed: ${res.status}`)
  return (await res.json()) as Record<string, unknown>
}

function getStringField(
  doc: Record<string, unknown>,
  field: string,
): string | null {
  const fields = doc.fields as Record<string, { stringValue?: string }> | undefined
  return fields?.[field]?.stringValue ?? null
}

/**
 * Resolve the role of a user in a game.
 * Returns 'gm' | 'player' | null (null = not a member).
 */
export async function resolveRole(
  uid: string,
  gameId: string,
  projectId: string,
  serviceAccountJson: string,
): Promise<ClientRole | null> {
  const token = await getServiceAccountToken(serviceAccountJson)

  // Check game doc for masterId
  const gameDoc = await firestoreGet(projectId, `games/${gameId}`, token)
  if (!gameDoc) return null // game doesn't exist

  const masterId = getStringField(gameDoc, 'masterId')
  if (masterId === uid) return 'gm'

  // Check members sub-collection
  const memberDoc = await firestoreGet(
    projectId,
    `games/${gameId}/members/${uid}`,
    token,
  )
  if (!memberDoc) return null // not a member

  return 'player'
}
