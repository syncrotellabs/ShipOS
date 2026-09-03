import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('standalone ShipOS opens in the free navigation experience', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const page = await readFile(new URL('../src/ShipOSPage.tsx', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/global.css', import.meta.url), 'utf8')
  const vite = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8')
  const helper = await readFile(new URL('../public/shipos/addons/shipos-helper-tray.ps1', import.meta.url), 'utf8')

  assert.match(app, /experience="navigation"/)
  assert.match(page, /export type ShipOSExperience = 'navigation' \| 'console'/)
  assert.match(page, /isNavigationExperience \? 'ShipOS Navigation'/)
  assert.match(page, /!isNavigationExperience && renderTab\(\)/)
  assert.match(page, /isNavigationExperience \? 'Return to vessel'/)
  assert.match(page, /status: 'Connecting to local telemetry'/)
  assert.match(page, /autoPoll: true/)
  assert.match(page, /if \(!isNavigationExperience \|\| bridgeConfig\.autoPoll\) return/)
  assert.match(page, /void pollTelemetryBridgeRef\.current\(\{ silent: true \}\)/)
  assert.match(page, /defaultBridgeEndpoint = '\/shipos-bridge\/telemetry\/latest'/)
  assert.match(vite, /host: '0\.0\.0\.0'/)
  assert.match(vite, /'\/shipos-bridge': localTelemetryProxy/)
  assert.match(app, /QRCode\.toDataURL\(nextShareUrl/)
  assert.match(app, /Telemetry stays on your local network/)
  assert.match(styles, /\.shipOsShareQr/)
  assert.match(helper, /Show iPad QR code\.\.\./)
  assert.match(helper, /Copy iPad link/)
  assert.match(helper, /Open-Uri \$localShipOsUrl/)
})
