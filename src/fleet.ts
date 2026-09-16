import type { TaggedGridTelemetry, TelemetryPacket } from './ShipOSPage'

export const FLEET_TAG = '[ShipOS]'

export function playerTrailPacket(packet: TelemetryPacket): TelemetryPacket {
  // Full fleet history stays in bounded SQLite, not 240 duplicate browser-cache snapshots.
  const { fleet: _fleet, ...player } = packet
  return player
}

// Only the mod's dedicated fleet records qualify. Manual map IFF/notes are never consulted.
export function friendlyFleet(packet: TelemetryPacket | null): TaggedGridTelemetry[] {
  if (packet?.source !== 'local-mod' || !Array.isArray(packet.fleet)) return []
  const seen = new Set<string>()
  return packet.fleet.filter(grid => {
    if (!grid || typeof grid.name !== 'string' || grid.tag !== FLEET_TAG || !grid.name.toLowerCase().includes(FLEET_TAG.toLowerCase())) return false
    if (grid.relationship !== 'owned' && grid.relationship !== 'friendly') return false
    if (grid.kind !== 'ship' && grid.kind !== 'station') return false
    if (!/^se--?\d+$/.test(grid.id) || seen.has(grid.id)) return false
    if (![grid.x, grid.y, grid.z].every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e12)) return false
    seen.add(grid.id)
    return true
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) || a.id.localeCompare(b.id))
}

export function fleetLabel(grid: TaggedGridTelemetry) {
  return `${grid.name} · ${grid.kind === 'station' ? 'base' : 'grid'} · ${grid.id.slice(3)}`
}

export function focusedTelemetry(packet: TelemetryPacket | null, grid: TaggedGridTelemetry | undefined): TelemetryPacket | null {
  if (!packet || !grid) return packet
  // Deliberately do NOT spread the player packet: missing grid readings must stay unknown.
  return { ...grid, source: packet.source, worldId: packet.worldId, modVersion: packet.modVersion, stamp: packet.stamp, packetId: `${packet.packetId || packet.stamp}:${grid.id}` }
}
