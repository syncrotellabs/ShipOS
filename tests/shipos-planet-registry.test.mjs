import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const webSourceUrl = new URL('../src/ShipOSPage.tsx', import.meta.url)
const modSourceUrl = new URL('../public/shipos/addons/shipos-local-telemetry-mod/ShipOSLocalTelemetry/Data/Scripts/ShipOSLocalTelemetry/ShipOSLocalTelemetrySession.cs', import.meta.url)
const pluginSourceUrl = new URL('../integrations/legacy-client-plugin/Plugin.cs', import.meta.url)

test('ShipOS keeps neutral presets separate from stable live Space Engineers identities', async () => {
  const source = await readFile(webSourceUrl, 'utf8')

  assert.match(source, /generatorName: 'EarthLike', name: 'EarthLike'.*radiusMeters: 60000/)
  assert.doesNotMatch(source, /entityId: '3868533696819502467'/)
  assert.match(source, /const bodyIdByEntityId = new Map/)
  assert.match(source, /const bodyIdByStorageName = new Map/)
  assert.match(source, /contact\.contactSource === 'planet-registry' && \(entityId \|\| storageName\)/)
  assert.match(source, /Authoritative in-game registry/)
  assert.match(source, /Live Space Engineers planet registry/)
})

test('the local world mod publishes planets globally instead of classifying them as asteroids', async () => {
  const source = await readFile(modSourceUrl, 'utf8')

  assert.match(source, /using Sandbox\.Game\.Entities;/)
  assert.match(source, /GetEntities\(planets, entity => entity is MyPlanet\)/)
  assert.match(source, /planet\.LocationForHudMarker/)
  assert.match(source, /planet\.AverageRadius/)
  assert.match(source, /"contactSource", "planet-registry"/)
  assert.match(source, /if \(entity is MyPlanet\) return "body";/)
  assert.match(source, /ReadOrCreateWorldIdentity/)
  assert.match(source, /WriteFileInWorldStorage\(WorldIdentityFile/)
  assert.match(source, /"worldId", _worldId/)
  assert.match(source, /if \(controller == null\) AppendCharacterTelemetry/)
  assert.match(source, /CalculateNaturalGravityAt\(position, out interference\)/)
  assert.match(source, /GetClosestSurfacePointGlobal\(ref position\)/)
})

test('the native client plugin publishes the same stable planet registry contract', async () => {
  const source = await readFile(pluginSourceUrl, 'utf8')

  assert.match(source, /MyPlanet planet = entity as MyPlanet;/)
  assert.match(source, /Vector3D center = planet\.LocationForHudMarker;/)
  assert.match(source, /RadiusMeters = planet\.AverageRadius/)
  assert.match(source, /ContactSource = "planet-registry"/)
  assert.match(source, /Plugin\.AppendJson\(json, "entityId"/)
})
