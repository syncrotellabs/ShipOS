import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

const bridgeScript = resolve('public/shipos/addons/shipos-telemetry-bridge.mjs')

test('ShipOS bridge validates, deduplicates, and limits browser origins', async (context) => {
  const workdir = await mkdtemp(join(tmpdir(), 'shipos-bridge-'))
  const port = 18000 + Math.floor(Math.random() * 15000)
  const endpoint = `http://127.0.0.1:${port}`
  const bridge = spawn(process.execPath, [bridgeScript], {
    cwd: workdir,
    env: {
      ...process.env,
      SHIPOS_TELEMETRY_HOST: '127.0.0.1',
      SHIPOS_TELEMETRY_PORT: String(port),
      SHIPOS_TELEMETRY_LOG: join(workdir, 'telemetry.jsonl'),
      SHIPOS_TELEMETRY_MAX_LOG_BYTES: '1000000',
    },
    stdio: 'ignore',
  })

  context.after(async () => {
    bridge.kill()
    await new Promise((resolveExit) => {
      if (bridge.exitCode !== null) {
        resolveExit()
        return
      }
      bridge.once('exit', resolveExit)
      setTimeout(resolveExit, 2000)
    })
    await rm(workdir, { force: true, recursive: true })
  })

  await waitForBridge(`${endpoint}/health`)
  const packet = {
    source: 'test',
    ship: 'DSV Intrepid',
    sessionId: 'test-session',
    packetId: 'shipos-local-test-session-1',
    sequence: 1,
    stamp: new Date().toISOString(),
    x: 1,
    y: 2,
    z: 3,
    surfaceAltitude: 1840.2,
    seaLevelAltitude: 2261.7,
    verticalSpeed: 18.3,
    horizontalSpeed: 7.4,
    gravityX: 0,
    gravityY: -8.927,
    gravityZ: 0,
    forwardX: 0,
    forwardY: 0.31,
    forwardZ: -0.951,
    upX: 0,
    upY: 0.951,
    upZ: 0.31,
    terrainScanSource: 'physics-voxel-raycast',
    terrainScanStatus: 'live',
    terrainScanRange: 1600,
    terrainScan: [
      { row: 0, column: 2, ahead: 0, lateral: 0, clearance: 1840.2, surfaceDelta: 0 },
      { row: 1, column: 2, ahead: 200, lateral: 0, clearance: 1780.2, surfaceDelta: 60 },
    ],
    contacts: [],
  }

  const accepted = await fetch(`${endpoint}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packet),
  })
  assert.equal(accepted.status, 202)
  assert.equal((await accepted.json()).accepted, 1)

  const latest = await fetch(`${endpoint}/telemetry/latest`)
  assert.equal(latest.status, 200)
  const latestPacket = await latest.json()
  assert.equal(latestPacket.surfaceAltitude, 1840.2)
  assert.equal(latestPacket.verticalSpeed, 18.3)
  assert.equal(latestPacket.gravityY, -8.927)
  assert.equal(latestPacket.terrainScanSource, 'physics-voxel-raycast')
  assert.equal(latestPacket.terrainScan.length, 2)
  assert.equal(latestPacket.terrainScan[1].surfaceDelta, 60)

  const duplicate = await fetch(`${endpoint}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packet),
  })
  assert.equal(duplicate.status, 202)
  assert.equal((await duplicate.json()).accepted, 0)

  const restartedSession = await fetch(`${endpoint}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...packet, sessionId: 'next-session', packetId: 'shipos-local-next-session-1' }),
  })
  assert.equal(restartedSession.status, 202)
  assert.equal((await restartedSession.json()).accepted, 1)

  const invalid = await fetch(`${endpoint}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ship: 'No coordinates' }),
  })
  assert.equal(invalid.status, 202)
  assert.equal((await invalid.json()).accepted, 0)

  const allowedOrigin = await fetch(`${endpoint}/health`, { headers: { Origin: 'https://gaming.echoboardhq.com' } })
  assert.equal(allowedOrigin.headers.get('access-control-allow-origin'), 'https://gaming.echoboardhq.com')

  const deniedOrigin = await fetch(`${endpoint}/health`, { headers: { Origin: 'https://example.invalid' } })
  assert.equal(deniedOrigin.headers.get('access-control-allow-origin'), null)

  for (let index = 0; index < 6; index += 1) {
    const response = await fetch(`${endpoint}/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...packet, packetId: `log-cap-${index}`, notes: 'x'.repeat(220_000) }),
    })
    assert.equal(response.status, 202)
  }
  assert.ok((await stat(join(workdir, 'telemetry.jsonl'))).size <= 1_000_000)
})

async function waitForBridge(url) {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  throw new Error('ShipOS bridge did not start in time.')
}
