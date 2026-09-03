# ShipOS Local Telemetry Mod

This is the no-plugin-loader telemetry lane for ShipOS.

It is a local Space Engineers world mod. It does not use Pulsar, a client plugin DLL, Torch, or external network calls from inside Space Engineers.

## What It Does

- Adds a session component to the active world.
- Reads the local player's current controlled grid or character.
- Writes a fresh telemetry packet every two seconds to:

  ```text
  %APPDATA%\SpaceEngineers\Storage\ShipOSLocalTelemetry.latest.json
  ```

- Includes current position, velocity, speed, nearby contacts within 250 km, and contact velocity vectors when the local physics API exposes them. Position packets update every two seconds; the heavier nearby-contact scan is cached for ten seconds.
- Publishes every loaded planet as a global registry on each contact scan, even when the ship is outside normal sensor range. Each body includes its stable Space Engineers entity ID, generator, voxel-storage name, exact center, physical radius, atmosphere state, and surface gravity.
- When the player is controlling a cockpit or remote control inside a planet's gravity well, includes HUD surface altitude, sea-level altitude, gravity and orientation vectors, vertical speed, horizontal speed, and the nearest planet center. ShipOS uses these fields for its artificial horizon and landing-flight display.
- Below 12 km AGL, casts a 30-point forward/downward terrain fan every two seconds. The fan samples voxel terrain across six ranges out to 1.6 km and feeds ShipOS's synthetic FLIR terrain mesh, minimum-clearance warning, and terrain-ahead readouts. This is elevation imagery, not thermal imaging, and it does not fly the ship.
- Marks grid contacts with owned/friendly/neutral/hostile relationship metadata when available, and identifies antenna/beacon-capable grids as antenna contacts. ShipOS displays owned/friendly antenna contacts green and neutral antenna contacts grey/ivory.
- The ShipOS bridge watches that file and exposes it at:

  ```text
  http://127.0.0.1:8795/telemetry/latest
  ```

  The local bridge stays bound to the Space Engineers PC. The tray helper can push packets to EchoBoard's private hosted relay for other devices:

  ```text
  /api/shipos/telemetry/latest
  ```

## Install

1. Extract this ZIP.
2. Run:

   ```bat
   install-shipos-local-telemetry-mod.cmd
   ```

3. Open Space Engineers.
4. Edit your save, add the local mod named `ShipOSLocalTelemetry`, and load the world.
5. Start the bridge with:

   ```bat
   start-shipos-local-mod-bridge.cmd
   ```

   The ZIP includes this launcher and the bridge helper next to the installer.

6. In ShipOS on the same PC, keep the bridge endpoint set to:

   ```text
   http://127.0.0.1:8795/telemetry/latest
   ```

   For another device, pair the tray helper with a private relay key from ShipOS and use `/api/shipos/telemetry/latest`.

## Notes

- The mod only writes a local file. It does not post to the web.
- You can leave ShipOS auto-polling on; the bridge will import new packets as the file changes.
- If ShipOS reports that the relay is online but the game packet is stale, inspect the newest `%APPDATA%\SpaceEngineers\SpaceEngineers_*.log` for `ShipOSLocalTelemetry`, reinstall the current local mod package, and reload the world.
- Antenna contact detection depends on what the local game API exposes for loaded grids. If a grid does not expose an antenna or beacon block, it still appears as a normal owned/friendly/neutral/hostile grid contact.
- The terrain scanner does not require camera blocks. It uses local mod physics raycasts, ignores grids and characters, and only accepts voxel/planet returns. It enters standby above 12 km AGL.
- Planet registry telemetry is the authoritative live source. Reading `SANDBOX_0_0_0_.sbs` is a useful fallback, but that file only reflects the last manual save or autosave rather than the current running session.
- ShipOS keeps its lore name separate from the underlying planet identity. A newly spawned second EarthLike or Mars body therefore appears as a distinct chart body instead of overwriting Helena or Ares.
- If the save is already running, add the mod from the save's mod list and reload the world.
- After updating this package, run the installer again and fully reload the world so the new session component replaces the old one.
- If you swap worlds, the same bridge path still works because the latest packet file is global storage.
- The default helper does not require a Windows Firewall exception because it does not listen on the LAN.
