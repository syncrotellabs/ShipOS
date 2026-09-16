# ShipOS beta support

Support contact: **syncrotellabs@gmail.com**

Include the ShipOS version, Windows version, what you expected, what happened, and the exact time of the problem. Do not send a pairing link, private Storytelling backup, or unreviewed diagnostic log.

## ShipOS will not start

Run setup again and review the Readiness check. Use **Copy check details** when asking for help. ShipOS requires 64-bit Windows 10/11, .NET Framework 4.x, Windows PowerShell 5.1, and at least 250 MB free. The package is currently unsigned; download it only from the official syncrotellabs location and compare its SHA-256 checksum before running it.

## The tray helmet is missing

Open **Start > ShipOS > ShipOS**. If it still does not appear, inspect `%LOCALAPPDATA%\ShipOS\Logs\service-error.log`, then run setup again to repair the application files. Closing the browser does not close the tray helper; **Exit ShipOS** on the tray menu does.

## Telemetry says waiting or stale

Confirm that `ShipOSLocalTelemetry` is enabled in the active save's Mods list. Save and fully reload the world after installing or updating the mod. Control a character or cockpit and wait several seconds. ShipOS watches `%APPDATA%\SpaceEngineers\Storage\ShipOSLocalTelemetry.latest.json`.

## A tablet or another PC cannot connect

Both devices must be on the same trusted private LAN/Wi-Fi. Regenerate the pairing link if it is older than two minutes or was already used. Check Wi-Fi client isolation and Windows Firewall. If a firewall exception is needed, allow ShipOS's bundled `node.exe` on **Private** networks only. Do not open or forward port 5174 on a router.

## Storytelling changes conflict

ShipOS stops the edit instead of silently overwriting a newer revision. Download the recovery draft, reload the saved story, and reapply the intended change. Use Configuration on the gaming PC to create or restore a backup.

## Uninstall

Use **Start > ShipOS > Uninstall ShipOS** or Windows Installed apps. Uninstall removes the active app, helper, and shortcuts. It intentionally retains stories, backups, logs, the telemetry mod, and rollback copies.
