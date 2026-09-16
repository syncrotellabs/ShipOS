import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('ShipOS hydrates shared local state, namespaces legacy browser data, and preserves conflicts', async () => {
  const source = await readFile(new URL('../src/localState.ts', import.meta.url), 'utf8')
  assert.match(source, /shipos-beta-v2:/)
  assert.match(source, /shipos:state-hydrated/)
  assert.match(source, /expectedRevision: saved\.revision/)
  assert.match(source, /shipos-beta-recovery/)
  assert.match(source, /status === 409/)
  assert.doesNotMatch(source, /session\?\.role === 'viewer'/)
  assert.match(source, /shared\(key\) && conflict/)
  assert.doesNotMatch(source, /window\.location\.reload\(\)/)
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
