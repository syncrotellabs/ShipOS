# Remote Ollama for ShipOS

ShipOS can use Ollama on another computer on the same trusted private network. After this is configured and tested, the gaming PC needs only ShipOS and Space Engineers; Ollama and its models can be removed or disabled there.

This is a private-LAN feature, not an internet relay. ShipOS accepts only `127.0.0.1` or an RFC1918 private IPv4 address (`10.x.x.x`, `172.16.x.x` through `172.31.x.x`, or `192.168.x.x`) and always uses Ollama's port `11434` and OpenAI-compatible chat path. Hostnames, public IP addresses, custom ports and arbitrary URLs are rejected.

## 1. Prepare the AI computer

Give the AI computer a stable private IPv4 address, preferably with a DHCP reservation in the router. Install Ollama there, then pull the model that ShipOS should use. Record the exact model name reported by Ollama.

Configure Ollama to listen on the LAN:

- **Windows:** quit Ollama from the taskbar, open **Edit environment variables for your account**, create `OLLAMA_HOST` with value `0.0.0.0:11434`, then start Ollama again from the Start menu.
- **Linux with systemd:** run `systemctl edit ollama.service`, add the lines below under `[Service]`, then run `systemctl daemon-reload` and `systemctl restart ollama`.

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

For an explicitly offline Ollama installation, also set `OLLAMA_NO_CLOUD=1` using the same environment-variable mechanism.

## 2. Restrict the firewall

Allow inbound TCP `11434` on the AI computer only for its trusted **Private** network. If the firewall supports source restrictions, permit only the gaming PC's private IPv4 address. Do not create a Public-network rule. Never port-forward `11434`, expose it through a reverse proxy, or use this arrangement on public Wi-Fi.

Ollama's API uses unencrypted HTTP on the LAN. Story prompts and selected ShipOS context are readable by someone able to intercept traffic on that network. The browser and paired devices do not call Ollama directly; the ShipOS service on the gaming PC makes the request.

## 3. Test from the gaming PC

Replace `192.168.1.50` with the AI computer's address:

```powershell
Invoke-RestMethod http://192.168.1.50:11434/api/tags
```

The command should return the installed model list. If it fails, check the AI computer's address, Ollama process, `OLLAMA_HOST` setting, firewall and whether both computers are on the same private network.

## 4. Point ShipOS at the AI computer

On the gaming PC, open **ShipOS > Configuration > Optional private-network AI**. Enter the AI computer's numeric private IPv4 address and the exact Ollama model name, then choose **Enable AI computer**. Open Storytelling and request a brief to verify an actual generated response.

ShipOS does not discover machines or models automatically, install Ollama, download models, or change either computer's firewall.

## 5. Stop Ollama on the gaming PC

Only after the remote response succeeds, quit Ollama on the gaming PC. To keep it from returning after sign-in on Windows, open **Task Manager > Startup apps** and disable Ollama. Removing the gaming PC's local models or uninstalling Ollama is optional and should be done through Ollama's normal Windows controls after confirming the remote setup remains reliable.

To switch back later, set the ShipOS AI computer address to `127.0.0.1` and start Ollama locally.

## Official Ollama references

- Ollama FAQ and network binding: https://docs.ollama.com/faq
- Ollama Windows documentation: https://docs.ollama.com/windows
