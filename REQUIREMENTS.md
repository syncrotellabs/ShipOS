# ShipOS requirements

ShipOS is an offline, per-user Windows companion for a locally running single-player Space Engineers game. The installer does not download or silently install other applications.

## Required on the gaming PC

- Windows 10 or Windows 11, 64-bit.
- Microsoft .NET Framework 4.x. The setup wizard itself verifies that .NET is available.
- Windows PowerShell 5.1 at the standard Windows location.
- At least 250 MB free for the first installation. Allow additional space because each upgrade retains the prior application directory for rollback.
- A modern browser with WebGL enabled.
- Write access to the current Windows user's `%LOCALAPPDATA%` and `%APPDATA%` folders. Administrator access is not normally required.

Node.js 24, SQLite support, the web application, the tray helper, and the telemetry world mod are bundled. Do not install Node.js, npm, pnpm, SQLite, IIS, or a Space Engineers plugin loader for ShipOS.

Official help:

- [.NET Framework downloads](https://dotnet.microsoft.com/download/dotnet-framework)
- [Windows PowerShell 5.1 information](https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_windows_powershell_5.1)
- [Windows Firewall safety guidance](https://support.microsoft.com/windows/security/firewall/risks-of-allowing-apps-through-windows-firewall)

## Space Engineers telemetry

Space Engineers is required only for live telemetry. Setup can copy `ShipOSLocalTelemetry` into the user's game Mods folder, but it does not alter a save. Enable the mod in that save's Mods list and fully reload the world. Storytelling can be used without the game.

## Tablets, phones, and another PC

The gaming PC must run ShipOS. Other devices need only a modern browser and the same trusted private LAN/Wi-Fi. Enable local sharing on the gaming PC, then open the single-use QR/link on the other device within two minutes.

ShipOS does not create a firewall rule. If Windows blocks LAN access, allow the bundled `node.exe` only on a trusted **Private** network. Never expose port 5174 to the internet, port-forward it, or use ShipOS on public Wi-Fi.

## Optional local AI

Manual Storytelling does not require AI. The optional AI feature expects an already-installed OpenAI-compatible local model service at `http://127.0.0.1:11434/v1/chat/completions`. ShipOS does not install an AI application, download a model, or contact a cloud AI provider.

## Unsupported configurations

- macOS or Linux as the gaming/host PC.
- Dedicated servers or multiplayer authority.
- Public-internet hosting or reverse proxies.
- ARM Windows.
- Remote cloud databases or relay services.
