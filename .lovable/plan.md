
# FXK 2.0 — Branding Strategy (Implemented)

## Brand Architecture

```text
┌─────────────────────────────────────────────────┐
│              FX KONTROL (Platform)              │
│              by MinasFX                         │
├─────────────┬───────────┬──────────┬────────────┤
│  FXK-PYRO   │  FXK-DMX  │FXK-LIGHT │FXK-DRONES │
│  Fire Control│  SFX/DMX  │ Lighting │  Aerial   │
│  (red)      │  (blue)   │ (indigo) │  (cyan)   │
├─────────────┴───────────┴──────────┴────────────┤
│           FXK-LINK  (Mobile Remote)             │
│           FXK-NET   (Network/ArtNet)            │
└─────────────────────────────────────────────────┘
```

## Completed Rebrandings
- FXcommander™ → FXK-PYRO (status bar, toasts, comments)
- SHOWVEN® · V2.0 → FX KONTROL · V2.0
- Show Commander → FXK-PYRO Hub (Dashboard)
- Super DMX → FXK-DMX | Simple DMX → FXK-DMX Lite
- Pyro XL4 → FXK-PYRO
- grandMA3 / MA3 → FXK-LIGHT (UI labels only, OSC internals kept)
- FireOne XL4+ → FXK-PYRO (controllers, hardware grid)
- IFMx-i32Q Module → FXK-PYRO Module
- FireOne Systems → FXK Fire Systems
- Mobile Link → FXK-LINK
- Art-Net → FXK-NET
- Drones → FXK-DRONES (category filter)

## Internal code preserved (protocol compatibility)
- `useFireOneHardware`, `usePBusHardware` hooks
- OSC addresses (`/gma3/...`)
- `buildMA3Command`, `buildMA3ExecutorFader` functions
- camelCase variables (`fireone`, `ma3`, `pbus`)
