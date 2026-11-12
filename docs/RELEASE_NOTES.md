# ShipOS 0.2.0-beta.5 release notes

Release date: 2026-09-16

## Highlights

- New one-click Express setup installs every required component, starts ShipOS with Windows, opens the app, and keeps Advanced options available without putting configuration work on ordinary users.
- Express setup enables `ShipOSLocalTelemetry` in the most recently played complete local save. Both save XML files are validated and backed up before replacement, and a running game is never modified.
- The tray helper notices when Space Engineers closes and safely prepares the newest local save for its next session, covering saves created after installation.
- Account-free read/write Storytelling from a paired iPad, Android browser, or another PC on the same trusted LAN.
- Telemetry focus list for the player and tagged friendly grids, with larger map labels and a Refocus control.
- Environment-aware planetary rendering with credited low-resolution NASA imagery for Earthlike, Moon, Mars, icy and Venus-like bodies; unmatched fictional worlds retain procedural textures.
- The Rajdhani display family used by syncrotellabs.com is bundled locally for the ShipOS interface.
- Optional Ollama can run on the gaming PC or a separate trusted-LAN computer; AI targets are restricted to loopback or private IPv4 addresses on port 11434.
- Advanced offline setup retains the concrete Windows, PowerShell, .NET, game-folder, and disk-space readiness report.
- Copyable setup diagnostics and official Microsoft help links. Setup still performs no automatic downloads or firewall changes.
- Start-menu launch and uninstall entries, compact installed uninstaller, rollback-preserving upgrades, and retained local data.
- Installer extraction now accepts Windows ZIP directory entries using either slash style; this was caught by the packaged-binary preflight before publication.
- Public-facing requirements, privacy, support, security, third-party notice, checksums, and website-copy documents.

## Known beta limitations

- The Windows executables are not code-signed.
- A clean second-PC installation and physical iPad/Android validation remain release checks.
- LAN traffic uses unencrypted HTTP and must stay on a trusted private network.
- Optional AI requires a separately installed Ollama service and has not been certified with a specific model package. Remote-LAN prompts are unencrypted and must not leave a trusted private network.
- Live multi-grid fleet telemetry still needs extended in-game validation.
- Inherited visual assets require a final provenance review before broad promotion.
