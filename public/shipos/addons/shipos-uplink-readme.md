# ShipOS Telemetry Uplink

ShipOS supports four telemetry lanes:

1. **Vanilla programmable block lane**
   - The programmable block script gathers ship telemetry, including cockpit altitude and orientation in a planetary gravity well.
   - It writes JSON to `Echo`, an optional `[SHIPOS TELEMETRY]` LCD, and the `INTREPID_TELEMETRY` IGC channel.
   - Paste the JSON into ShipOS manually when you want a quick update.

2. **Live bridge lane**
   - Run the local bridge helper on the same machine as Space Engineers:

     ```bash
     node shipos-telemetry-bridge.mjs
     ```

   - For normal play, use `shipos-helper.zip` or `start-shipos-helper-tray.cmd`. The tray helper installs a helmet icon in the Windows system tray and exposes the common bridge actions:

     ```text
     Open ShipOS
     Open local bridge health
     Health check
     Latest packet
     Copy local endpoint
     Copy EchoBoard relay endpoint
     Pair EchoBoard relay key
     Open helper log folder
     Restart bridge
     Stop bridge
     Install desktop shortcut
     ```

   - `install-shipos-helper-shortcut.cmd` creates a desktop shortcut named `ShipOS Telemetry Helper`. The shortcut starts the tray helper silently and uses the same helmet icon.

   - ShipOS reads from:

     ```text
     http://127.0.0.1:8795/telemetry/latest
     ```

   - The local bridge binds to `127.0.0.1` by default so telemetry is not exposed to the LAN. The bundled helper pushes accepted packets to the private EchoBoard relay:

     ```text
     https://gaming.echoboardhq.com/api/shipos/telemetry
     ```

     In ShipOS, sign in, choose **Create private relay key**, then right-click the helmet tray icon and choose **Pair EchoBoard relay key**. The hosted UI can then read `/api/shipos/telemetry/latest` from any signed-in PC, phone, or tablet.

   - Any companion mod, Torch plugin, local utility, or future adapter can POST packets to:

     ```text
     http://127.0.0.1:8795/telemetry
     ```

3. **Local world mod lane**
   - Install the local mod package from `shipos-local-telemetry-mod.zip`.
   - Add the local mod named `ShipOSLocalTelemetry` to your save and reload the world.
   - Start the watcher launcher:

     ```bat
     start-shipos-local-mod-bridge.cmd
     ```

   - The mod writes a local JSON packet every two seconds to:

     ```text
     %APPDATA%\SpaceEngineers\Storage\ShipOSLocalTelemetry.latest.json
     ```

   - The bridge watches that file and imports current position, speed, velocity, nearby contacts, planetary flight-director data, a global live planet registry, and a 30-point terrain scan from the active cockpit or remote control.
   - The planet registry reports exact in-game centers, radii, generators, voxel-storage names, atmosphere state, and stable entity IDs. It is not limited to the 250 km contact sphere, so newly spawned planets become available to the chart on the next heavy scan.
   - Below 12 km AGL, the current mod scans voxel elevation in a forward/downward fan out to 1.6 km. ShipOS renders those samples as synthetic FLIR terrain imagery with minimum-clearance alerts. No camera blocks are required.
   - This lane does not require Pulsar, Torch, or a native client plugin loader.

4. **Native client plugin lane**
   - Build the client plugin in `shipos-client-plugin/`.
   - Start Space Engineers through Pulsar or a compatible client plugin loader.
   - The plugin reads the local client session and posts current position, velocity, visible contacts, the global live planet registry, and planetary flight-director data to the same bridge endpoint.

Vanilla Space Engineers programmable blocks cannot directly POST to a website. They can emit data inside the game through text surfaces, `Echo`, and IGC broadcasts. A bridge/plugin/mod is the relay that carries those packets into ShipOS.

## Bridge Endpoints

- `GET /health`
- `GET /telemetry/latest`
- `GET /telemetry/history?limit=50`
- `GET /telemetry/events`
- `POST /telemetry`
- `POST /telemetry/raw`

## File Watch Mode

Set `SHIPOS_WATCH_FILE` before starting the bridge to make it import packets from a local JSON file:

```bat
set "SHIPOS_WATCH_FILE=%APPDATA%\SpaceEngineers\Storage\ShipOSLocalTelemetry.latest.json"
set "SHIPOS_TELEMETRY_HOST=127.0.0.1"
set "SHIPOS_REMOTE_PUSH_URL=https://gaming.echoboardhq.com/api/shipos/telemetry"
set "SHIPOS_REMOTE_PUSH_KEY=PASTE_YOUR_PRIVATE_RELAY_KEY"
node shipos-telemetry-bridge.mjs
```

`start-shipos-local-mod-bridge.cmd` does this for the local world mod automatically.

## Example Manual POST

```bash
curl -X POST http://127.0.0.1:8795/telemetry ^
  -H "Content-Type: application/json" ^
  -d "{\"ship\":\"DSV Intrepid\",\"x\":42000,\"y\":142000,\"z\":-98000,\"speed\":12.4}"
```

Telemetry packets may also include map contacts. The local mod and client plugin can add `relationship`, `contactSource`, and `antennaName` when they can identify a grid, beacon, or antenna:

```json
{
  "ship": "DSV Intrepid",
  "x": 42000,
  "y": 142000,
  "z": -98000,
  "contacts": [
    { "id": "asteroid-01", "name": "Nickel Asteroid", "kind": "asteroid", "x": 72000, "y": 138000, "z": -121000 },
    { "id": "radar-ghost-17", "name": "Radar Contact 17", "kind": "radar", "x": 118000, "y": 150000, "z": -166000 },
    { "id": "unknown-signal-a", "name": "Unidentified Signal A", "kind": "signal", "x": 91000, "y": 99000, "z": -220000 },
    { "id": "grid-owned-antenna", "name": "Asterion Relay Skiff", "kind": "ship", "relationship": "owned", "contactSource": "antenna", "antennaName": "Asterion Traffic Antenna", "x": 43000, "y": 142800, "z": -98400 }
  ]
}
```

ShipOS colors hostile contacts red, owned/friendly antenna contacts green, and neutral antenna contacts grey/ivory. If the game API does not expose an antenna/beacon block on a grid, the packet falls back to a normal grid contact with relationship metadata.

Planet contacts use `kind: "body"` and `contactSource: "planet-registry"`. ShipOS matches known campaign worlds by stable entity ID or voxel-storage name while preserving their lore names. A newly placed planet with the same generator as an existing world remains a separate contact. Save-file parsing is available as an offline fallback, but `SANDBOX_0_0_0_.sbs` only updates when Space Engineers saves the world.

## Programmable Block Arguments

- `setup`: writes default Custom Data and arms the optional LCD.
- `reload`: reloads Custom Data without resetting sequence.
- `reset`: resets packet sequence.
- `status`: prints current controller, panel, IGC tag, and scan count.
- `once`: accepted as a normal run argument for a one-off packet.

## Recommended Custom Data

```text
ShipName=DSV Intrepid
ControllerName=Intrepid Flight Seat
PanelName=[SHIPOS TELEMETRY]
IgcTag=INTREPID_TELEMETRY
WritePanel=true
BroadcastIgc=true
UpdateIntervalSeconds=10
# Contact=asteroid|Nickel Asteroid|72000|138000|-121000|Asteroid contact|Nickel-rich claim|#b58b5a
# GPS:Ice Claim:12345.67:-890.12:45678.9:#FF75D69D:
```

`UpdateIntervalSeconds` controls how often the programmable block emits a packet while running on `Update100`. Use `once` as the PB argument to force an immediate packet.

Uncomment or add `Contact=` lines to make the PB include map contacts in each telemetry packet. Format:

```text
Contact=kind|name|x|y|z|status|notes|color
```

Supported kinds are `gps`, `waypoint`, `asteroid`, `radar`, `signal`, `ship`, `station`, and `relay`. Raw Space Engineers `GPS:name:x:y:z:color:` lines are also accepted.

## Client Plugin

The starter native plugin package is in:

```text
shipos-client-plugin/
```

Build it with:

```bat
cd shipos-client-plugin
build.cmd
```

The plugin writes its config to:

```text
%APPDATA%\SpaceEngineers\Storage\ShipOSClientPlugin.cfg
```

It defaults to local-only telemetry:

```text
Endpoint=http://127.0.0.1:8795/telemetry
ShipName=DSV Intrepid
IntervalSeconds=2
ContactRangeMeters=250000
MaxContacts=80
```
