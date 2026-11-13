import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const webSourceUrl = new URL('../src/ShipOSPage.tsx', import.meta.url)
const modSourceUrl = new URL('../public/shipos/addons/shipos-local-telemetry-mod/ShipOSLocalTelemetry/Data/Scripts/ShipOSLocalTelemetry/ShipOSLocalTelemetrySession.cs', import.meta.url)

test('the local world mod publishes the player GPS list as stable map contacts', async () => {
  const source = await readFile(modSourceUrl, 'utf8')

  assert.match(source, /Session\.GPS\.GetGpsList\(MyAPIGateway\.Session\.Player\.IdentityId, gpsPoints\)/)
  assert.match(source, /"id", "se-gps-" \+ gps\.Hash/)
  assert.match(source, /"kind", "gps"/)
  assert.match(source, /"contactSource", "game-gps"/)
  assert.match(source, /gps\.ShowOnHud \? "Visible on Space Engineers HUD" : "Stored in Space Engineers GPS"/)
})

test('the map projects a live attitude course independent from the planned destination', async () => {
  const source = await readFile(webSourceUrl, 'utf8')

  assert.match(source, /function latestShipAttitude\(attitudeTelemetry: TelemetryPacket \| null/)
  assert.match(source, /telemetryVectorFromKeys\(attitudePacket, 'forwardX', 'forwardY', 'forwardZ'\)/)
  assert.match(source, /telemetryVectorFromKeys\(attitudePacket, 'upX', 'upY', 'upZ'\)/)
  assert.match(source, /const forwardDirection = shipVector\.clone\(\)/)
  assert.match(source, /courseLine\.userData\.attitudeCourse = true/)
  assert.match(source, /camera\.up\.copy\(shipUp\)/)
  assert.match(source, /TRACK ATTITUDE COURSE/)
})

test('automatic GPS contacts are pinned and replace duplicate manual imports', async () => {
  const source = await readFile(webSourceUrl, 'utf8')

  assert.match(source, /function dedupeGpsContacts\(contacts: ShipContact\[\]\)/)
  assert.match(source, /contact\.telemetryManaged && !deduped\[existingIndex\]\.telemetryManaged/)
  assert.match(source, /dedupeGpsContacts\(\[\.\.\.contacts/)
  assert.match(source, /'game-gps'/)
})
