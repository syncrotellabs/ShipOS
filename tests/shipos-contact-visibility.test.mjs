import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('ShipOS pins GPS, friendly, and owned contacts above filters and search', async () => {
  const source = await readFile(new URL('../src/ShipOSPage.tsx', import.meta.url), 'utf8')

  assert.match(source, /function contactAlwaysVisible\(contact: ShipContact\)/)
  assert.match(source, /contact\.kind === 'gps' \|\| isFriendlyContact\(contact\)/)
  assert.match(source, /contactAlwaysVisible\(contact\) \|\| contactMatchesSearch/)
  assert.match(source, /function memoryContactAlwaysVisible\(contact: EncounterMemoryContact\)/)
  assert.match(source, /contact\.iff === 'friendly' \|\| contact\.iff === 'owned'/)
  assert.match(source, /if \(memoryContactAlwaysVisible\(contact\)\) return true/)
  assert.match(source, /GPS fixes and friendly or owned contacts are pinned to the chart/)
  assert.match(source, /Friendly \(Pinned\)/)
})

test('ShipOS enlarges map labels while preserving zoom scaling', async () => {
  const source = await readFile(new URL('../src/ShipOSPage.tsx', import.meta.url), 'utf8')

  assert.match(source, /const mapLabelSizeMultiplier = 1\.3/)
  assert.match(source, /const scaledWidth = width \* mapLabelSizeMultiplier/)
  assert.match(source, /const scaledHeight = height \* mapLabelSizeMultiplier/)
  assert.match(source, /baseLabelScale = \{ x: scaledWidth, y: scaledHeight \}/)
})
