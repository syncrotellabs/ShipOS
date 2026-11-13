import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createHostedShipOsServer, signWordPressAssertion } from '../hosted/server.mjs'

const secret = 'test-only-shipos-wordpress-secret-1234567890'
const cookiePart = value => value.split(';', 1)[0]
const packet = () => ({ worldId: 'relay-world-01', worldName: 'Relay Star System', x: 10, y: 20, z: 30, sessionId: 'relay-session', stamp: new Date().toISOString(), sequence: 1, contacts: [] })

test('hosted ShipOS trusts signed WordPress roles and enforces viewer/admin writes on the server', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shipos-hosted-'))
  const staticDir = join(root, 'dist')
  await mkdir(staticDir)
  await writeFile(join(staticDir, 'index.html'), '<!doctype html><title>ShipOS</title>')
  const app = await createHostedShipOsServer({
    sharedSecret: secret,
    publicUrl: 'http://127.0.0.1:0',
    wpSsoUrl: 'https://echoboardhq.com/wp-admin/admin-post.php?action=shipos_sso',
    mainSite: 'https://echoboardhq.com/',
    dataDir: join(root, 'data'),
    staticDir,
    port: 0,
    host: '127.0.0.1',
    allowHttp: true,
  })
  const base = `http://127.0.0.1:${app.port}`
  const authenticate = async role => {
    const start = await fetch(`${base}/auth/start`, { redirect: 'manual' })
    assert.equal(start.status, 302)
    const stateCookie = cookiePart(start.headers.get('set-cookie'))
    const state = new URL(start.headers.get('location')).searchParams.get('state')
    const now = Math.floor(Date.now() / 1000)
    const assertion = signWordPressAssertion({ sub: role === 'admin' ? '1' : '2', name: role, role, iat: now, exp: now + 60, jti: `${role}-${'x'.repeat(24)}`, state }, secret)
    const callback = await fetch(`${base}/auth/callback?assertion=${encodeURIComponent(assertion)}`, { headers: { Cookie: stateCookie }, redirect: 'manual' })
    assert.equal(callback.status, 302)
    const cookies = callback.headers.getSetCookie()
    return { session: cookiePart(cookies.find(value => value.startsWith('shipos_hosted='))), assertion, stateCookie }
  }
  try {
    const anonymous = await fetch(base, { redirect: 'manual' })
    assert.equal(anonymous.status, 302)
    assert.equal(anonymous.headers.get('location'), '/auth/start')

    const viewer = await authenticate('viewer')
    const viewerSession = await fetch(`${base}/api/session`, { headers: { Cookie: viewer.session } })
    assert.equal(viewerSession.status, 200)
    assert.equal((await viewerSession.json()).role, 'viewer')
    const viewerWrite = await fetch(`${base}/api/state`, { method: 'PUT', headers: { Cookie: viewer.session, 'Content-Type': 'application/json', 'X-ShipOS-Client': 'local-beta' }, body: JSON.stringify({ worldId: 'hosted-world', expectedRevision: 0, state: {} }) })
    assert.equal(viewerWrite.status, 403)

    const admin = await authenticate('admin')
    const before = await (await fetch(`${base}/api/state`, { headers: { Cookie: admin.session } })).json()
    const adminWrite = await fetch(`${base}/api/state`, { method: 'PUT', headers: { Cookie: admin.session, 'Content-Type': 'application/json', 'X-ShipOS-Client': 'local-beta' }, body: JSON.stringify({ worldId: before.worldId, expectedRevision: before.revision, state: {} }) })
    assert.equal(adminWrite.status, 200)
    assert.equal((await adminWrite.json()).revision, before.revision + 1)

    const createRelay = await fetch(`${base}/api/admin/relay-devices`, { method: 'POST', headers: { Cookie: admin.session, 'Content-Type': 'application/json', 'X-ShipOS-Client': 'local-beta' }, body: JSON.stringify({ label: 'Test gaming PC' }) })
    assert.equal(createRelay.status, 201)
    const relay = await createRelay.json()
    assert.match(relay.token, /^shipos_relay_[A-Za-z0-9_-]{43}$/)
    const listedRelays = await (await fetch(`${base}/api/admin/relay-devices`, { headers: { Cookie: admin.session } })).json()
    assert.equal(listedRelays[0].label, 'Test gaming PC')
    assert.equal('token' in listedRelays[0], false)
    const uploadHeaders = { Authorization: `Bearer ${relay.token}`, 'Content-Type': 'application/json', 'X-ShipOS-Relay': 'telemetry-v1' }
    assert.equal((await fetch(`${base}/api/relay/telemetry`, { method: 'POST', headers: uploadHeaders, body: JSON.stringify(packet()) })).status, 202)
    const viewerLatest = await fetch(`${base}/api/telemetry/latest`, { headers: { Cookie: viewer.session } })
    assert.equal(viewerLatest.status, 200)
    assert.equal((await viewerLatest.json()).worldName, 'Relay Star System')
    const hostedStatus = await (await fetch(`${base}/api/status`, { headers: { Cookie: viewer.session } })).json()
    assert.equal(hostedStatus.telemetry.connected, true)
    assert.equal(hostedStatus.worldName, 'Relay Star System')
    assert.equal((await fetch(`${base}/api/admin/relay-devices`, { method: 'POST', headers: { Cookie: viewer.session, 'Content-Type': 'application/json', 'X-ShipOS-Client': 'local-beta' }, body: JSON.stringify({ label: 'Forbidden' }) })).status, 403)
    assert.equal((await fetch(`${base}/api/admin/relay-devices`, { method: 'POST', headers: { Cookie: admin.session, 'Content-Type': 'application/json', 'X-ShipOS-Client': 'local-beta' }, body: JSON.stringify({ id: relay.id, revoke: true }) })).status, 200)
    assert.equal((await fetch(`${base}/api/relay/telemetry`, { method: 'POST', headers: uploadHeaders, body: JSON.stringify(packet()) })).status, 401)

    const replay = await fetch(`${base}/auth/callback?assertion=${encodeURIComponent(admin.assertion)}`, { headers: { Cookie: admin.stateCookie }, redirect: 'manual' })
    assert.equal(replay.status, 401)
  } finally {
    await app.close()
    await rm(root, { recursive: true, force: true })
  }
})
