import http from 'node:http'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validStateField } from '../runtime/validate.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const fail = (status, message) => Object.assign(new Error(message), { status })
const digest = value => createHash('sha256').update(value).digest('hex')
const token = () => randomBytes(32).toString('base64url')
const base64url = value => Buffer.from(value).toString('base64url')
const json = (res, status, value, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(JSON.stringify(value))
}
const redirect = (res, location, headers = {}) => { res.writeHead(302, { Location: location, 'Cache-Control': 'no-store', ...headers }); res.end() }
const cookieValue = (req, name) => new RegExp(`(?:^|;\\s*)${name}=([A-Za-z0-9_-]{16,128})(?:;|$)`).exec(req.headers.cookie || '')?.[1]
const sessionCookie = (value, maxAge = 43200) => `shipos_hosted=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
const stateCookie = (value, maxAge = 300) => `shipos_sso_state=${value}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`

export function signWordPressAssertion(payload, sharedSecret) {
  const encoded = base64url(JSON.stringify(payload))
  return `${encoded}.${createHmac('sha256', sharedSecret).update(encoded).digest('base64url')}`
}

function verifyAssertion(assertion, sharedSecret) {
  const [encoded, signature, extra] = String(assertion || '').split('.')
  if (!encoded || !signature || extra || encoded.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) throw fail(401, 'Invalid WordPress assertion.')
  const expected = createHmac('sha256', sharedSecret).update(encoded).digest()
  const supplied = Buffer.from(signature, 'base64url')
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw fail(401, 'Invalid WordPress assertion.')
  let payload
  try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) } catch { throw fail(401, 'Invalid WordPress assertion.') }
  if (!isObject(payload)) throw fail(401, 'Invalid WordPress assertion.')
  return payload
}

function validateState(state) {
  if (!isObject(state) || Object.keys(state).length > 150) throw fail(400, 'Invalid ShipOS state.')
  for (const [key, value] of Object.entries(state)) {
    if (!/^shipos-[a-z0-9-]{1,90}$/.test(key) || key.startsWith('shipos-sync-') || !validStateField(key, value)) throw fail(400, `Invalid record structure in ${key}.`)
    if (JSON.stringify(value).length > 3_000_000) throw fail(413, 'A ShipOS field is too large.')
  }
  if (JSON.stringify(state).length > 12_000_000) throw fail(413, 'ShipOS state exceeds the 12 MB limit.')
  return state
}

async function bodyJson(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415, 'JSON requests only.')
  const chunks = []; let size = 0
  for await (const chunk of req) { size += chunk.length; if (size > 13_000_000) throw fail(413, 'Request too large.'); chunks.push(chunk) }
  try { const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!isObject(body)) throw Error(); return body } catch { throw fail(400, 'Malformed JSON object.') }
}

export async function createHostedShipOsServer(options = {}) {
  const sharedSecret = options.sharedSecret || process.env.SHIPOS_WP_SHARED_SECRET || ''
  if (sharedSecret.length < 32) throw Error('SHIPOS_WP_SHARED_SECRET must contain at least 32 characters.')
  const publicUrl = new URL(options.publicUrl || process.env.SHIPOS_PUBLIC_URL || 'https://shipos.echoboardhq.com')
  if (publicUrl.protocol !== 'https:' && !options.allowHttp) throw Error('SHIPOS_PUBLIC_URL must use HTTPS.')
  const allowedHost = publicUrl.host
  const mainSite = options.mainSite || process.env.SHIPOS_MAIN_SITE || 'https://echoboardhq.com/'
  const wpSsoUrl = options.wpSsoUrl || process.env.SHIPOS_WP_SSO_URL || 'https://echoboardhq.com/wp-admin/admin-post.php?action=shipos_sso'
  const dataDir = options.dataDir || process.env.SHIPOS_DATA_DIR || '/var/lib/shipos'
  const staticDir = options.staticDir || path.join(root, 'dist')
  const port = options.port ?? Number(process.env.SHIPOS_PORT || 4180)
  const host = options.host || process.env.SHIPOS_HOST || '127.0.0.1'
  mkdirSync(dataDir, { recursive: true })
  const db = new DatabaseSync(path.join(dataDir, 'shipos-hosted.sqlite'))
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS worlds(id TEXT PRIMARY KEY, name TEXT NOT NULL, state TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0, updatedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(tokenHash TEXT PRIMARY KEY, wpUserId TEXT NOT NULL, displayName TEXT NOT NULL, role TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS usedAssertions(jti TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    INSERT OR IGNORE INTO worlds(id,name,state,revision,updatedAt) VALUES ('hosted-world','ShipOS Hosted World','{}',0,datetime('now'));
  `)
  const worldState = () => { const row = db.prepare("SELECT * FROM worlds WHERE id='hosted-world'").get(); return { worldId: row.id, name: row.name, state: JSON.parse(row.state), revision: row.revision, updatedAt: row.updatedAt } }
  const updateState = body => {
    if (body.worldId !== 'hosted-world') throw fail(409, 'Reload the hosted ShipOS world before editing.')
    validateState(body.state)
    const current = worldState()
    if (!Number.isInteger(body.expectedRevision) || body.expectedRevision !== current.revision) throw fail(409, 'Another administrator changed ShipOS. Reload before editing again.')
    const updatedAt = new Date().toISOString()
    const result = db.prepare("UPDATE worlds SET state=?,revision=revision+1,updatedAt=? WHERE id='hosted-world' AND revision=?").run(JSON.stringify(body.state), updatedAt, current.revision)
    if (!result.changes) throw fail(409, 'ShipOS changed while this request was saving.')
    return worldState()
  }
  const authenticate = req => {
    const raw = cookieValue(req, 'shipos_hosted')
    if (!raw) return null
    const row = db.prepare('SELECT wpUserId,displayName,role,expires FROM sessions WHERE tokenHash=? AND expires>?').get(digest(raw), Date.now())
    return row ? { id: row.wpUserId, displayName: row.displayName, role: row.role } : null
  }
  const securityHeaders = res => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
  }
  const handler = async (req, res) => {
    securityHeaders(res)
    try {
      const requestHost = req.headers.host || ''
      if (requestHost !== allowedHost && !(options.allowHttp && requestHost === `${host}:${server.address()?.port || port}`)) throw fail(403, 'Unrecognized host.')
      const url = new URL(req.url, publicUrl)
      const route = url.pathname
      if (route === '/healthz' && req.method === 'GET') return json(res, 200, { ok: true })
      if (route === '/auth/start' && req.method === 'GET') {
        const state = token()
        const destination = new URL(wpSsoUrl)
        destination.searchParams.set('state', state)
        return redirect(res, destination.toString(), { 'Set-Cookie': stateCookie(state) })
      }
      if (route === '/auth/callback' && req.method === 'GET') {
        const expectedState = cookieValue(req, 'shipos_sso_state')
        const payload = verifyAssertion(url.searchParams.get('assertion'), sharedSecret)
        const now = Math.floor(Date.now() / 1000)
        if (!expectedState || payload.state !== expectedState || !/^[A-Za-z0-9_-]{20,128}$/.test(String(payload.jti || '')) || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.iat > now + 30 || payload.exp < now || payload.exp > now + 120) throw fail(401, 'Expired or mismatched WordPress sign-in.')
        if (!['viewer', 'admin'].includes(payload.role) || !/^\d{1,20}$/.test(String(payload.sub || ''))) throw fail(401, 'Invalid WordPress role assertion.')
        db.exec('BEGIN IMMEDIATE')
        try {
          db.prepare('DELETE FROM usedAssertions WHERE expires<?').run(Date.now())
          db.prepare('INSERT INTO usedAssertions(jti,expires) VALUES (?,?)').run(payload.jti, payload.exp * 1000)
          const raw = token(); const expires = Date.now() + 12 * 60 * 60 * 1000
          db.prepare('INSERT INTO sessions(tokenHash,wpUserId,displayName,role,expires) VALUES (?,?,?,?,?)').run(digest(raw), String(payload.sub), String(payload.name || 'Echoboard member').slice(0, 120), payload.role, expires)
          db.exec('COMMIT')
          return redirect(res, '/', { 'Set-Cookie': [sessionCookie(raw), stateCookie('', 0)] })
        } catch (error) { db.exec('ROLLBACK'); if (String(error.message).includes('UNIQUE')) throw fail(401, 'This WordPress sign-in was already used.'); throw error }
      }
      if (route === '/auth/logout' && req.method === 'GET') {
        const raw = cookieValue(req, 'shipos_hosted'); if (raw) db.prepare('DELETE FROM sessions WHERE tokenHash=?').run(digest(raw))
        return redirect(res, mainSite, { 'Set-Cookie': sessionCookie('', 0) })
      }
      const user = authenticate(req)
      if (route.startsWith('/api/')) {
        if (!user) throw fail(401, 'A WordPress session is required.')
        const write = !['GET', 'HEAD'].includes(req.method)
        if (req.headers.origin && req.headers.origin !== publicUrl.origin) throw fail(403, 'Cross-origin requests are not allowed.')
        if (write && req.headers['x-shipos-client'] !== 'local-beta') throw fail(403, 'Missing request protection.')
        if (write && user.role !== 'admin') throw fail(403, 'ShipOS is read-only for this WordPress account.')
        if (route.startsWith('/api/admin/') && user.role !== 'admin') throw fail(403, 'WordPress administrator access is required.')
        if (route === '/api/session' && req.method === 'GET') return json(res, 200, { role: user.role, displayName: user.displayName, worldId: 'hosted-world', beta: '0.2' })
        if (route === '/api/state' && req.method === 'GET') return json(res, 200, worldState())
        if (route === '/api/state' && req.method === 'PUT') return json(res, 200, updateState(await bodyJson(req)))
        if (route === '/api/status' && req.method === 'GET') return json(res, 200, { version: '0.2.0-beta.5', mode: 'Hosted WordPress access', worldId: 'hosted-world', worldName: worldState().name, telemetry: { connected: false, stamp: null, error: 'Live Space Engineers telemetry remains local to the gaming PC.', stableWorldIdentity: true }, sharing: { enabled: false, url: null, address: null }, ai: { enabled: false, model: '' }, database: 'SQLite' })
        if (route === '/api/telemetry/latest' && req.method === 'GET') throw fail(503, 'Live telemetry is available only from a local ShipOS installation.')
        if (route === '/api/telemetry/history' && req.method === 'GET') return json(res, 200, [])
        if (route === '/api/ai/models' && req.method === 'GET') return json(res, 200, [])
        if (route === '/api/ai/brief' && req.method === 'POST') throw fail(503, 'Hosted AI is not enabled.')
        if (route === '/api/admin/backup' && req.method === 'GET') return json(res, 200, { format: 'shipos-hosted-backup-v1', ...worldState() }, { 'Content-Disposition': 'attachment; filename="ShipOS-hosted-backup.json"' })
        if (route === '/api/admin/restore' && req.method === 'POST') { const body = await bodyJson(req); if (body.backup?.format !== 'shipos-hosted-backup-v1') throw fail(400, 'Not a ShipOS hosted backup.'); return json(res, 200, updateState({ worldId: body.worldId, expectedRevision: body.expectedRevision, state: body.backup.state })) }
        throw fail(404, 'No such hosted API.')
      }
      if (!user) return redirect(res, '/auth/start')
      if (!['GET', 'HEAD'].includes(req.method)) throw fail(405, 'Read-only resource.')
      let filename = path.resolve(staticDir, '.' + decodeURIComponent(route))
      if (!filename.startsWith(path.resolve(staticDir) + path.sep) && filename !== path.resolve(staticDir)) throw fail(403, 'Invalid path.')
      if (route === '/' || (!path.extname(route) && !existsSync(filename))) filename = path.join(staticDir, 'index.html')
      if (!existsSync(filename) || !statSync(filename).isFile()) throw fail(404, 'Resource not found. Build the hosted bundle first.')
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' }[path.extname(filename)] || 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': path.extname(filename) === '.html' ? 'no-cache' : 'public, max-age=604800, immutable' })
      res.end(req.method === 'HEAD' ? undefined : await readFile(filename))
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Hosted ShipOS service error.' })
      if (!error.status) console.error(error)
    }
  }
  const server = http.createServer(handler)
  server.requestTimeout = 15000
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve) })
  const close = async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); db.close() }
  return { url: `${options.allowHttp ? 'http' : 'https'}://${allowedHost}`, port: server.address().port, close }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await createHostedShipOsServer()
  console.log(`ShipOS hosted service listening on ${process.env.SHIPOS_HOST || '127.0.0.1'}:${app.port}`)
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void app.close().then(() => process.exit(0)))
}
