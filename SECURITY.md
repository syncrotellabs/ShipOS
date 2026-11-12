# Security — local beta

Report suspected vulnerabilities privately to **syncrotellabs@gmail.com**. Include the version, reproduction steps, and a redacted diagnostic log. Do not post pairing codes, private story backups, or personal data in a public issue.

Only local single-player use is supported. Loopback is the default. Optional browser sharing and remote Ollama access use unencrypted HTTP, so use a trusted network only. Never port-forward, reverse-proxy, or expose ports `5174` or `11434` on the internet. ShipOS restricts its AI target to loopback or an RFC1918 private IPv4 address and a fixed Ollama port/path. The app deliberately has no cloud relay, login service, or game command channel.

Pairing is a local-network trust check, not an account login. Every paired device can read and write Storytelling records immediately; only the gaming PC can change sharing/AI settings, make administrative backups/resets/restores, inspect the device list, or revoke access. Pairing codes expire after two minutes and are single-use; device cookies expire after 30 days. The database stores hashes, not raw bearer tokens. Story writes require a revision match, and reset/restore retains a snapshot.

Local Windows administrators and other software running as your Windows user can read or modify local data. Story privacy labels organize RP files; they are not access-control boundaries among paired devices. Any paired device can read and edit the shared story, so pair only devices/people you trust and revoke devices you no longer use. Do not enter real secrets or medical information in roleplay records.

Express setup may enable the local telemetry mod in the most recently played local save, but only while Space Engineers is closed. It validates both XML documents, preserves the original `Sandbox_config.sbc` and `Sandbox.sbc` under the ShipOS data folder, excludes game-created Backup directories, and confines replacements to the detected Space Engineers Saves root. Advanced setup can leave saves unchanged.

The installer is currently unsigned. A signing identity, dependency review, clean-machine validation, and additional adversarial testing remain public-release requirements.
