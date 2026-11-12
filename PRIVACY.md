# Privacy

ShipOS 0.2.0-beta.5 is local-first software. It has no syncrotellabs account, advertising SDK, analytics service, subscription check, cloud relay, or automatic update service.

## Data stored locally

The gaming PC stores Storytelling records, device grants, settings, and bounded telemetry history in `%LOCALAPPDATA%\ShipOS\Data\shipos.sqlite`. Backups and recovery snapshots are stored alongside that database; diagnostic logs are stored in `%LOCALAPPDATA%\ShipOS\Logs`.

The Space Engineers world mod writes its latest telemetry packet under the current Windows user's Space Engineers data directory. ShipOS reads that local file and sends no commands to the game. Express setup can enable the mod in the latest local save while the game is closed; it backs up both changed save files under `%LOCALAPPDATA%\ShipOS\Data\save-backups` first. Advanced setup can disable this behavior.

## Local-network sharing

Sharing is off by default. If the player enables it, ShipOS serves the selected private network address over unencrypted HTTP. Paired devices can view telemetry and read/write the shared Storytelling workspace. Administrative settings remain restricted to the gaming PC. Pair only devices and people you trust, and revoke devices you no longer use.

## Optional AI

AI is disabled by default. If the player configures Ollama on this PC or another private-LAN computer, ShipOS sends the requested story prompt and relevant local context to that computer over unencrypted HTTP. ShipOS accepts only loopback or a private IPv4 address and never sends these prompts to syncrotellabs. Restrict the Ollama firewall rule to the trusted Private network—preferably to the gaming PC's source address—and never port-forward port `11434`. The privacy behavior of the separately installed Ollama service is controlled by that software, not ShipOS.

## No collection by syncrotellabs

ShipOS does not transmit gameplay, Storytelling records, device identifiers, crash reports, or usage analytics to syncrotellabs. If a player voluntarily emails a support report, they should review and redact it before sending. Pairing links, story backups, and diagnostic logs should not be posted publicly.
