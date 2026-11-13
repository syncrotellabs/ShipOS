# ShipOS · local single-player beta

A free, MIT-licensed companion for Space Engineers. **Telemetry** provides a live planetary map and concise readings; **Storytelling** keeps optional AI, campaigns, crew, contracts, finances, chronicle, communications, portraits, and ship records in a separate RP workspace.

No subscription, paid tier, cloud AI, or ship-control channel. ShipOS is local-first; an optional, explicitly enabled local comms bridge can exchange addressed chat with the bundled game mod, while an optional HTTPS telemetry relay lets the player view the gaming PC from the WordPress-authenticated hosted site. Storytelling is experimental fiction, not observed game state.

The optional hosted build uses Echoboard HQ WordPress as its identity provider: members are read-only and WordPress administrators can edit hosted records and issue revocable telemetry-upload keys. It never receives WordPress passwords. Relay keys can upload telemetry only; they cannot read records or control the game. See [Hosted ShipOS deployment](docs/HOSTED_DEPLOYMENT.md).

## Windows installation

Run `ShipOS-0.2.0-beta.5-Setup.exe` and choose **Install ShipOS**. Express setup verifies the PC, installs the application, private Node 24 runtime, helper/tray launcher, shortcuts, uninstaller, and telemetry mod; backs up and enables the mod in the most recently played local save; starts the helper with Windows; and opens ShipOS. Advanced options remain available. No administrator access is normally needed. Windows 10/11 x64 is the beta target. Setup is offline: it never downloads prerequisites or silently changes Windows Firewall. This build is **unsigned**; signing and a clean second-PC test remain release gates. See [REQUIREMENTS.md](REQUIREMENTS.md) before distributing it.

No Mods-menu work is required for the most recently played local save. Express setup validates both save XML files, retains their originals under `%LOCALAPPDATA%\ShipOS\Data\save-backups`, and enables **ShipOSLocalTelemetry** only while the game is closed. If Space Engineers is running, exit and reopen it once; the helper finishes configuration after the game closes. Future local saves are prepared after their first session closes, ready for the next launch.

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

Mod 2026.11.13.2 discovers grids every ten simulation seconds and samples every two. It also publishes the player's saved in-game GPS list as pinned, clickable map contacts. Actual owner/faction relations gate fleet eligibility; neutral/hostile/unowned grids cannot join by adding a tag or editing map IFF. Each separate subgrid needs its own tag. Only loaded grids report, with a nearest-128 beta limit. A lost selection falls back to Player. Detailed grid readings are separate from player telemetry; story/AI context and relative-velocity tables remain player-based. See the bundled mod README for measurement definitions.

Owned or faction-friendly LCD text panels with `[SHIPOS]` in their panel name can read a command from Custom Data. Set the first line to `location` to display that panel's grid-origin XYZ coordinates, rounded to two decimal places and refreshed every two seconds. No programmable block is required.

## Local data and AI

The service watches `%APPDATA%\SpaceEngineers\Storage\ShipOSLocalTelemetry.latest.json`. SQLite retains up to 1,000 packets and at most 32 MB of packet text. The mod writes a persistent ID into world storage. A copied game save retains that ID; independently developed copies need a new ID. Old mods without a world ID use an explicit unassigned profile.

Shared story edits use optimistic revisions: conflicts stop editing and preserve a recoverable browser draft instead of silently overwriting another console. Reset/restore makes a snapshot first. The newest 30 snapshots are kept. Original pre-beta browser records are not modified or automatically imported.

AI is optional. Ollama may run on the gaming PC or another computer on the same trusted private LAN. ShipOS accepts only `127.0.0.1` or a private IPv4 address and uses the fixed endpoint `http://<AI-PC>:11434/v1/chat/completions`; public hosts and arbitrary URLs are rejected. ShipOS does not install Ollama, download a model, or contact a cloud AI provider. Prompts send context to the configured Ollama computer only when requested or when the player explicitly enables scheduled in-game telemetry updates. Generated replies are suggestions; the player decides canon. See [Remote Ollama setup](docs/REMOTE_OLLAMA.md) to leave only ShipOS and Space Engineers on the gaming PC.

## In-game ShipOS comms

The bundled mod and local helper can exchange text through two bounded files in Space Engineers global storage. Enable **In-game ShipOS comms** in Configuration after selecting an Ollama model, reload the world with mod `2026.11.13.2` or newer, then type `/shipos status`, `/shipos <message>`, or `@ShipOS <message>` in game. Addressed commands are kept out of normal player chat. ShipOS supplies a small current-telemetry summary to Ollama and returns a plain-text reply under the `ShipOS` chat name.

Proactive telemetry remarks are off by default and can be limited to at most once every 10, 20, or 30 minutes. The model may return `SILENT` when nothing merits an interruption. This local channel writes chat text only: it cannot steer, trigger blocks, move inventory, edit saves, or accept commands through the hosted relay.

Space Engineers may run on a second Windows computer. Enable local sharing on the ShipOS computer, create a revocable key under **Remote gaming-PC bridge**, and run `runtime/game-bridge.mjs` from a clone on the gaming computer. The authenticated collector carries telemetry and chat replies across the private LAN; it uses no npm dependencies and does not expose Ollama or the game. See [Remote Space Engineers game bridge](docs/REMOTE_GAME_BRIDGE.md).

## Optional hosted telemetry relay

A WordPress administrator at `shipos.echoboardhq.com` can create a one-time-visible relay key. Paste that key into the local Configuration drawer to opt in. The gaming PC then makes outbound HTTPS uploads containing live telemetry, nearby contacts, and saved GPS coordinates; no inbound home-network port or router change is required. The hosted site stores a bounded 1,000-packet / 32 MB history and makes it visible to authenticated WordPress members. Disable the relay locally to erase its local key, and revoke the key on the hosted administrator page to stop future uploads. Story records and Ollama prompts are not included in telemetry uploads.

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
