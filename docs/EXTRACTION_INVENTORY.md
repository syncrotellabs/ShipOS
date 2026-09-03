# Extraction inventory

## Preserved in this repository

- `src/ShipOSPage.tsx`: complete current UI and domain model
- `src/ShipOSPage.css`: complete current visual system
- `public/shipos`: portraits and integration source, excluding generated ZIP artifacts
- `tests/shipos-*.test.mjs`: existing regression coverage
- `server/ShipOsData.cs`: current PostgreSQL state and telemetry implementation

## Still coupled to EchoBoard

- Authentication and authorization contracts supplied through `ShipOSPage` props
- `/api/ai/models` and `/api/gaming/shipos/ai/brief`
- `/api/shipos/state/{campaignKey}`
- `/api/shipos/telemetry/*`
- EchoBoard account labels and sign-in actions
- The `carthage` campaign key and DSV Intrepid seed content
- Hosted URLs and CORS rules referencing `gaming.echoboardhq.com`

## Deliberately not copied

- Generated helper, local-mod, and client-plugin ZIP files
- The prebuilt `ShipOSClientPlugin.dll`
- Unrelated EchoBoard web, API, database, worker, and game modules

## Next extraction seam

Move the planetary map into its own feature module with explicit telemetry and persistence interfaces. The full console can then compose that module for Pro, while Lite can ship the map without importing crew, mail, banking, jobs, AI, or campaign-management code.

