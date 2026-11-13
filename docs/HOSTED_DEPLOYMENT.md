# Hosted ShipOS deployment

The hosted build is separate from the Windows/local Space Engineers companion. It displays the server's shared ShipOS records and can receive an explicitly enabled, upload-only telemetry feed from the gaming PC over HTTPS.

## Access model

- An unauthenticated visit is sent through the WordPress bridge. If WordPress has no logged-in user, the bridge returns the visitor to `https://echoboardhq.com/`.
- A logged-in WordPress user receives a read-only ShipOS session.
- A user whose WordPress role includes the exact `administrator` role slug receives read/write access.
- The Node service enforces the role on every mutation. Disabled controls are not the security boundary.
- ShipOS never receives or stores a WordPress password. WordPress issues a signed, single-use, 60-second assertion; ShipOS stores only its own hashed session token and the WordPress user ID, display name, and role.
- A WordPress administrator can create and revoke telemetry relay keys. A key is displayed once, stored as a SHA-256 hash on the server, and authorizes only `POST /api/relay/telemetry`. It cannot read records, edit stories, or control the game.
- Authenticated members can view relayed telemetry. Only administrators can issue/revoke keys or edit hosted Storytelling records.

## Build and install

1. Install Node.js 24 and pnpm 11 on the Linux host.
2. Clone this repository to `/opt/shipos/app`, then run `pnpm install --frozen-lockfile` and `pnpm build:hosted`.
3. Create a dedicated `shipos` service account and writable `/var/lib/shipos` directory.
4. Copy `hosted/shipos.env.example` to `/etc/shipos/shipos.env`, restrict it to root and the service account, and replace the sample secret with a cryptographically random value of at least 32 bytes.
5. Add the same secret and fixed callback to WordPress `wp-config.php`:

   ```php
   define('SHIPOS_SSO_SECRET', 'the-same-long-random-secret');
   define('SHIPOS_SSO_CALLBACK', 'https://shipos.echoboardhq.com/auth/callback');
   ```

6. Copy `wordpress/shipos-sso.php` into the WordPress site's `wp-content/mu-plugins/` directory. Create that directory if it does not exist. An MU plugin avoids a separate activation step.
7. Install `hosted/shipos.service.example` as a systemd service, adjusting the Node path if necessary. Enable and start it.
8. Replace the retired `shipos.echoboardhq.com` web-server route with `hosted/nginx-shipos.conf.example`, retain the existing TLS certificate directives, test the Nginx configuration, and reload Nginx.

## Connect a gaming PC

1. Sign in to `https://shipos.echoboardhq.com` with a WordPress administrator account.
2. Open ShipOS Configuration, enter a recognizable gaming-PC label, and choose **Create relay key**.
3. Copy the key immediately; the website cannot reveal it later.
4. On the gaming PC, open local ShipOS Configuration, paste the key under **Optional Echoboard telemetry relay**, and choose **Enable secure relay**.
5. Confirm that the local status becomes **Connected** and that the hosted Telemetry page shows the game world. No inbound firewall or router rule is needed.

The relay is off by default. Uploaded packets may contain world/ship names, coordinates, systems status, nearby contacts, and saved GPS names and coordinates. Storytelling records and Ollama prompts are not uploaded. Disable locally to erase the raw local key; revoke the device on the hosted page to reject future uploads. Hosted telemetry retention is bounded to 1,000 packets and 32 MB.

## Verification

1. `curl https://shipos.echoboardhq.com/healthz` returns `{"ok":true}`.
2. A logged-out browser visiting ShipOS ends at the Echoboard HQ home page.
3. A normal WordPress user can browse both main tabs but a direct `PUT /api/state` receives HTTP 403.
4. A WordPress administrator can edit a harmless story field, reload, and see it persist.
5. Reusing a callback assertion fails; ending the ShipOS session returns to Echoboard HQ.
6. An administrator can create a relay key; the key appears in that creation response but never in the device list.
7. A configured gaming PC receives HTTP 202 from the relay endpoint, while the same key receives HTTP 401 after revocation.
8. A normal WordPress member can view the relayed Telemetry page but still cannot mutate state or manage relay keys.

Keep `/etc/shipos/shipos.env`, `wp-config.php`, the SQLite database, backups, and raw relay keys outside Git. Rotate the WordPress shared secret if either host configuration is exposed; existing ShipOS sessions can be invalidated by deleting the `sessions` rows or the hosted SQLite database during a maintenance window. Revoke any relay key that may have been exposed and create a replacement.
