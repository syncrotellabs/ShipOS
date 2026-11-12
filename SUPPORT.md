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

## Uninstall

Use **Start > ShipOS > Uninstall ShipOS** or Windows Installed apps. Uninstall removes the active app, helper, and shortcuts. It intentionally retains stories, backups, logs, the telemetry mod, and rollback copies.
