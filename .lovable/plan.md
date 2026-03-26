

# Plan: Fix Dual Console + Refine FXK-PYRO UX

## Problem

When `pyro_fire` mode is active in `LiveFiringPanel`, two complete console UIs stack:

```text
LiveFiringPanel chrome:
  StatusBar (FXK-PYRO branding, timecode)
  ArmBar (PYRO/DMX arm buttons)
  CueKeys (128 cue grid)
  SceneModeBar (S0-S3 + mode tabs)
  ┌── PyroFireOnePanel ──────────────────┐
  │  Header (FXK-PYRO branding, clock)   │  ← DUPLICATE
  │  ConnectionBar (SIM/HW toggle)       │
  │  MasterArm (master key, arm all)     │  ← DUPLICATE ARM
  │  StatusStrip                         │
  │  ModeTabs (manual/step/tc/test)      │
  │  ModuleGrid (32 igniters)            │
  │  PANIC                               │  ← DUPLICATE
  └──────────────────────────────────────┘
  PANIC                                    ← DUPLICATE
```

Result: duplicate branding, duplicate ARM controls, duplicate PANIC buttons, wasted vertical space.

## Solution

### 1. Skip outer chrome when `standalone && mode === 'pyro_fire'`

In `LiveFiringPanel.tsx`, when the panel is in standalone mode (CommandCenter) AND `mode === 'pyro_fire'`:
- **Skip** `renderStatusBar`, `renderArmBar`, `renderCueKeys`, `renderPanic`
- **Keep** `renderSceneModeBar` (contains mode-switch tabs for navigating away from pyro_fire)
- Let `PyroFireOnePanel` own the full viewport with its own header, arm, and panic

This applies to both fullscreen (lines 1436-1448) and inline (lines 1456-1464) renders.

### 2. Sync ARM state between consoles

Wire `PyroFireOnePanel`'s `masterKeyOn` toggle to also call the parent's `handlePyroArm` so the global ARMED banner in `MainLayout` stays in sync. Currently `masterKeyOn` is internal-only — the outer `pyroArm` drives the banner but inner panel doesn't update it.

### 3. PyroFireOnePanel panel mode: add PANIC when not fullscreen

`PyroFireOnePanel` currently only renders `renderPanic()` in its dedicated fullscreen mode (line 1597). In panel mode (line 1607-1625), there's **no PANIC button** — it relies on the outer shell. After removing outer chrome, we need to add `renderPanic()` to the panel mode render too.

### 4. Desktop glass refinements

- Apply `glass-br2049` backdrop to the `PyroFireOnePanel` panel-mode container
- Increase igniter grid cell size from 36px to 44px for confident clicking
- Add subtle amber glow border on the active module in the sidebar list

### 5. CSS cleanup in index.css

- Remove duplicate `body.night-mode` block (if still present around line 669)
- Remove orphaned `/* .br2049-vignette disabled */` comment (line 985)

## Files to Change

| File | Changes |
|------|---------|
| `src/components/editor/LiveFiringPanel.tsx` | Skip outer chrome when `standalone && mode === 'pyro_fire'`; add PANIC sync |
| `src/components/editor/live-firing/PyroFireOnePanel.tsx` | Add `renderPanic()` to panel mode; glass styling; larger igniter cells; emit ARM state up |
| `src/index.css` | Remove duplicate night-mode block and orphan comments |

## Impact

- Eliminates visual confusion of "two consoles"
- Recovers ~200px of vertical space on desktop
- Single source of truth for ARM/PANIC
- Cleaner, more professional appearance aligned with "built by operators" UX goal

