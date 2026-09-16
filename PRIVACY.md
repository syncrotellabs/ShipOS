# Privacy

ShipOS 0.2.0-beta.4 is local-first software. It has no syncrotellabs account, advertising SDK, analytics service, subscription check, cloud relay, or automatic update service.

## Data stored locally

The gaming PC stores Storytelling records, device grants, settings, and bounded telemetry history in `%LOCALAPPDATA%\ShipOS\Data\shipos.sqlite`. Backups and recovery snapshots are stored alongside that database; diagnostic logs are stored in `%LOCALAPPDATA%\ShipOS\Logs`.

The Space Engineers world mod writes its latest telemetry packet under the current Windows user's Space Engineers data directory. ShipOS reads that local file. It does not modify the game save or send commands to the game.

## Local-network sharing

Sharing is off by default. If the player enables it, ShipOS serves the selected private network address over unencrypted HTTP. Paired devices can view telemetry and read/write the shared Storytelling workspace. Administrative settings remain restricted to the gaming PC. Pair only devices and people you trust, and revoke devices you no longer use.

## Optional AI

AI is disabled by default. If the player configures a compatible service at `127.0.0.1:11434`, ShipOS sends the requested story prompt and relevant local context to that service. The privacy behavior of the separately installed model service is controlled by that software, not ShipOS.

## No collection by syncrotellabs

ShipOS does not transmit gameplay, Storytelling records, device identifiers, crash reports, or usage analytics to syncrotellabs. If a player voluntarily emails a support report, they should review and redact it before sending. Pairing links, story backups, and diagnostic logs should not be posted publicly.
