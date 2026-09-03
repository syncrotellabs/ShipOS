import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const sourceUrl = new URL('../src/ShipOSPage.tsx', import.meta.url)

test('ShipOS canonical Europa snapshot stays internally consistent', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  const crewBlock = source.match(/const initialCrew: CrewMember\[\] = \[(.*?)\n\]/s)?.[1] ?? ''
  const passengerBlock = source.match(/const initialPassengerFiles: PassengerFile\[\] = \[(.*?)\n\]/s)?.[1] ?? ''
  const squawkBlock = source.match(/const initialSquawks: SquawkRecord\[\] = \[(.*?)\n\]/s)?.[1] ?? ''

  assert.match(source, /currentVoyageLabel = 'Ares -> Europa'/)
  assert.match(source, /currentSoulsAboard = 15/)
  assert.match(source, /destinationId: 'body-europa'/)
  assert.match(source, /job-ares-europa-pelagos-passage.*status: 'In Transit'/)
  assert.match(source, /job-relay-e17-maintenance.*status: 'Prospect'/)
  assert.match(source, /meta-relay-e17.*status: 'Prospect - NOT ACCEPTED'/)
  assert.match(source, /HISTORIC DAMAGE - PRESERVED/)
  assert.match(source, /ABIGAIL Mk VII.*ONLINE \/ SUPERVISED OPERATIONAL/)
  assert.match(source, /setMetagameRecords\(\(current\) => upsertRecords\(current, initialMetagameRecords\)\)/)

  assert.equal((crewBlock.match(/id: 'crew-/g) ?? []).length, 8)
  assert.equal((passengerBlock.match(/jobId: 'job-ares-europa-pelagos-passage'/g) ?? []).length, 7)
  assert.equal((squawkBlock.match(/state: 'OPEN'/g) ?? []).length, 4)
  assert.equal((squawkBlock.match(/state: 'WATCH'/g) ?? []).length, 6)
  assert.equal((squawkBlock.match(/state: 'GROUNDING'/g) ?? []).length, 0)
})
