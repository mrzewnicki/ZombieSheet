import fs from 'fs'

const sa = fs.readFileSync(
  'c:/Users/mateu/Downloads/zombiesheet-rpg-firebase-adminsdk-fbsvc-cdaecf34c3.json',
  'utf8',
).trim()
// Minify then escape for double-quoted dotenv
const min = JSON.stringify(JSON.parse(sa))
const escaped = min.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
const content = `FIREBASE_PROJECT_ID=zombiesheet-rpg\nFIREBASE_SERVICE_ACCOUNT_JSON="${escaped}"\n`
fs.writeFileSync('P:/ZombieSheet/server/.dev.vars', content, 'utf8')
console.log('wrote', content.length, 'bytes')
// verify roundtrip
const line = fs.readFileSync('P:/ZombieSheet/server/.dev.vars', 'utf8').split(/\n/)[1]
let v = line.slice('FIREBASE_SERVICE_ACCOUNT_JSON='.length)
v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
const parsed = JSON.parse(v)
console.log('roundtrip', parsed.client_email, (parsed.private_key.match(/\n/g) || []).length)
