# Hosted ShipOS deployment

The hosted build is separate from the Windows/local Space Engineers companion. It displays the server's shared ShipOS records; it does not relay a player's live local telemetry over the internet.

## Access model

- An unauthenticated visit is sent through the WordPress bridge. If WordPress has no logged-in user, the bridge returns the visitor to `https://echoboardhq.com/`.
- A logged-in WordPress user receives a read-only ShipOS session.
- A user whose WordPress role includes the exact `administrator` role slug receives read/write access.
- The Node service enforces the role on every mutation. Disabled controls are not the security boundary.
- ShipOS never receives or stores a WordPress password. WordPress issues a signed, single-use, 60-second assertion; ShipOS stores only its own hashed session token and the WordPress user ID, display name, and role.

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

## Verification

1. `curl https://shipos.echoboardhq.com/healthz` returns `{"ok":true}`.
2. A logged-out browser visiting ShipOS ends at the Echoboard HQ home page.
3. A normal WordPress user can browse both main tabs but a direct `PUT /api/state` receives HTTP 403.
4. A WordPress administrator can edit a harmless story field, reload, and see it persist.
5. Reusing a callback assertion fails; ending the ShipOS session returns to Echoboard HQ.

Keep `/etc/shipos/shipos.env`, `wp-config.php`, the SQLite database, and backups outside Git. Rotate the shared secret if either host configuration is exposed; existing ShipOS sessions can be invalidated by deleting the `sessions` rows or the hosted SQLite database during a maintenance window.
