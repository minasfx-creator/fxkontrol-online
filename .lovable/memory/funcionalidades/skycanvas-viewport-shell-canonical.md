---
name: SkyCanvas Viewport Shell Canonical
description: Layout canônico fullscreen do editor SkyCanvas — promovido de /dev/skycanvas-lab smoke, com glass topbar pill + GlassTimelineDock glassmorphism reutilizando waveform/cues/lanes legacy
type: feature
---

# SkyCanvasViewportShell + GlassTimelineDock

**Layout DEFINITIVO do editor SkyCanvas.** Promovido de `/dev/skycanvas-lab?v=smoke` (que era apenas `<SkyCanvasMount />` fullscreen) com refinamentos cirúrgicos.

## Componentes

- `src/components/skycanvas/SkyCanvasViewportShell.tsx` — shell fullscreen (`fixed inset-0 bg-[#050810]`):
  - Glass topbar pill flutuante top-center (FXKONTROL · SKYCANVAS, SIM·ADVISORY, transport mini, timecode, audio picker via `decodeAudioPeaks`, Diag toggle, E-STOP cosmético → `/command`)
  - `<SkyCanvasMount engine='auto' />` fill 100% (mesmo mount canônico)
  - `<GlassTimelineDock />` na base, colapsável (default 200px, collapsed 36px barra)
  - `SkyCanvasDiagnosticsPanel` overlay opcional via `?diag=1` ou `Ctrl+Shift+D`
  - Atalhos: `Space`=play/pause, `⌘3`=toggle timeline, `Ctrl+Shift+D`=diag

- `src/components/skycanvas/GlassTimelineDock.tsx` — timeline glassmorphism:
  - Background: `rgba(5,8,16,0.55)` + `backdrop-blur(20px) saturate(140%)` + `shadow [0,-8px,32px,rgba(0,0,0,0.6)]`
  - 32px transport: `TransportBarLegacy` (legacy-2604, transparent override)
  - flex-1 ruler: `TimelineStripView` com `WaveformLayer` + cue markers + drop `FXK_EFFECT_DRAG_TYPE`
  - 88px lanes: `GlassTimelineLanes` (wrapper de `FiringLanesTimelineLegacy` com `[&>div]:!bg-transparent`)
  - Sync: `useProjectStore.currentTime` (clock master), `setCurrentTime/setPlaying/setPlaybackSpeed`
  - Drop em qualquer lane resolve via `resolveEffectLedAccurate` → `addCueMarker` (laneHint pyro/drone tagueado no label)

- `src/components/skycanvas/timeline/GlassTimelineLanes.tsx` — wrapper transparente do `FiringLanesTimelineLegacy`

## Adoção

- `/dev/skycanvas-lab?v=smoke` → `<SkyCanvasViewportShell variant="dev" />` (WYSIWYG dev/prod)
- `/skycanvas` (rota produção) → adoção planejada na próxima rodada (refator de 996 linhas com Master Menu / Library / Inspector — não tocado nesta rodada para não regressar)
- `VideoEditor` → opt-in futuro

## Plano

Show / Experience. **ZERO** imports de `core/safety|hardware|command|uiCommandGateway`. Garantido por:
- `src/__tests__/skycanvasViewportShell.guard.spec.ts` (3 tests verde)

## Tokens

- Vantablack `#050810` + cyan-dessat 190 70% 58% (canônicos preservados)
- Glass: `glass-pane glass-pane-strong` + override inline para força exata
- Sem laranja-CTA, sem `#00FFFF` puro

## Reutilização (zero novo engine)

| Camada | Origem |
|---|---|
| 3D viewport | `SkyCanvasMount` (canonical) |
| Transport | `TransportBarLegacy` (legacy-2604) |
| Waveform | `WaveformLayer` + `decodeAudioPeaks` |
| Cue ruler | `TimelineStripView` |
| Lanes Pyro/Drone | `FiringLanesTimelineLegacy` |
| Diagnostics | `SkyCanvasDiagnosticsPanel` |

E-STOP real continua exclusivo em `/command` via `uiCommandGateway` + `GlobalEStopButton` (top-right, montado em `MainLayout`, não tocado).
