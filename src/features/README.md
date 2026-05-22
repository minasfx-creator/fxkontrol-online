# /features — FXKONTROL Feature Modules

Phase F5.A (current): each `<feature>/index.ts` is a **read-only barrel** that
re-exports components still living in `src/components/editor/`.

Use these import paths in NEW code:

```ts
import { SafetyConsole, SafetyPanel } from '@/features/safety';
import { Timeline, TimelineScrubber } from '@/features/timeline';
import { ShowCommanderPanel } from '@/features/showplan';
import { FieldTestDesktop } from '@/features/fieldbus';
import { DMXArtNetConsole } from '@/features/artnet';
```

Phase F5.B (future): physically migrate files into each feature folder and
delete the editor/ shim. No import-path changes required at that time.

## Buckets
- `safety` — E-STOP, lockout, continuity, audit
- `timeline` — Timeline, SMPTE, scrubber, snap
- `cue-editor` — Effect/VDL/particle/transition editors
- `showplan` — Show/Plan/Position/Catalog/Asset/Stage
- `dockstation` — Dock, Rack, ConnectionManager, hardware hub
- `wfd` — Wi-Fi Direct, BLE, NFC, Mobile link, Radio control
- `artnet` — Art-Net, sACN, Universe, MA3/GMA2 patch
- `fieldbus` — FieldTest, FXK16, FireOne, Pyro, Module, Mux
- `logs` — Logs, BlackBox, Diagnostic, Reports, Telemetry
- `settings` — Settings, Calibration, OTA, Site, Venue, Project
- `nexus` — AR, Boids, Drone, Camera, Studio, 3D, Sky, Render
- `_shared` — Cross-feature UI: floats, overlays, mobile, generic
