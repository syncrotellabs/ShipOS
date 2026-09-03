import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('ShipOS groups portrait sheets and collapses metagame spans on narrow screens', async () => {
  const source = await readFile(new URL('../src/ShipOSPage.tsx', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/ShipOSPage.css', import.meta.url), 'utf8')

  assert.match(source, /label: 'Shipboard Core'/)
  assert.match(source, /label: 'Medical & Rescue'/)
  assert.match(source, /label: 'Authority & Network'/)
  assert.match(source, /className="shipOsPortraitCollections"/)
  assert.match(source, /portraitSheetConfigs\.map\(\(sheet\)/)

  assert.match(styles, /\.shipOsPortraitCollections \{[\s\S]*?max-height: 480px;[\s\S]*?overflow: auto;/)
  assert.match(styles, /@media \(max-width: 1100px\)[\s\S]*?\.shipOsGeneratedPortraitPanel,[\s\S]*?\.shipOsMetagameRecordsPanel \{[\s\S]*?grid-column: 1;/)
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.shipOsPortraitGrid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/)
})
