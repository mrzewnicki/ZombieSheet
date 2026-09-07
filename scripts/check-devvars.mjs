import fs from 'fs'
import crypto from 'crypto'

const line = fs
  .readFileSync('P:/ZombieSheet/server/.dev.vars', 'utf8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('FIREBASE_SERVICE_ACCOUNT_JSON='))

let v = line.slice('FIREBASE_SERVICE_ACCOUNT_JSON='.length)
if (v.startsWith('"') && v.endsWith('"')) {
  // dotenv-style: unescape \" and \\ only (do NOT turn \n into real newlines before JSON.parse)
  v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

const sa = JSON.parse(v)
console.log('parse_ok', sa.client_email, 'pk_newlines', (sa.private_key.match(/\n/g) || []).length)

const iat = Math.floor(Date.now() / 1000)
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const input =
  enc({ alg: 'RS256', typ: 'JWT' }) +
  '.' +
  enc({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: iat + 3600,
    iat,
  })
const sig = crypto.sign('RSA-SHA256', Buffer.from(input), sa.private_key).toString('base64url')
const jwt = `${input}.${sig}`

const tr = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
})
const tj = await tr.json()
if (!tj.access_token) {
  console.error('token_fail', tj)
  process.exit(1)
}
console.log('token_ok')

const fr = await fetch(
  'https://firestore.googleapis.com/v1/projects/zombiesheet-rpg/databases/(default)/documents/games/Hk7JzbYwDEVLIcRdwrfM',
  { headers: { Authorization: `Bearer ${tj.access_token}` } },
)
console.log('firestore_status', fr.status)
const fj = await fr.json()
console.log('masterId', fj.fields?.masterId?.stringValue ?? JSON.stringify(fj).slice(0, 300))
