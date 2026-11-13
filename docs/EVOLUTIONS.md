# ShipOS evolution pad

This is the working product backlog captured during the November 2026 development pass. It is directional rather than a release promise.

1. **Two-way game bridge — first slice implemented.** Opt-in, addressed text now moves between Space Engineers and ShipOS: current telemetry and player chat flow to the helper/Ollama, and bounded replies return to game chat. A revocable, scoped collector extends the same path across a trusted private LAN when the game and app run on different computers. Block actions, steering, inventory changes, save mutation, and hosted-relay commands remain deliberately out of scope.
2. **Session replay and after-action reports.** Add timeline scrubbing, event bookmarks, comparison snapshots, and telemetry-grounded chronicle drafts on top of the bounded packet history.
3. **Deeper engineering diagnostics.** Add block-group trends, consumption rates, failing-system drill-down, endurance estimates, and configurable alerts beyond aggregate reserves.
4. **Customizable bridge stations.** Add pin/resize/reorder/fullscreen panels, per-device Navigation/Engineering/Security layouts, and lazy-loaded consoles.
5. **Telemetry-grounded story director.** Turn observed landings, docking, damage, low reserves, contacts, and GPS arrivals into explicitly optional mission, EchoMail, and chronicle suggestions while preserving observed-versus-fiction labels.
