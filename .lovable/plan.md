

## Plan: Field Test Desktop Integration

### Problem
Field Test only appears as a navigation card in the mobile Command Center layout. The desktop sidebar has no entry for it, making it inaccessible on PC.

### Solution
Two changes:

1. **Add "FIELD TEST" to the desktop sidebar** as a new entry in the HARDWARE section of `MODE_SECTIONS`, making it a proper console mode instead of just a separate route.

2. **Create a desktop-optimized Field Test layout** — the current `FieldTest.tsx` is designed for mobile (portrait setup, small touch targets). The desktop version will use the available screen space with a multi-panel layout:

### Desktop Field Test Layout

```text
┌─────────────────────────────────────────────────────────┐
│  FIELD TEST — FXK DIAGNOSTIC CONSOLE          [status]  │
├────────────┬──────────────────────┬─────────────────────┤
│            │                      │                     │
│  SETUP     │   32-CH FIRE GRID    │  TELEMETRY &        │
│  ─────     │   (8×4, large)       │  DIAGNOSTICS        │
│  Role      │                      │  ─────────────      │
│  Transport │   Click-to-fire      │  Latency chart      │
│  Session   │   with ACK badges    │  Loss rate           │
│  BLE Scan  │   and latency ms     │  Session stats      │
│            │                      │  Event log          │
│  MODULE    │                      │  Benchmark          │
│  SELECTOR  │                      │  Report export      │
│  (sidebar) │                      │                     │
├────────────┴──────────────────────┴─────────────────────┤
│  ARM │ DISARM │ E-STOP │ FIRE ALL │ RESET │ CDS TEST    │
└─────────────────────────────────────────────────────────┘
```

### Files to modify

| File | Change |
|------|--------|
| `src/pages/CommandCenter.tsx` | Add `field_test` to `CommandMode` type, `CONSOLE_ACCENTS`, and `MODE_SECTIONS[HARDWARE]`. Add `renderDirectPanel` case that renders inline `FieldTestDesktop`. |
| `src/pages/FieldTest.tsx` | Extract a new `FieldTestDesktop` component with a wide multi-panel layout optimized for mouse interaction and large screens. Keep the existing mobile page as-is for the `/field-test` route. |

### Technical details

- **`FieldTestDesktop`**: A 3-column layout component using the same `fieldTestEngine` service. Left panel: setup/config + module scanner. Center: 32-ch fire grid with larger buttons and hover states (not just touch). Right: real-time diagnostics with latency histogram, session stats table, and scrollable event log.
- The setup flow (role/transport/code) will be inline in the left panel rather than a full-page takeover.
- Desktop buttons get hover effects, keyboard shortcuts (number keys 1-9 for channels, Space for ARM toggle, Escape for E-STOP).
- CDS continuity test grid rendered at full size in the center panel when in test mode.

