import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('standalone ShipOS opens in the free navigation experience', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const page = await readFile(new URL('../src/ShipOSPage.tsx', import.meta.url), 'utf8')

  assert.match(app, /experience="navigation"/)
  assert.match(page, /export type ShipOSExperience = 'navigation' \| 'console'/)
  assert.match(page, /isNavigationExperience \? 'ShipOS Navigation'/)
  assert.match(page, /!isNavigationExperience && renderTab\(\)/)
  assert.match(page, /isNavigationExperience \? 'Return to vessel'/)
  assert.match(page, /status: 'Connecting to local telemetry'/)
  assert.match(page, /autoPoll: true/)
  assert.match(page, /if \(!isNavigationExperience \|\| bridgeConfig\.autoPoll\) return/)
  assert.match(page, /void pollTelemetryBridgeRef\.current\(\{ silent: true \}\)/)
})
