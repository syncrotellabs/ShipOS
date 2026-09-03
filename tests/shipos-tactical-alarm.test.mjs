import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('ShipOS keeps asteroid caution alarms without drawing asteroid or hostile spheres', async () => {
  const source = await readFile(new URL('../src/ShipOSPage.tsx', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/ShipOSPage.css', import.meta.url), 'utf8')
  const envelopeStart = source.indexOf('function contactDefenseEnvelope')
  const envelopeEnd = source.indexOf('function contactIffFilterId', envelopeStart)
  const envelopeSource = source.slice(envelopeStart, envelopeEnd)
  const clusterStart = source.indexOf('asteroidClusters.forEach')
  const clusterEnd = source.indexOf('contacts.forEach', clusterStart)
  const clusterSource = source.slice(clusterStart, clusterEnd)

  assert.match(source, /const asteroidCautionEnvelopeMeters = 2000/)
  assert.match(envelopeSource, /isHostileContact\(contact\) \|\| contact\.kind === 'asteroid'\) return null/)
  assert.doesNotMatch(envelopeSource, /hostile threat envelope|asteroid caution envelope/)
  assert.doesNotMatch(clusterSource, /addDefenseEnvelope/)
  assert.match(source, /const masterAlarmAltitudeCautionMeters = 1000/)
  assert.match(source, /const masterAlarmCautionDurationMs = 5000/)
  assert.match(source, /terrainCritical[\s\S]*Terrain clearance/)
  assert.match(source, /press to reset/)
  assert.match(source, /shipos-alarm-sound-uplink-enabled/)
  assert.match(source, /Uplink \{alarmSoundUplinkEnabled \? 'Enabled' : 'Disabled'\}/)

  assert.match(styles, /\.shipOsMasterAlarm-caution[\s\S]*#e8bd19/)
  assert.match(styles, /\.shipOsMasterAlarm-critical[\s\S]*#e21b1b/)
  assert.match(styles, /-2px -2px 0 #000/)
  assert.match(styles, /\.shipOsTacticalCommandBar \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
})
