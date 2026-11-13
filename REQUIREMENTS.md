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

Space Engineers is required only for live telemetry. Express setup copies `ShipOSLocalTelemetry` into the user's Mods folder and enables it in the most recently played complete local save. It validates and backs up `Sandbox_config.sbc` and `Sandbox.sbc` before changing them and never edits while Space Engineers is running. If the game was open during setup, exit and reopen it once. Storytelling can be used without the game.

## Tablets, phones, and another PC

The gaming PC must run ShipOS. Other devices need only a modern browser and the same trusted private LAN/Wi-Fi. Enable local sharing on the gaming PC, then open the single-use QR/link on the other device within two minutes.

ShipOS does not create a firewall rule. If Windows blocks LAN access, allow the bundled `node.exe` only on a trusted **Private** network. Never expose port 5174 to the internet, port-forward it, or use ShipOS on public Wi-Fi.

For access away from the home LAN, the optional hosted telemetry relay requires the deployed `shipos.echoboardhq.com` service, a WordPress administrator-issued relay key, and ordinary outbound HTTPS access from the gaming PC. No inbound firewall or router rule is needed. The other computer needs only a modern browser and an Echoboard WordPress login. This relay carries telemetry/GPS data only, not Ollama prompts or local Storytelling records.

## Optional private-network AI

Manual Storytelling does not require AI. The optional AI feature expects an already-installed Ollama service on the gaming PC or another computer on the same trusted private network. ShipOS accepts only `127.0.0.1` or an RFC1918 private IPv4 address and always uses port `11434`; public hosts and arbitrary URLs are rejected. The AI computer needs enough RAM or VRAM for the selected model. ShipOS does not install an AI application, download a model, or contact a cloud AI provider. See [Remote Ollama setup](docs/REMOTE_OLLAMA.md).

## Unsupported configurations

- macOS or Linux as the gaming/host PC.
- Dedicated servers or multiplayer authority.
- Directly exposing the local ShipOS helper or Ollama to the public internet.
- ARM Windows.
- Third-party or self-selected telemetry relay endpoints; the beta accepts only `shipos.echoboardhq.com`.
