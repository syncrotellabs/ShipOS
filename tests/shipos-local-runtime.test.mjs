import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { request as httpRequest } from 'node:http'
import { createShipOsServer, validatePacket, validateState } from '../runtime/server.mjs'
import { parseArguments, parseEnvelope, runGameBridge, serializeEnvelope, validateBridgeUrl } from '../runtime/game-bridge.mjs'

const packet = (worldId = 'test-world-01', sequence = 1) => ({ worldId, worldName: 'Star System test', x: 1, y: 2, z: 3, sessionId: 'session-one', stamp: new Date().toISOString(), sequence, contacts: [] })
const mission = title => ({ 'shipos-mission': { title, goal: '', startedAt: '' } })
async function fixture(t, serverOptions = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'shipos-test-'))
  const staticDir = path.join(dataDir, 'static')
  await mkdir(staticDir)
  await writeFile(path.join(staticDir, 'index.html'), '<!doctype html><title>ShipOS test</title>')
  await writeFile(path.join(staticDir, 'texture.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
  await writeFile(path.join(staticDir, 'display.woff'), Buffer.from([0x77, 0x4f, 0x46, 0x46]))
  const app = await createShipOsServer({ dataDir, staticDir, port: 0, watchFile: '', networkAddresses: () => ['127.0.0.2'], ...serverOptions })
  let closed = false
  t.after(async () => { if (!closed) await app.close(); const resolved = path.resolve(dataDir); assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(resolved).startsWith('shipos-test-')); await rm(resolved, { recursive: true, force: true }) })
  const session = await fetch(app.url + '/api/session')
  const cookie = session.headers.get('set-cookie').split(';')[0]
  const request = (route, body, overrides = {}) => fetch(app.url + route, { headers: { Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'X-ShipOS-Client': 'local-beta' }), ...overrides.headers }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }), ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'headers')) })
  return { app, cookie, request, dataDir, close: async () => { await app.close(); closed = true } }
}

test('static textures and bundled fonts use browser-safe MIME types', async t => {
  const { app } = await fixture(t)
  const texture = await fetch(app.url + '/texture.jpg')
  const font = await fetch(app.url + '/display.woff')
  assert.equal(texture.status, 200)
  assert.equal(texture.headers.get('content-type'), 'image/jpeg')
  assert.equal(texture.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(font.headers.get('content-type'), 'font/woff')
})

test('local API requires authentication, explicit mutation headers and a trusted Host/Origin', async t => {
  const { app, request } = await fixture(t)
  assert.equal((await fetch(app.url + '/api/state')).status, 401)
  assert.equal((await request('/api/state')).status, 200)
  assert.equal((await request('/api/state', {}, { method: 'PUT', headers: { Origin: 'https://attacker.example' } })).status, 403)
  const reboundStatus = await new Promise((resolve, reject) => {
    const req = httpRequest(app.url + '/api/session', { headers: { Host: 'attacker.example' } }, response => { response.resume(); resolve(response.statusCode) })
    req.on('error', reject); req.end()
  })
  assert.equal(reboundStatus, 403)
  assert.equal((await request('/api/state', {}, { method: 'PUT', headers: { 'X-ShipOS-Client': '' } })).status, 403)
  assert.equal((await request('/api/shipos/telemetry', {})).status, 404)
  assert.equal((await request('/api/telemetry/latest', {})).status, 404)
  assert.equal((await request('/api/admin/sharing', { enabled: true, address: '8.8.8.8' })).status, 400)
})

test('single-use pairing grants story read/write without granting PC administration, and supports revocation', async t => {
  const { app, request, cookie } = await fixture(t)
  await request('/api/admin/sharing', { enabled: true, address: '127.0.0.2' })
  const pair = await (await request('/api/admin/pair', {})).json()
  const parsed = new URL(pair.url)
  const lan = parsed.origin
  assert.equal((await fetch(lan + '/api/session')).status, 401)
  // A local administrator cookie must not confer administrator rights on the LAN listener.
  assert.equal((await fetch(lan + '/api/state', { headers: { Cookie: cookie } })).status, 401)
  const token = new URLSearchParams(parsed.hash.slice(1)).get('pair')
  assert.ok(pair.expires <= Date.now() + 120001)
  assert.equal(parsed.search, '')
  const claim = () => fetch(lan + '/api/pair/claim', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-ShipOS-Client': 'local-beta' }, body: JSON.stringify({ token, label: 'Test tablet' }) })
  const response = await claim()
  assert.equal(response.status, 200)
  assert.equal((await claim()).status, 401)
  const tabletCookie = response.headers.get('set-cookie').split(';')[0]
  const readHeaders = { Cookie: tabletCookie }
  const writeHeaders = { ...readHeaders, 'Content-Type': 'application/json', 'X-ShipOS-Client': 'local-beta' }
  assert.equal((await fetch(lan + '/api/state', { headers: readHeaders })).status, 200)
  assert.equal((await fetch(lan + '/api/admin/devices', { headers: readHeaders })).status, 403)
  const state = await (await request('/api/state')).json()
  const write = () => fetch(lan + '/api/state', { method: 'PUT', headers: writeHeaders, body: JSON.stringify({ state: mission('Tablet edit'), worldId: state.worldId, expectedRevision: state.revision }) })
  assert.equal((await write()).status, 200)
  const devices = await (await request('/api/admin/devices')).json()
  assert.equal(devices[0].role, 'editor')
  assert.equal((await request('/api/admin/devices', { id: devices[0].id, role: 'viewer' })).status, 400)
  await request('/api/admin/devices', { id: devices[0].id, revoke: true })
  assert.equal((await fetch(lan + '/api/state', { headers: readHeaders })).status, 401)
  await request('/api/admin/sharing', { enabled: false })
  assert.equal(app.status().sharing.enabled, false)
})

test('SQLite state survives restart, isolates worlds, and rejects stale revisions without data loss', async t => {
  const { app, request, dataDir, close } = await fixture(t)
  app.ingest(packet())
  const state = await (await request('/api/state')).json()
  assert.deepEqual(state.state, {})
  const save = { state: mission('First landing'), worldId: state.worldId, expectedRevision: state.revision }
  assert.equal((await request('/api/state', save, { method: 'PUT' })).status, 200)
  assert.equal((await request('/api/state', { ...save, state: mission('Conflicting overwrite') }, { method: 'PUT' })).status, 409)
  assert.deepEqual((await (await request('/api/state')).json()).state, save.state)
  app.ingest(packet('other-world-02'))
  assert.deepEqual((await (await request('/api/state')).json()).state, {})
  assert.equal((await request('/api/state', { ...save, expectedRevision: 1 }, { method: 'PUT' })).status, 409)
  app.ingest(packet())
  await close()
  const restarted = await createShipOsServer({ dataDir, port: 0, watchFile: '' })
  try {
    const session = await fetch(restarted.url + '/api/session')
    const response = await fetch(restarted.url + '/api/state', { headers: { Cookie: session.headers.get('set-cookie').split(';')[0] } })
    assert.deepEqual((await response.json()).state, save.state)
  } finally { await restarted.close() }
})

test('reset and restore make recovery snapshots; invalid record types never replace a story', async t => {
  const { app, request, dataDir } = await fixture(t)
  app.ingest(packet())
  await request('/api/state', { worldId: 'test-world-01', state: mission('Preserve this'), expectedRevision: 0 }, { method: 'PUT' })
  const backup = await (await request('/api/admin/backup')).json()
  const bad = await request('/api/admin/restore', { worldId: backup.worldId, expectedRevision: 1, backup: { ...backup, state: { 'shipos-crew-roster': 'not a roster' } } })
  assert.equal(bad.status, 400)
  const reset = await request('/api/admin/reset', { worldId: backup.worldId, expectedRevision: 1, confirm: 'NEW MISSION' })
  assert.equal(reset.status, 200)
  assert.deepEqual((await reset.json()).state, {})
  assert.ok((await readdir(path.join(dataDir, 'backups'))).some(name => name.endsWith('-reset.json')))
  assert.equal((await request('/api/admin/restore', { worldId: backup.worldId, expectedRevision: 2, backup })).status, 200)
  assert.deepEqual((await (await request('/api/state')).json()).state, backup.state)
})

test('telemetry validates required fields, deduplicates, and rejects late or oversized packets', async t => {
  const { app, request } = await fixture(t)
  const first = packet()
  assert.equal(app.ingest(first), true)
  assert.equal(app.ingest(first), false)
  assert.equal(app.ingest({ ...first, stamp: new Date(Date.now() - 10000).toISOString() }), false)
  assert.throws(() => validatePacket({ ...first, x: '1' }))
  assert.throws(() => validatePacket({ ...first, y: Infinity }))
  assert.throws(() => validatePacket({ ...first, stamp: undefined }))
  assert.throws(() => validatePacket({ ...first, contacts: Array(501).fill({}) }))
  assert.throws(() => validateState({ 'shipos-crew-roster': [{}] }))
  assert.throws(() => validateState({ 'shipos-not-a-real-field': [] }))
  assert.equal((await (await request('/api/telemetry/history')).json()).length, 1)
})

test('AI is optional and restricted to loopback or private-LAN Ollama hosts', async t => {
  const { request } = await fixture(t)
  assert.deepEqual(await (await request('/api/ai/models')).json(), [])
  assert.equal((await request('/api/ai/brief', { content: 'Hello' })).status, 503)
  assert.equal((await request('/api/admin/ai', { model: 'test-model:small', host: '8.8.8.8', enabled: true })).status, 400)
  assert.equal((await request('/api/admin/ai', { model: 'test-model:small', host: 'model.example.com', enabled: true })).status, 400)
  assert.equal((await request('/api/admin/ai', { model: 'test-model:small', host: '192.168.42.20', enabled: true })).status, 200)
  const models = await (await request('/api/ai/models')).json()
  assert.equal(models[0].providerName, 'LAN 192.168.42.20')
})

test('opt-in in-game chat bridges a current mod session to Ollama and returns a bounded reply', async t => {
  const storage = await mkdtemp(path.join(tmpdir(), 'shipos-chat-test-'))
  t.after(async () => { await rm(storage, { recursive: true, force: true }) })
  const chatRequestFile = path.join(storage, 'ShipOSLocalTelemetry.chat-request.txt')
  const chatReplyFile = path.join(storage, 'ShipOSLocalTelemetry.chat-reply.txt')
  let ollamaRequest = null
  const aiFetch = async (url, options) => {
    ollamaRequest = { url, body: JSON.parse(options.body) }
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Battery is at 42%. All other reported systems are nominal.' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const { app, request } = await fixture(t, { chatRequestFile, chatReplyFile, aiFetch })
  assert.equal((await request('/api/admin/game-chat', { enabled: true, proactiveMinutes: 5 })).status, 400)
  assert.equal((await request('/api/admin/ai', { model: 'shipos-test:latest', host: '127.0.0.1', enabled: true })).status, 200)
  assert.equal((await request('/api/admin/game-chat', { enabled: true, proactiveMinutes: 10 })).status, 200)

  const worldId = 'a'.repeat(32)
  const sessionId = 'b'.repeat(32)
  app.ingest({ ...packet(worldId), sessionId, batteryPercent: 42 })
  const requestId = `shipos-chat-${sessionId}-1`
  await writeFile(chatRequestFile, [
    'version=1',
    `session=${sessionId}`,
    `world=${worldId}`,
    `request=${requestId}`,
    `stamp=${new Date().toISOString()}`,
    `player=${Buffer.from('Engineer').toString('base64')}`,
    `message=${Buffer.from('Give me a status report.').toString('base64')}`,
    '',
  ].join('\n'))

  assert.equal(await app.processGameChat(), true)
  assert.equal(ollamaRequest.url, 'http://127.0.0.1:11434/v1/chat/completions')
  assert.equal(ollamaRequest.body.reasoning_effort, 'none')
  assert.equal(ollamaRequest.body.temperature, 0.2)
  assert.match(ollamaRequest.body.messages[1].content, /"batteryPercent":42/)
  assert.match(ollamaRequest.body.messages[1].content, /Battery: 42%/)
  assert.match(ollamaRequest.body.messages[0].content, /Never invent sensor readings/)
  const reply = Object.fromEntries((await readFile(chatReplyFile, 'utf8')).trim().split(/\r?\n/).map(line => {
    const separator = line.indexOf('=')
    return [line.slice(0, separator), line.slice(separator + 1)]
  }))
  assert.equal(reply.session, sessionId)
  assert.equal(reply.reply, requestId)
  assert.equal(Buffer.from(reply.message, 'base64').toString('utf8'), 'Battery is at 42%. All other reported systems are nominal.')
  assert.equal(app.status().gameChat.enabled, true)
  assert.ok(app.status().gameChat.lastReplyAt)
})

test('authenticated gaming-PC collector carries telemetry and ShipOS chat both ways across the private LAN', async t => {
  const storage = await mkdtemp(path.join(tmpdir(), 'shipos-game-bridge-test-'))
  t.after(async () => { await rm(storage, { recursive: true, force: true }) })
  const aiFetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Battery is exactly 64%. You are moving at 8 m/s.' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const { app, request } = await fixture(t, { aiFetch })
  await request('/api/admin/sharing', { enabled: true, address: '127.0.0.2' })
  await request('/api/admin/ai', { model: 'shipos-test:latest', host: '127.0.0.1', enabled: true })
  await request('/api/admin/game-chat', { enabled: true, proactiveMinutes: 0 })
  const createdResponse = await request('/api/admin/bridge-devices', { label: 'Test gaming PC' })
  assert.equal(createdResponse.status, 201)
  const bridge = await createdResponse.json()
  assert.match(bridge.token, /^shipos_bridge_[A-Za-z0-9_-]{43}$/)
  assert.equal(bridge.bridgeUrl, `${app.status().sharing.url}api/bridge/exchange`)
  const listed = await (await request('/api/admin/bridge-devices')).json()
  assert.equal(listed[0].label, 'Test gaming PC')
  assert.equal('token' in listed[0], false)

  const worldId = 'c'.repeat(32)
  const sessionId = 'd'.repeat(32)
  const requestId = `shipos-chat-${sessionId}-1`
  await writeFile(path.join(storage, 'ShipOSLocalTelemetry.latest.json'), JSON.stringify({ ...packet(worldId), sessionId, batteryPercent: 64, speed: 8 }))
  await writeFile(path.join(storage, 'ShipOSLocalTelemetry.chat-request.txt'), [
    'version=1',
    `session=${sessionId}`,
    `world=${worldId}`,
    `request=${requestId}`,
    `stamp=${new Date().toISOString()}`,
    `player=${Buffer.from('Engineer').toString('base64')}`,
    `message=${Buffer.from('Status please.').toString('base64')}`,
    '',
  ].join('\n'))

  const controller = new AbortController()
  const errors = []
  const collector = runGameBridge({ url: bridge.bridgeUrl, token: bridge.token, storageDir: storage }, { intervalMs: 10, signal: controller.signal, log: () => {}, error: message => errors.push(message) })
  for (let attempt = 0; attempt < 100 && !app.status().gameBridge.connected; attempt++) await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(app.status().gameBridge.connected, true)
  await app.processBridgeGameChat()
  let replySource = ''
  for (let attempt = 0; attempt < 100 && !replySource; attempt++) {
    try { replySource = await readFile(path.join(storage, 'ShipOSLocalTelemetry.chat-reply.txt'), 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (!replySource) await new Promise(resolve => setTimeout(resolve, 10))
  }
  controller.abort()
  await collector
  assert.deepEqual(errors, [])
  const reply = parseEnvelope(replySource)
  assert.equal(reply.session, sessionId)
  assert.equal(reply.reply, requestId)
  assert.equal(Buffer.from(reply.message, 'base64').toString('utf8'), 'Battery is exactly 64%. You are moving at 8 m/s.')
  assert.equal((await (await request('/api/telemetry/latest')).json()).batteryPercent, 64)

  assert.equal((await fetch(bridge.bridgeUrl, { method: 'POST', headers: { Authorization: `Bearer ${bridge.token}`, 'Content-Type': 'application/json' }, body: '{}' })).status, 403)
  await request('/api/admin/bridge-devices', { id: bridge.id, revoke: true })
  assert.equal((await fetch(bridge.bridgeUrl, { method: 'POST', headers: { Authorization: `Bearer ${bridge.token}`, 'Content-Type': 'application/json', 'X-ShipOS-Bridge': 'v1' }, body: '{}' })).status, 401)
})

test('gaming-PC collector rejects public endpoints and preserves the line protocol', () => {
  const url = 'http://192.168.42.3:5174/api/bridge/exchange'
  const token = `shipos_bridge_${'a'.repeat(43)}`
  assert.equal(validateBridgeUrl(url), url)
  assert.throws(() => validateBridgeUrl('https://192.168.42.3:5174/api/bridge/exchange'))
  assert.throws(() => validateBridgeUrl('http://8.8.8.8:5174/api/bridge/exchange'))
  assert.throws(() => validateBridgeUrl('http://user:pass@192.168.42.3:5174/api/bridge/exchange'))
  const config = parseArguments(['--url', url, '--token', token, '--appdata', path.resolve('/tmp/appdata')], {})
  assert.equal(config.token, token)
  const envelope = { version: '1', session: 'abc', reply: 'request-1', expires: new Date().toISOString(), message: Buffer.from('hello').toString('base64') }
  assert.deepEqual(parseEnvelope(serializeEnvelope(envelope)), envelope)
})

test('optional hosted telemetry relay is outbound-only, authenticated, and forgets its key when disabled', async t => {
  let upload = null
  const relayFetch = async (url, options) => {
    upload = { url, options }
    return new Response(JSON.stringify({ accepted: true }), { status: 202, headers: { 'Content-Type': 'application/json' } })
  }
  const { app, request } = await fixture(t, { relayFetch })
  const relayToken = `shipos_relay_${'a'.repeat(43)}`
  assert.equal((await request('/api/admin/relay', { enabled: true, token: 'bad' })).status, 400)
  assert.equal((await request('/api/admin/relay', { enabled: true, token: relayToken })).status, 200)
  app.ingest(packet())
  for (let attempt = 0; attempt < 50 && !upload; attempt++) await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(upload.url, 'https://shipos.echoboardhq.com/api/relay/telemetry')
  assert.equal(upload.options.method, 'POST')
  assert.equal(upload.options.headers.Authorization, `Bearer ${relayToken}`)
  assert.equal(upload.options.headers['X-ShipOS-Relay'], 'telemetry-v1')
  assert.equal(JSON.parse(upload.options.body).worldId, 'test-world-01')
  const enabled = await (await request('/api/status')).json()
  assert.equal(enabled.relay.enabled, true)
  assert.equal(enabled.relay.connected, true)
  assert.equal('token' in enabled.relay, false)
  assert.equal((await request('/api/admin/relay', { enabled: false })).status, 200)
  const disabled = await (await request('/api/status')).json()
  assert.equal(disabled.relay.enabled, false)
  assert.equal(disabled.relay.configured, false)
})
