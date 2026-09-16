# Public beta candidate acceptance — 2026-09-16

## Verified here

- Production TypeScript/Vite build succeeds. The legacy view remains a large JavaScript bundle (~1.1 MB uncompressed); feature splitting is follow-up work.
- Twenty-six automated tests cover authentication/Host/Origin protections, single-use account-free Storytelling read/write pairing, PC-only administration, revocation, SQLite restart persistence, world isolation, revision conflicts, reset/restore snapshots, invalid packet/state rejection, optional local AI configuration, the guided installer/release-document contract, retained UI/data regressions, and tagged-fleet behavior.
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

## Needs live player validation

- The previous mod 2026.09.03.2 was observed live on foot at ground level in 1g with a stable world ID. Reload to activate fleet mod 2026.09.04.1. Tag an owned drone/base, verify movement/battery/cargo and ownership/tag changes, cockpit transition, world switching, respawn, and a long play session. Compile success is not proof of the in-game mod sandbox or physics behavior.
- Synthetic isolated browser checks confirmed Player first, separate drone readings (12 m/s, 120 m altitude, 73.5% battery), unavailable base systems labelled Not reported, and fallback to Player with a notice when the selected grid disappears. This is not yet a live multi-grid game test.
- Scan a newly generated pairing QR on the actual iPad. Verify Safari/WebGL, touch interaction, sleep/wake, reconnect, stale telemetry, portrait uploads, and editing/revocation across devices.
- Current Windows network profile/firewall may block LAN access. No firewall rule or network profile was changed. Allow only trusted Private-network access if required.
- Configure an installed offline local model if desired. No model was installed or downloaded; an actual generated reply has not been end-to-end tested.

## Before public donationware release

- Clean second-Windows-PC installation and upgrade/uninstall testing without development tools.
- Sign executable/script deliverables using an authorized signing identity. Current installer is unsigned.
- Audit rights/provenance of all inherited portraits, other art, names, and Space Engineers compatibility claims. Retained art has not been independently cleared in this pass.
- Manual accessibility and reduced-motion review, iPad Safari performance, malformed-input fuzzing, disk-full/locked-database tests, crash/restart soak, and installer rollback failure scenarios.
- Add CI build/release automation, versioned release notes and a user-approved donation link. Nothing has been published to a website or GitHub release.

## Safety and recovery

No original browser profile or Space Engineers save is deleted. Beta browser data is namespaced; shared story data is in local SQLite. Reset/import creates a snapshot before replacing the story. The newest 30 snapshots are retained; automatic retention removes only older snapshot files.

The installer leaves stories, logs, mod files, and previous app versions during uninstall. Local telemetry is bounded to 1,000 packets and 32 MB of packet text. Story files labelled Public/Shipboard/Sensitive are fictional classifications, not per-device access restrictions. LAN HTTP is unencrypted and must not be internet-exposed.
