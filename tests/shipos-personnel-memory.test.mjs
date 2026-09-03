import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('ShipOS opens crew and passenger entries as editable personnel files', async () => {
  const source = await readFile(new URL('../src/ShipOSPage.tsx', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/ShipOSPage.css', import.meta.url), 'utf8')

  assert.match(source, /type PersonnelFileSelection/)
  assert.match(source, /aria-label={`Open editable personnel file for \$\{member\.name\}`}/)
  assert.match(source, /aria-label={`Open editable passenger file for \$\{file\.name\}`}/)
  assert.match(source, /className="shipOsModal shipOsPersonnelFileModal"/)
  assert.match(source, /renderCrewForm\([\s\S]*?'Save personnel file'/)
  assert.match(source, /renderPassengerForm\([\s\S]*?'Save passenger file'/)
  assert.match(styles, /\.shipOsPersonnelFileTrigger/)
  assert.match(styles, /\.shipOsPersonnelFileModal/)
})

test('ShipOS retains departed contacts in one noninteractive GPU point cloud', async () => {
  const source = await readFile(new URL('../src/ShipOSPage.tsx', import.meta.url), 'utf8')

  assert.match(source, /type EncounterMemoryContact/)
  assert.match(source, /'shipos-contact-memory'/)
  assert.match(source, /mergeEncounterMemory\(current, memoryContacts, seenAt\)/)
  assert.match(source, /const archivedEncounterMemory = useMemo/)
  assert.match(source, /const memoryGeometry = new THREE\.BufferGeometry\(\)/)
  assert.match(source, /const memoryCloud = new THREE\.Points\(memoryGeometry, memoryMaterial\)/)
  assert.match(source, /disableMapPicking\(memoryCloud\)/)
  assert.match(source, /encounterMemory={visibleEncounterMemory}/)
  assert.match(source, /Encounter Memory/)
})
