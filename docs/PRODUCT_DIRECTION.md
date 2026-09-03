# Product direction

## ShipOS is free

ShipOS should be a focused, friendly companion for Space Engineers players and modders. It will not contain paid feature gates, license validation, subscriptions, advertisements, or account requirements for local use.

## First release: map-first, not map-only

The planetary map is the product's center, but a static map would not be useful enough on its own. The first release should include the small set of tools that make the map come alive:

- planetary map and local vessel position
- live local telemetry
- GPS import and map annotations
- contacts, relationship filters, and search
- useful altitude, velocity, heading, and distance readouts
- local profiles, preferences, import, and export
- offline operation after installation

Crew records, mail, banking, jobs, AI briefings, and campaign-specific lore should not ship in the first public release. They can survive as optional experiments until there is a clear player need.

## Hosted services

`shipos.echoboardhq.com` may later provide documentation, downloads, update metadata, and an optional hosted viewer. The local map and telemetry path must not depend on that service remaining online.

If remote relay or synchronization is offered later, start with conservative free limits and publish the data-retention behavior clearly. Do not collect gameplay telemetry by default.

## Community posture

- make installation and removal boring and predictable
- keep the telemetry collector transparent about exactly what it reads and sends
- publish source for the game-facing mod and plugin
- accept bug reports and small integrations without turning ShipOS into a giant platform
- use factual compatibility language and do not imply endorsement by Keen Software House

## Decisions still required

- final product name and trademark clearance
- Windows package format and code-signing plan
- ownership and release rights for portraits and campaign assets
- privacy, support, update, and security-reporting policies
