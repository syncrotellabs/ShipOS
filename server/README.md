# Server extraction

`ShipOsData.cs` is preserved here as reference code from the EchoBoard API. It is not yet a runnable standalone service.

The next server milestone is a small ASP.NET Core service containing only:

- entitlement verification
- telemetry relay ingestion and retrieval
- optional state synchronization
- account-scoped campaign and vessel records

EchoBoard-specific access profiles and AI provider abstractions must be replaced with ShipOS-owned interfaces before this directory is release-ready.

