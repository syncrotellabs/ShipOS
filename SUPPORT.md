# ShipOS beta support

Support contact: **syncrotellabs@gmail.com**

Include the ShipOS version, Windows version, what you expected, what happened, and the exact time of the problem. Do not send a pairing link, private Storytelling backup, or unreviewed diagnostic log.

## ShipOS will not start

Run setup again and review the Readiness check. Use **Copy check details** when asking for help. ShipOS requires 64-bit Windows 10/11, .NET Framework 4.x, Windows PowerShell 5.1, and at least 250 MB free. The package is currently unsigned; download it only from the official syncrotellabs location and compare its SHA-256 checksum before running it.

## The tray helmet is missing

Open **Start > ShipOS > ShipOS**. If it still does not appear, inspect `%LOCALAPPDATA%\ShipOS\Logs\service-error.log`, then run setup again to repair the application files. Closing the browser does not close the tray helper; **Exit ShipOS** on the tray menu does.

## Telemetry says waiting or stale

Exit Space Engineers, start ShipOS once, then reopen the most recently played local save. Express setup and the helper enable `ShipOSLocalTelemetry` automatically while the game is closed. The configuration result is recorded in `%LOCALAPPDATA%\ShipOS\Data\save-configuration.json`; originals are retained under `save-backups`. Control a character or cockpit and wait several seconds. ShipOS watches `%APPDATA%\SpaceEngineers\Storage\ShipOSLocalTelemetry.latest.json`.

## A tablet or another PC cannot connect

Both devices must be on the same trusted private LAN/Wi-Fi. Regenerate the pairing link if it is older than two minutes or was already used. Check Wi-Fi client isolation and Windows Firewall. If a firewall exception is needed, allow ShipOS's bundled `node.exe` on **Private** networks only. Do not open or forward port 5174 on a router.

## Storytelling changes conflict

ShipOS stops the edit instead of silently overwriting a newer revision. Download the recovery draft, reload the saved story, and reapply the intended change. Use Configuration on the gaming PC to create or restore a backup.

## ShipOS cannot reach Ollama on another computer

On the AI computer, confirm Ollama is running with `OLLAMA_HOST=0.0.0.0:11434`, the requested model is installed, and the operating-system firewall allows TCP `11434` only from the trusted Private network or gaming PC. From the gaming PC, run `Invoke-RestMethod http://AI-COMPUTER-IP:11434/api/tags` in PowerShell. Use that numeric private IPv4 address and the exact installed model name in ShipOS Configuration. Do not use a public IP, hostname, port-forward, or public Wi-Fi. See [Remote Ollama setup](docs/REMOTE_OLLAMA.md).

## `/shipos` does not answer in game

Confirm that the save loaded mod `2026.11.13.1` or newer, Ollama is enabled in Configuration, and **In-game ShipOS comms** is enabled. Exit and reload the world after updating the mod. Control a character or cockpit until ShipOS shows live telemetry, then try `/shipos status`. The request and reply files are `%APPDATA%\SpaceEngineers\Storage\ShipOSLocalTelemetry.chat-request.txt` and `ShipOSLocalTelemetry.chat-reply.txt`. The Configuration status reports the last bridge error without exposing chat text.

When the game is on a second computer, also confirm that **Remote gaming-PC bridge** says connected and its collector window is still running. A `401` means that key was revoked or copied incorrectly; create a new bridge entry. A connection failure usually means the ShipOS address changed, local sharing was turned off, client isolation is enabled, or TCP `5174` is blocked. See [Remote Space Engineers game bridge](docs/REMOTE_GAME_BRIDGE.md).

## Uninstall

Use **Start > ShipOS > Uninstall ShipOS** or Windows Installed apps. Uninstall removes the active app, helper, and shortcuts. It intentionally retains stories, backups, logs, the telemetry mod, and rollback copies.
