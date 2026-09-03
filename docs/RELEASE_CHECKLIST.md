# Release checklist

## Legal and project identity

- [x] Select and add the MIT source-code license.
- [ ] Perform a trademark search and clear the final product name.
- [ ] Confirm ownership and release rights for every portrait, icon, sound, font, lore entry, and other asset.
- [ ] Review the current Space Engineers EULA, modding rules, and plugin policy.
- [ ] Credit Keen Software House and describe compatibility without implying endorsement.

## Product

- [ ] Extract the planetary map into a feature module.
- [ ] Remove campaign-console features from the default build.
- [ ] Replace DSV Intrepid and Carthage defaults with neutral first-run data.
- [ ] Make local profiles, preferences, import, and export work without an account.
- [ ] Add a useful empty state and first-run setup.
- [ ] Meet keyboard, contrast, reduced-motion, and screen-size accessibility requirements.

## Integrations and packaging

- [ ] Publish source for the game-facing mod and plugin.
- [ ] Document every telemetry field read from the game.
- [ ] Rebuild helper, mod, and plugin packages from reviewed source in CI.
- [ ] Remove hard-coded EchoBoard production URLs.
- [ ] Code-sign Windows deliverables and publish checksums.
- [ ] Provide a clean uninstaller and data-removal instructions.

## Privacy and security

- [ ] Keep remote telemetry disabled by default.
- [ ] Bind the local relay to loopback unless the user explicitly enables LAN access.
- [ ] Explain local files, retention, and network connections.
- [ ] Add a security policy and vulnerability-reporting address.
- [ ] Test malformed, oversized, duplicated, and hostile telemetry packets.

## Primary references reviewed 2026-09-02

- Space Engineers EULA: https://store.steampowered.com/eula/244850_eula_1
- Space Engineers plugin policy: https://www.spaceengineersgame.com/plugins/
- WIPO Global Brand Database: https://www.wipo.int/en/web/global-brand-database
