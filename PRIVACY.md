# Privacy

ShipOS 0.2.0-beta.5 is local-first software. It has no advertising SDK, analytics service, subscription check, cloud AI, or automatic update service. The optional Echoboard telemetry relay is disabled until the player supplies a relay key and explicitly enables it.

## Data stored locally

The gaming PC stores Storytelling records, device grants, settings, and bounded telemetry history in `%LOCALAPPDATA%\ShipOS\Data\shipos.sqlite`. Backups and recovery snapshots are stored alongside that database; diagnostic logs are stored in `%LOCALAPPDATA%\ShipOS\Logs`.

The Space Engineers world mod writes its latest telemetry packet under the current Windows user's Space Engineers data directory. ShipOS reads that local file and sends no commands to the game. Express setup can enable the mod in the latest local save while the game is closed; it backs up both changed save files under `%LOCALAPPDATA%\ShipOS\Data\save-backups` first. Advanced setup can disable this behavior.

## Local-network sharing

Sharing is off by default. If the player enables it, ShipOS serves the selected private network address over unencrypted HTTP. Paired devices can view telemetry and read/write the shared Storytelling workspace. Administrative settings remain restricted to the gaming PC. Pair only devices and people you trust, and revoke devices you no longer use.

If Space Engineers runs on a second computer, the player can separately create a revocable gaming-PC bridge key. The collector on that computer sends live telemetry and addressed ShipOS chat text to the selected private ShipOS address and receives bounded chat replies. ShipOS stores the key's SHA-256 hash; the raw key is displayed once and remains visible to the user who runs the copied command. This LAN bridge does not send data to syncrotellabs.

## Optional AI

AI is disabled by default. If the player configures Ollama on this PC or another private-LAN computer, ShipOS sends the requested story prompt and relevant local context to that computer over unencrypted HTTP. If the player separately enables in-game ShipOS comms, addressed `/shipos` or `@ShipOS` chat text and a concise current-telemetry context are also sent to that Ollama computer; optional proactive requests use the same path and are off by default. ShipOS accepts only loopback or a private IPv4 address and never sends these prompts to syncrotellabs. Restrict the Ollama firewall rule to the trusted Private network—preferably to the gaming PC's source address—and never port-forward port `11434`. The privacy behavior of the separately installed Ollama service is controlled by that software, not ShipOS.

## Optional hosted telemetry

When explicitly enabled, the gaming PC sends live Space Engineers packets to `shipos.echoboardhq.com` over HTTPS. Packets can contain world and ship names, coordinates, velocity, orientation, systems status, nearby contacts, and saved GPS names/coordinates. They do not include WordPress passwords, Storytelling records, Ollama prompts, browser history, or game-control commands. The hosted service keeps at most 1,000 packets / 32 MB and exposes them to signed-in Echoboard WordPress members. A WordPress administrator can revoke an upload key; disabling locally erases the raw key from the local settings database.

Outside this opt-in relay, ShipOS does not transmit gameplay, Storytelling records, device identifiers, crash reports, or usage analytics to syncrotellabs. If a player voluntarily emails a support report, they should review and redact it before sending. Relay keys, pairing links, story backups, and diagnostic logs should not be posted publicly.
