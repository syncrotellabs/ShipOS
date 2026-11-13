# Remote Space Engineers game bridge

This first bridge pass supports a split setup on one trusted private network:

- **ShipOS computer:** the ShipOS app, SQLite data, and optionally Ollama.
- **Gaming computer:** Space Engineers, the bundled world mod, and the small Node.js collector.

Telemetry and addressed in-game chat travel from the gaming computer to ShipOS. Bounded ShipOS/Ollama replies travel back to the mod and appear under the `ShipOS` chat name. The bridge has no story, settings, block, inventory, steering, save-editing, or hosted-relay authority.

## 1. Prepare ShipOS

On the ShipOS computer, open Configuration:

1. Configure Ollama with `127.0.0.1` when it runs on the ShipOS computer, or the Ollama computer's private IPv4 address.
2. Under **Remote gaming-PC bridge**, follow the numbered checklist, enter a label, and choose **Enable LAN & create connection command**. This enables the selected private IPv4 address automatically; the tablet QR is not used for the game bridge.
3. Copy the generated PowerShell command immediately.
   Its high-entropy key is displayed once; ShipOS stores only its SHA-256 hash.
4. Enable **In-game ShipOS comms**. Proactive updates remain off unless a 10, 20, or 30 minute cadence is selected.

ShipOS does not add firewall rules. If the gaming computer cannot connect, allow inbound TCP `5174` to the ShipOS Node runtime on the Windows **Private** profile only. Never forward this port on the router or expose it through a public reverse proxy.

## 2. Prepare the gaming computer

Install Git and Node.js 24, then open PowerShell:

```powershell
git clone https://github.com/syncrotellabs/ShipOS.git
cd ShipOS
& .\public\shipos\addons\shipos-local-telemetry-mod\install-shipos-local-telemetry-mod.cmd
```

Add **ShipOSLocalTelemetry** to the intended local save's Mods list while Space Engineers is closed, then reload the world. The app's packaged installer can automate save configuration when game and app are on the same Windows computer; the split-computer workflow intentionally leaves that choice on the gaming computer.

Run the command copied from ShipOS. It has this shape:

```powershell
node .\runtime\game-bridge.mjs --url "http://192.168.1.20:5174/api/bridge/exchange" --token "shipos_bridge_…"
```

The collector uses only Node's built-in modules, so `pnpm install` is not required. Keep the PowerShell window running while playing. It watches `%APPDATA%\SpaceEngineers\Storage`, sends a packet only when telemetry changes, polls for replies about once per second, and never prints the bridge key.

Once telemetry reports connected, type `/shipos status` or `@ShipOS give me a status report` in game.

## Revoke or replace a gaming computer

Use **Revoke** beside the gaming computer in ShipOS Configuration. A revoked collector receives `401` and can no longer exchange telemetry or chat. Create a new bridge entry to rotate the key. The raw key is not recoverable from ShipOS.

The link is authenticated but uses unencrypted HTTP on the LAN. Anyone who obtains the raw key and can reach the selected private address can submit telemetry and addressed chat as that gaming computer until the key is revoked. Treat it like a password and do not commit, post, or email it.

## Troubleshooting

- **Waiting for gaming PC:** confirm local sharing is still enabled on the same address, the collector window is running, both computers can reach each other, and TCP `5174` is permitted only on the trusted Private network.
- **Telemetry is stale:** control a character or cockpit and confirm `%APPDATA%\SpaceEngineers\Storage\ShipOSLocalTelemetry.latest.json` updates on the gaming computer.
- **No chat reply:** confirm mod `2026.11.13.1` or newer is loaded, ShipOS comms and Ollama are enabled, and the collector remains connected. The current game session and world must match the latest telemetry packet.
- **`401 Invalid or revoked game-bridge key`:** create a replacement bridge entry and restart the collector with the new command.
