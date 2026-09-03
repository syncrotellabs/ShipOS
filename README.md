# ShipOS

> A Space Engineers thing. You wouldnt understand.

Standalone development repository for ShipOS, extracted from EchoBoard Gaming for an independent free release.

This repository currently preserves the complete ShipOS feature set while the first map-focused release is separated from the campaign-console features. ShipOS is free and open source under the MIT License.

## Current baseline

- React and TypeScript web application
- Three.js planetary and tactical visualization
- Browser-local campaign state
- Space Engineers telemetry bridge, local mod, and client-plugin source
- Extracted PostgreSQL persistence implementation for later server separation
- ShipOS regression tests from the source project

The prebuilt helper, mod, and plugin ZIP files from EchoBoard Gaming are deliberately excluded. Release packaging must rebuild artifacts from reviewed source.

## Development

```powershell
pnpm install
pnpm test
pnpm build
pnpm dev
```

The optional API proxy defaults to `http://localhost:5010`. Override it with `VITE_SHIPOS_API_URL`.

## Source provenance

Extracted from `syncrotellabs/EchoboardGaming` branch `echoboard-gaming-live` at commit `bb02270331817200c7b7de6dbaf1a7c64894e83d` on 2026-09-02.

See [docs/EXTRACTION_INVENTORY.md](docs/EXTRACTION_INVENTORY.md), [docs/PRODUCT_DIRECTION.md](docs/PRODUCT_DIRECTION.md), and [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).

## License

ShipOS is licensed under the [MIT License](LICENSE). Runtime dependency notices are collected in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
