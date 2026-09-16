import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { friendlyFleet, focusedTelemetry, fleetLabel, playerTrailPacket } from '../src/fleet.ts'
import { validatePacket, createShipOsServer } from '../runtime/server.mjs'

const grid = (overrides = {}) => ({ id: 'se-1234567890123456789', name: '[ShipOS] Drone 2', ship: '[ShipOS] Drone 2', tag: '[ShipOS]', relationship: 'owned', kind: 'ship', controlMode: 'grid', x: 10, y: 20, z: 30, speed: 42, batteryPercent: 75, ...overrides })
const packet = (fleet = [grid()]) => ({ source: 'local-mod', worldId: 'fleet-test-world', worldName: 'Fleet test', stamp: new Date().toISOString(), packetId: 'fleet-1', x: 1, y: 2, z: 3, speed: 0, surfaceAltitude: 0, batteryPercent: 90, terrainScan: [], fleetTag: '[ShipOS]', fleet })

test('fleet uses only tagged, owned/friendly game records, not manually friendly contacts', () => {
  const input = packet([
    grid(), grid({ id: 'se-2', name: '[sHiPoS] Drone 10', relationship: 'friendly' }),
    grid({ id: 'se-3', relationship: 'hostile' }), grid({ id: 'se-4', relationship: 'neutral' }),
    grid({ id: 'se-5', name: 'No tag' }), grid({ id: 'se-6', tag: '' }),
    grid({ id: 'se-7', relationship: 'unknown' }), grid({ id: 'se-8', kind: 'body' }),
    grid({ id: 'se-9', x: NaN }), grid(),
  ])
  input.contacts = [grid({ id: 'se-99', relationship: 'friendly' })]
  assert.deepEqual(friendlyFleet(input).map(g => g.id), ['se-1234567890123456789', 'se-2'])
  assert.deepEqual(friendlyFleet({ ...input, source: 'manual' }), [])
  assert.deepEqual(friendlyFleet({ ...input, fleet: undefined }), [])
  assert.deepEqual(friendlyFleet(null), [])
})

test('focus readings never inherit player values and stable IDs disambiguate duplicate names', () => {
  const first = grid({ batteryPercent: undefined })
  const second = grid({ id: 'se-2' })
  const parent = packet([first, second])
  const reading = focusedTelemetry(parent, first)
  assert.equal(reading.speed, 42)
  assert.equal(reading.x, 10)
  assert.equal(reading.stamp, parent.stamp)
  assert.equal(reading.worldId, parent.worldId)
  assert.equal(reading.surfaceAltitude, undefined)
  assert.equal(reading.batteryPercent, undefined)
  assert.equal(reading.terrainScan, undefined)
  assert.equal(reading.fleet, undefined)
  assert.notEqual(fleetLabel(first), fleetLabel(second))
  assert.equal(focusedTelemetry(parent, undefined), parent)
  assert.deepEqual(friendlyFleet(packet([])), [])
  assert.equal(playerTrailPacket(parent).fleet, undefined)
  assert.equal(playerTrailPacket(parent).x, parent.x)
  assert.equal(parent.fleet.length, 2)
})

test('runtime rejects hostile, untagged, malformed, duplicate and oversized fleets', () => {
  assert.equal(validatePacket(packet()).fleet.length, 1)
  for (const bad of [{ relationship: 'hostile' }, { relationship: 'neutral' }, { relationship: 'unknown' }, { name: 'Drone' }, { tag: '' }, { x: 1e13 }, { x: '10' }, { id: 'invalid' }, { kind: 'radar' }]) {
    assert.throws(() => validatePacket(packet([grid(bad)])))
  }
  assert.throws(() => validatePacket(packet([grid(), grid()])))
  assert.throws(() => validatePacket(packet(Array.from({ length: 129 }, (_, i) => grid({ id: `se-${i}` })))))
  assert.throws(() => validatePacket({ ...packet(), source: 'manual' }))
  assert.throws(() => validatePacket({ ...packet(), fleetTag: 'different-tag' }))
})

test('API preserves distinct fleet readings and removes a disappeared grid on the next packet', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'shipos-fleet-test-'))
  const app = await createShipOsServer({ port: 0, dataDir, watchFile: '' })
  try {
    const session = await fetch(app.url + '/api/session')
    const headers = { Cookie: session.headers.get('set-cookie').split(';')[0] }
    const original = packet()
    app.ingest(original)
    const response = await (await fetch(app.url + '/api/telemetry/latest', { headers })).json()
    assert.equal(response.speed, 0)
    assert.equal(response.fleet[0].speed, 42)
    assert.equal(response.fleet[0].id, 'se-1234567890123456789')
    app.ingest({ ...original, packetId: 'fleet-2', fleet: [] })
    assert.deepEqual((await (await fetch(app.url + '/api/telemetry/latest', { headers })).json()).fleet, [])
    assert.deepEqual((await (await fetch(app.url + '/api/state', { headers })).json()).state, {})
  } finally {
    await app.close()
    assert.ok(path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(dataDir).startsWith('shipos-fleet-test-'))
    await rm(dataDir, { recursive: true, force: true })
  }
})

test('mod gates fleet telemetry on current name and all major owners; refocus is outside configuration', async () => {
  const mod = await readFile(new URL('../public/shipos/addons/shipos-local-telemetry-mod/ShipOSLocalTelemetry/Data/Scripts/ShipOSLocalTelemetry/ShipOSLocalTelemetrySession.cs', import.meta.url), 'utf8')
  const page = await readFile(new URL('../src/ShipOSPage.tsx', import.meta.url), 'utf8')
  assert.match(mod, /grid\.CustomName\.IndexOf\(FleetTag, StringComparison\.OrdinalIgnoreCase\)/)
  assert.match(mod, /if \(relationship != "owned" && relationship != "friendly"\) continue/)
  assert.match(mod, /foreach \(long ownerId in owners\)/)
  assert.match(mod, /if \(relation == "hostile"\) return "hostile"/)
  assert.doesNotMatch(mod, /name\.Contains\("(pirate|hostile|enemy|raider)"\)/)
  assert.match(page, /id="telemetry-focus"/)
  assert.ok(page.indexOf('<option value={currentShipContactId}>Player') < page.indexOf('{fleet.map(grid => <option'))
  assert.ok(page.indexOf('aria-label="Telemetry focus"') < page.indexOf('className="betaConfiguration"'))
  assert.match(page, /onClick=\{\(\) => refocusTelemetry\(\)\}/)
  assert.match(page, /That grid is no longer in the tagged friendly fleet/)
  assert.match(page, /height = Math\.max\(height, unitsPerPixel \* 40\)/)
  assert.doesNotMatch(page, /YOU \/ INTREPID/)
})
