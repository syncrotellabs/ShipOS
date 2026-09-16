# ShipOS · local single-player beta

A free, MIT-licensed companion for Space Engineers. **Telemetry** provides a live planetary map and concise readings; **Storytelling** keeps optional AI, campaigns, crew, contracts, finances, chronicle, communications, portraits, and ship records in a separate RP workspace.

No subscription, account, internet relay, cloud AI, or game-control channel. Storytelling is experimental fiction, not observed game state.

## Windows installation

Run `ShipOS-0.2.0-beta.4-Setup.exe`. Its guided welcome, readiness, components, review, and finish pages verify the PC, install the application, private Node 24 runtime, helper/tray launcher, Start-menu shortcuts, uninstaller, and optionally the local telemetry world mod. No administrator access is needed. Windows 10/11 x64 is the beta target. Setup is offline: it never downloads prerequisites or silently changes Windows Firewall. This build is **unsigned**; signing and a clean second-PC test remain release gates. See [REQUIREMENTS.md](REQUIREMENTS.md) before distributing it.

Enable **ShipOSLocalTelemetry** in your Space Engineers save's Mods list, then reload the world. The installer does not alter saves or enable mods automatically. Updates to a running mod also require a world reload.

Launch the ShipOS shortcut. Its helmet tray menu provides telemetry, storytelling, iPad pairing, data/backups, logs, restart/stop, and opt-in Windows startup. Closing the browser leaves the helper running; Exit ShipOS stops it. The portable ZIP can be extracted and launched using `runtime/helper.ps1` with Windows PowerShell.

- Application: `%LOCALAPPDATA%\Programs\ShipOS`
- Database: `%LOCALAPPDATA%\ShipOS\Data\shipos.sqlite`
- Backups: `%LOCALAPPDATA%\ShipOS\Data\backups`
- Logs: `%LOCALAPPDATA%\ShipOS\Logs`

Upgrades preserve data and retain the previous application directory for rollback. Uninstall removes the active application and shortcuts, not stories, backups, logs, the game mod, or retained previous versions. Remove those separately only if you no longer need them.

## iPad pairing

On the PC, choose **Show iPad QR code…** from the tray menu. Enable local sharing on the intended private IPv4 address, then generate a QR or copy its pairing link. An iPad/Android device can scan the code; another PC can open the copied link. The device must be on the same trusted network and open it within two minutes. Codes/links are single-use; paired devices expire after 30 days and can be revoked.

There is no account, username, password, or subscription. Pairing is only a local-network trust check. Every paired play screen can immediately read and write all Storytelling records; changes synchronize through the gaming PC’s local database. Sharing, backups, revocation, and AI configuration remain PC-only.

The service listens on loopback by default. Optional sharing binds only the selected private adapter, not all interfaces. HTTP is **not encrypted**: use a trusted home network, do not port-forward, and do not expose it through a reverse proxy. No firewall rules are installed automatically. If needed, allow the bundled runtime on Windows **Private** networks only. A changed DHCP address may require choosing a new address and pairing again.

## Map focus and tagged grids

The always-visible **Focus** dropdown lists Player first, then loaded friendly grids with `[ShipOS]` in their grid name. Use e.g. `[ShipOS] Mining Drone` in the game's grid Info tab, not a block/group name. Selection centers the map and displays that grid's readings; **Refocus** recenters after panning. Labels are enlarged with a minimum screen size for readability.

Mod 2026.09.04.1 discovers grids every ten simulation seconds and samples every two. Actual owner/faction relations gate eligibility; neutral/hostile/unowned grids cannot join by adding a tag or editing map IFF. Each separate subgrid needs its own tag. Only loaded grids report, with a nearest-128 beta limit. A lost selection falls back to Player. Detailed grid readings are separate from player telemetry; story/AI context and relative-velocity tables remain player-based. See the bundled mod README for measurement definitions.

## Local data and AI

The service watches `%APPDATA%\SpaceEngineers\Storage\ShipOSLocalTelemetry.latest.json`. SQLite retains up to 1,000 packets and at most 32 MB of packet text. The mod writes a persistent ID into world storage. A copied game save retains that ID; independently developed copies need a new ID. Old mods without a world ID use an explicit unassigned profile.

Shared story edits use optimistic revisions: conflicts stop editing and preserve a recoverable browser draft instead of silently overwriting another console. Reset/restore makes a snapshot first. The newest 30 snapshots are kept. Original pre-beta browser records are not modified or automatically imported.

AI is optional. Configure an already-installed model at the fixed local OpenAI-compatible endpoint `http://127.0.0.1:11434/v1/chat/completions`. ShipOS does not install a model, download one, or contact a remote provider. Prompts send context to that local service only when requested. Ensure the model service itself is configured for offline use. Generated replies are suggestions; the player decides canon.

## Development and packaging

```powershell
pnpm install --frozen-lockfile
pnpm schema
pnpm test
pnpm build
pnpm start
```

Open `http://127.0.0.1:5174/`. The standalone service serves `dist/` and the local API. Optional `pnpm dev` is a loopback-only developer interface on port 5173; do not use it for tablet access.

```powershell
powershell -NoProfile -File scripts/build-installer.ps1 -NodePath C:\trusted\node.exe -OutputDirectory C:\releases\ShipOS-beta
```

The offline installer is built from `installer/Setup.cs` using the Windows .NET Framework compiler. The script produces a setup EXE, portable ZIP, and SHA-256 checksums, refusing to overwrite an existing release ZIP. `runtime/licenses` holds bundled dependency notices. No Space Engineers binaries are redistributed.

See `docs/BETA_ACCEPTANCE.md` for verification and remaining release work. Optional legacy plugin/PB and old server sources are preserved under `integrations/` for reference, not shipped or connected by this beta.

## Provenance and license

Extracted from `syncrotellabs/EchoboardGaming`, commit `bb02270331817200c7b7de6dbaf1a7c64894e83d`. Original features and art remain subject to the asset-provenance release review.

[MIT License](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md). ShipOS is unofficial and is not endorsed by Keen Software House. Donationware publication is planned for syncrotellabs.com; there are no paid feature gates.
