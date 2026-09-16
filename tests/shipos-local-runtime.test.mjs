import assert from 'node:assert/strict'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { request as httpRequest } from 'node:http'
import { createShipOsServer, validatePacket, validateState } from '../runtime/server.mjs'

const packet = (worldId = 'test-world-01', sequence = 1) => ({ worldId, worldName: 'Star System test', x: 1, y: 2, z: 3, sessionId: 'session-one', stamp: new Date().toISOString(), sequence, contacts: [] })
const mission = title => ({ 'shipos-mission': { title, goal: '', startedAt: '' } })
async function fixture(t) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'shipos-test-'))
  const app = await createShipOsServer({ dataDir, port: 0, watchFile: '', networkAddresses: () => ['127.0.0.2'] })
  let closed = false
  t.after(async () => { if (!closed) await app.close(); const resolved = path.resolve(dataDir); assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(resolved).startsWith('shipos-test-')); await rm(resolved, { recursive: true, force: true }) })
  const session = await fetch(app.url + '/api/session')
  const cookie = session.headers.get('set-cookie').split(';')[0]
  const request = (route, body, overrides = {}) => fetch(app.url + route, { headers: { Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'X-ShipOS-Client': 'local-beta' }), ...overrides.headers }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }), ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'headers')) })
  return { app, cookie, request, dataDir, close: async () => { await app.close(); closed = true } }
}

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

test('local AI is optional and disabled until explicitly configured', async t => {
  const { request } = await fixture(t)
  assert.deepEqual(await (await request('/api/ai/models')).json(), [])
  assert.equal((await request('/api/ai/brief', { content: 'Hello' })).status, 503)
  assert.equal((await request('/api/admin/ai', { model: 'test-model:small', enabled: true })).status, 200)
  const models = await (await request('/api/ai/models')).json()
  assert.equal(models[0].providerName, 'Local')
})
