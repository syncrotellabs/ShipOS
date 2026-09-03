# ShipOS Client Plugin

Native Space Engineers client plugin source for sending local single-player/client telemetry into the ShipOS bridge.

## What This Does

- Reads the current local Space Engineers client session.
- Finds the controlled entity/player position.
- Scans nearby visible entities for grids, voxel/asteroid bodies, unknown contacts, and antenna/beacon-capable grid contacts when the client API exposes those blocks.
- Publishes all loaded planets as a global registry with stable entity IDs, exact centers, physical radii, generators, storage names, atmosphere state, and surface gravity. Planet registry records are not limited by the nearby-contact range.
- Includes absolute velocity vectors and speed for observed contacts when physics data is exposed.
- When a cockpit or remote control is active in natural gravity, includes HUD surface altitude, sea-level altitude, gravity and orientation vectors, vertical and horizontal speed, and the nearest planet center for the ShipOS flight director.
- Below 12 km AGL, samples a 30-point voxel-terrain fan out to 1.6 km for ShipOS's synthetic FLIR terrain mesh and speed-adjusted clearance warnings. This is sampled elevation data rather than thermal imagery.
- Posts packets to the local ShipOS bridge at `http://127.0.0.1:8795/telemetry`.
- Keeps all telemetry local unless you deliberately change the endpoint.

This is intended for single-player or local hosted play. It does not require Torch or multiplayer.

## Current Loader Target

The old `sepluginloader` Plugin Loader project is archived/deprecated. For current client-plugin use, target Pulsar's Space Engineers 1 `Legacy` loader path first. The code is deliberately simple and still follows the classic `VRage.Plugins.IPlugin` shape used by the older template.

## Requirements

- Space Engineers 1 installed.
- Pulsar or another compatible Space Engineers client plugin loader.
- .NET Framework 4.8.1 Developer Pack or Visual Studio Build Tools with .NET Framework targeting pack.
- A running ShipOS bridge:

```bat
start-shipos-bridge.cmd
```

## Build

The build script checks these locations automatically:

```text
C:\Program Files (x86)\Steam\steamapps\common\SpaceEngineers\Bin64
D:\SteamLibrary\steamapps\common\SpaceEngineers\Bin64
```

If Space Engineers is somewhere else, set `SpaceEngineersBin64` first:

```bat
set "SpaceEngineersBin64=E:\SteamLibrary\steamapps\common\SpaceEngineers\Bin64"
```

Then build:

```bat
build.cmd
```

The DLL is written to:

```text
bin\Release\net481\ShipOSClientPlugin.dll
```

The ShipOS download ZIP may also include a prebuilt `ShipOSClientPlugin.dll` when the package was generated on a machine with Space Engineers installed. If your loader rejects it or you change the source, rebuild locally with `build.cmd`.

Load that DLL as a local/custom plugin in Pulsar or your compatible plugin loader.

## Runtime Config

On first run, the plugin writes:

```text
%APPDATA%\SpaceEngineers\Storage\ShipOSClientPlugin.cfg
```

Example:

```text
Endpoint=http://127.0.0.1:8795/telemetry
ShipName=DSV Intrepid
IntervalSeconds=2
ContactRangeMeters=250000
MaxContacts=80
```

Restart Space Engineers after changing the config.

## Bridge Flow

1. Start the local bridge with `start-shipos-bridge.cmd`.
2. Start Space Engineers through Pulsar or your plugin loader.
3. Enable/load `ShipOSClientPlugin.dll`.
4. Open ShipOS -> Cargo and Ship Systems.
5. In Live Bridge Console, enable auto-poll or press `Poll bridge once`.

## Packet Shape

The plugin posts packets compatible with ShipOS:

```json
{
  "protocol": "shipos.telemetry.v1",
  "source": "client-plugin",
  "ship": "DSV Intrepid",
  "x": 42000,
  "y": 142000,
  "z": -98000,
  "velocityX": 0,
  "velocityY": 0,
  "velocityZ": 12.4,
  "speed": 12.4,
  "surfaceAltitude": 1840.2,
  "seaLevelAltitude": 2261.7,
  "verticalSpeed": 18.3,
  "horizontalSpeed": 7.4,
  "naturalGravity": 0.91,
  "gravityX": 0,
  "gravityY": -8.927,
  "gravityZ": 0,
  "forwardX": 0,
  "forwardY": 0.31,
  "forwardZ": -0.951,
  "upX": 0,
  "upY": 0.951,
  "upZ": 0.31,
  "contacts": [
    { "kind": "ship", "name": "Nearby Grid", "x": 72000, "y": 138000, "z": -121000, "velocityX": 0, "velocityY": 0, "velocityZ": -4.2, "speed": 4.2 }
  ]
}
```

## Limits

This sees what the client session can see through the exposed API. It is excellent for current position, velocity, the loaded planet registry, nearby visible grids, antenna/beacon-capable owned/friendly or neutral contacts, and voxel/asteroid-style contacts. It is not a magic dump of hidden GPS entries, ores, or server-only data. Keep using ShipOS GPS import for private GPS points until we add a deeper collector.
