# Public beta candidate acceptance — 2026-11-13

## Verified here

- Production TypeScript/Vite build succeeds. The legacy view remains a large JavaScript bundle (~1.1 MB uncompressed); feature splitting is follow-up work.
- Automated tests cover authentication/Host/Origin protections, single-use account-free Storytelling read/write pairing, PC-only administration, revocation, SQLite restart persistence, world isolation, revision conflicts, reset/restore snapshots, invalid packet/state rejection, private-LAN AI target restrictions, hosted WordPress viewer/admin authorization, one-time telemetry relay key issuance/revocation, authenticated outbound relay uploads, the express/advanced installer and release-document contract, automatic backed-up save configuration, retained UI/data regressions, and tagged-fleet behavior.
- Browser checks: first-visit beta modal, live file telemetry, initially closed configuration drawer, both main pages, zero-state Star System prompt, mission creation, and that mission loading in a second console.
- A clean profile remains at revision zero while telemetry updates. Sensor ticks no longer pollute the shared story log.
- Updated local mod compiles against this PC's Space Engineers assemblies using the .NET Framework compiler. One existing obsolete-enum compatibility warning remains; no compilation errors.
- Offline installer compiled. Isolated current-PC install, update, and uninstall completed with exit code zero. Bundled Node reports v24.19.0. Update retained a rollback directory; uninstall removed the active test application.
- Corrected a Windows PowerShell first-run startup-registry lookup failure. Installed tray helper launches successfully; stopping it stops its child server, and relaunch restores the service. The old desktop-helper shortcut now points to the standalone launcher, with the previous shortcut backed up.
- An isolated browser paired through the LAN listener with no login, showed `Paired play screen`, created `Cross-device beta mission` at revision 1, and the separate gaming-PC browser received the same mission and goal. The paired browser remained unable to access PC administration. This validates the browser flow, not actual iPad/Android/second-PC hardware.
- Beta.4 adds concrete x64 Windows, .NET, PowerShell, game-folder and disk-space readiness results; copyable diagnostics; official prerequisite/firewall help; and no-download language in the wizard.
- The website bundle now carries requirements, privacy, security, support, release notes, website copy, SHA-256 checksums and a machine-readable release manifest.
- Packaged beta.4 fresh install, upgrade, retained rollback, installed-document presence, compact uninstaller, and uninstall passed in an isolated current-PC directory. The preflight first caught and then regression-tested a Windows backslash ZIP-directory entry before the candidate was rebuilt.
- This PC was upgraded from beta.3 to beta.4; the helper restarted, the local API reported beta.4, story revision zero remained intact, and the service error log stayed empty.
- Beta.5 Express setup reduces the normal path to one **Install ShipOS** action. It installs the mod, shortcuts, startup entry and helper, opens the app, and enables telemetry in the latest complete local save while retaining both original XML files. Advanced setup remains available.
- A synthetic Space Engineers world verified that automatic configuration updates `Sandbox_config.sbc` and `Sandbox.sbc`, creates one recoverable backup, validates the result, and remains idempotent on a second run. Backup subdirectories are excluded and path containment is enforced.
- Packaged beta.5 express install, upgrade, rollback retention, configurator presence and uninstall passed in an isolated directory. This PC then upgraded to beta.5 through the express path; the runtime reported beta.5, the latest save was already correctly configured, story revision zero was preserved, and service/save-configuration error logs remained empty.
- Mod 2026.11.12.1 compiles against the installed Space Engineers assemblies and exports the player's saved GPS list. The map pins GPS fixes and projects a forward course from live craft attitude while keeping a selected destination as a separate route.
- The optional Echoboard relay is outbound-only and fixed to the HTTPS ShipOS host. Automated integration tests verify that keys are shown on creation but not listing, viewers can read telemetry, viewers cannot issue keys, revocation rejects future uploads, local status never exposes the raw key, and disabling erases it locally.

## Needs live player validation

- The previous mod 2026.09.03.2 was observed live on foot at ground level in 1g with a stable world ID. Reload to activate mod 2026.11.12.1. Verify live GPS export, attitude-course changes, an owned tagged drone/base, movement/battery/cargo and ownership/tag changes, cockpit transition, world switching, respawn, and a long play session. Compile success is not proof of the in-game mod sandbox or physics behavior.
- Synthetic isolated browser checks confirmed Player first, separate drone readings (12 m/s, 120 m altitude, 73.5% battery), unavailable base systems labelled Not reported, and fallback to Player with a notice when the selected grid disappears. This is not yet a live multi-grid game test.
- Scan a newly generated pairing QR on the actual iPad. Verify Safari/WebGL, touch interaction, sleep/wake, reconnect, stale telemetry, portrait uploads, and editing/revocation across devices.
- Current Windows network profile/firewall may block LAN access. No firewall rule or network profile was changed. Allow only trusted Private-network access if required.
- Configure an installed offline Ollama model locally or on a trusted-LAN computer if desired. No model was installed or downloaded; an actual generated reply and the remote-computer path have not been end-to-end tested.
- Deploy the current hosted build to `shipos.echoboardhq.com`, issue a real relay key, and validate sustained HTTPS telemetry from the gaming PC plus WordPress viewing from a physically separate computer. Automated localhost integration is not a production TLS/deployment test.

## Before public donationware release

- Clean second-Windows-PC installation and upgrade/uninstall testing without development tools.
- Sign executable/script deliverables using an authorized signing identity. Current installer is unsigned.
- Audit rights/provenance of all inherited portraits, other art, names, and Space Engineers compatibility claims. Retained art has not been independently cleared in this pass.
- Manual accessibility and reduced-motion review, iPad Safari performance, malformed-input fuzzing, disk-full/locked-database tests, crash/restart soak, and installer rollback failure scenarios.
- Add CI build/release automation, versioned release notes and a user-approved donation link. Nothing has been published to a website or GitHub release.

## Safety and recovery

No original browser profile or Space Engineers save is deleted. Beta browser data is namespaced; shared story data is in local SQLite. Reset/import creates a snapshot before replacing the story. The newest 30 snapshots are retained; automatic retention removes only older snapshot files.

The installer leaves stories, logs, mod files, and previous app versions during uninstall. Local and hosted telemetry stores are each bounded to 1,000 packets and 32 MB of packet text. Story files labelled Public/Shipboard/Sensitive are fictional classifications, not per-device access restrictions. LAN HTTP is unencrypted and must not be internet-exposed; the hosted relay uses the fixed HTTPS endpoint and an upload-only key.
