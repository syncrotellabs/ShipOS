# ShipOS local telemetry mod

The supported beta telemetry source is a local world mod; no plugin loader, cloud service, or programmable block is required.

It reads the controlled character or cockpit and writes `Storage/ShipOSLocalTelemetry.latest.json` in Space Engineers' application-data folder every two simulation seconds. Nearby contact scans run every ten simulation seconds. All loaded planets are reported with their game identity and real center/radius.

Character and cockpit telemetry include position, velocity, gravity, orientation, and planetary altitude when available. The character surface altitude is derived from the closest planet surface; the cockpit value uses the game's elevation API. The 30-sample forward terrain scanner is cockpit-only, within 12 km AGL. This is terrain elevation, not thermal imagery or autopilot.

The mod stores `ShipOS.world-id.txt` in world storage to keep separate stories across saves. Save the world after first use. A copied save also copies this identity; remove that file from the copied world's ShipOS storage before loading it if you want an independent story.

## Tagged friendly fleet (mod 2026.09.04.1)

Add `[ShipOS]` anywhere in a **grid name** (Info tab), e.g. `[ShipOS] Mining Drone`. The tag is case-insensitive; naming a block, antenna, or group does not opt in a grid. Every separate grid/subgrid needs its own name tag.

The mod includes only owned grids or grids whose major owners are all friendly by game faction relations. Mixed hostile/neutral ownership, unowned grids, and unresolved ownership do not qualify. Names, tags, antenna broadcasts, and manually edited map IFF cannot grant friendly status.

The Focus dropdown lists Player first, then eligible grids sorted by name; IDs distinguish identical names. Selecting a grid centers the map and displays its own position, velocity, gravity, orientation, altitude, battery charge, cargo-container fill and terminal-block condition. Missing systems are not reported as zero. Refocus returns the camera to the selected subject after panning. Removing a tag, losing friendly ownership, destruction or unloading removes that grid; selection returns to Player.

Discovery runs every ten simulation seconds, readings and eligibility checks every two. All loaded grids are eligible regardless of the nearby-contact range; unloaded grids cannot transmit. The nearest 128 eligible grids are included with an overflow notice. No antenna or internet relay is required. This local single-player feature does not change game ownership, names, or controls.

Grid altitude uses the **grid origin**, not lowest hull clearance; its orientation uses grid axes. Battery percentage is weighted by capacity; cargo covers cargo-container inventories only, not production queues/reactor fuel. Fleet grids do not run the cockpit terrain raycast fan. Ordinary map contacts remain visible separately; the tag gates detailed fleet telemetry and the dropdown, not general radar contacts.

Run the included installer script or use ShipOS Setup, add **ShipOSLocalTelemetry** to the save's Mods list, and reload the world. The running game must reload after every mod update. ShipOS itself reads the file directly; there is no separate port-8795 bridge.

For an iPad, use the ShipOS tray menu's pairing QR and a trusted local network. Do not forward the service to the internet.
