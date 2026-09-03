import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('ShipOS hydrates remote campaign state without reloading the console', async () => {
  const source = await readFile(new URL('../src/ShipOSPage.tsx', import.meta.url), 'utf8')
  const hydrateStart = source.indexOf('const hydrate = async () =>')
  const hydrateEnd = source.indexOf('telemetryHistoryRef.current = telemetryHistory', hydrateStart)
  const hydrateSource = source.slice(hydrateStart, hydrateEnd)

  assert.ok(hydrateStart >= 0 && hydrateEnd > hydrateStart, 'campaign hydration block should exist')
  assert.match(hydrateSource, /applyShipOsRemoteState\(remote\.state\)/)
  assert.match(hydrateSource, /shipOsStateHydratedEvent/)
  assert.doesNotMatch(hydrateSource, /window\.location\.reload\(\)/)

  assert.match(source, /window\.localStorage\.removeItem\(key\)/)
  assert.match(source, /!shipOsLocalOnlyStateKeys\.has\(key\)/)
  assert.match(source, /applyShipOsBackupState\(payload\.state\)/)
})

test('ShipOS treats live sensor contacts as a replaceable packet snapshot', async () => {
  const source = await readFile(new URL('../src/ShipOSPage.tsx', import.meta.url), 'utf8')
  const ingestStart = source.indexOf('const ingestTelemetryPacket =')
  const ingestEnd = source.indexOf('const clearTelemetryTrail =', ingestStart)
  const ingestSource = source.slice(ingestStart, ingestEnd)

  assert.match(source, /const \[liveTelemetryContacts, setLiveTelemetryContacts\] = useState<ShipContact\[\]>/)
  assert.match(source, /\.\.\.liveTelemetryContacts/)
  assert.match(ingestSource, /if \(Array\.isArray\(packet\.contacts\)\) \{[\s\S]*?setLiveTelemetryContacts\(nonBodyContacts\)/)
  assert.doesNotMatch(ingestSource, /setCustomContacts/)
  assert.match(source, /!isTelemetryManagedContact\(contact\) \|\| Boolean\(contact\.manualName \|\| contact\.manualRecord\)/)
  assert.match(source, /applySavedTelemetryContactOverride/)
})
