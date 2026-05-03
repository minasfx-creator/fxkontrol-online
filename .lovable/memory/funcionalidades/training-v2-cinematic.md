---
name: Training v2.1 Cinematic Roadie Academy
description: GTA-V style staged missions + MetaHuman+ NPCs + cinematic camera director + ambient layer + GTA HUD (failed/passed/minimap/xp); 10 missions in 5 chapters; flag training_v2_cinematic
type: feature
---

**Catálogo**: 10 missões em 5 capítulos (Carga&Montagem, Energia&DMX, SFX&Pirotecnia, Caos ao Vivo, Show Completo). Cada missão tem `cinematicBeats[]`, `failureScenarios[]`, `ambient` preset, `voice intent` por linha.

**FSM (`missionRunner.ts`)**: agora emite eventos `stage:start`, `stage:complete`, `objective:revealed`, `objective:complete`, `beat:start`, `mission:complete`, `mission:failed`, `safety:violation`. 5 violações = fail automático. `onEvent()` separado de `subscribe()`.

**HumanoidCharacter v2.1**: blink (3-6s rand 100ms), brow micro-expressions por intent, hand-IK pointing quando `pointAt` setado, foot grounding (sapatos), pseudo-cloth sway no accent, props (helmet/clipboard/walkie/headphones/visor/megaphone/tool-belt), 3 novos cabelos (crew/ponytail/fauxhawk), 5 novos outfits.

**NPC catalog**: 14 personas (9 originais + paulo eletricista, dj-residente, cliente-corporativo, seguranca-feminina, bombeiro-jovem) com `defaultIntent` e `props[]`.

**Camera**: `CinematicCameraDirector` lerpa entre OrbitControls e shots de `SHOT_LIBRARY` (8 shots: wide-establishing, medium-2shot, OTS, close-up-reaction, crane-down, dolly-in, low-angle-hero, orbit-slow). Disabled OrbitControls enquanto beat ativo. Resolve focus via `npcId` ou `focus` posição.

**Ambient**: `ambientChoreographer.pickAmbientHints({preset})` deterministico (calm=1/busy=3/frantic=5). `AmbientNPCLayer` walks NPCs por waypoints loop em background, exclude lista de NPCs scripted.

**HUD GTA**: MissionTriangle + DialogueSubtitle (typewriter+SPACE skip) + StarRating + MiniMap (top-down SVG, NPC dots, snap points pendentes) + XPPopupLayer (floating +N XP fade-up) + MissionFailedScreen ("WASTED" red overlay com flavor+lesson) + MissionPassedFlash (golden sweep entre stages).

**Safety**: zero impacto em CommandBus / SafetyStateMachine / FieldBus / workMode. Tudo em `simulation`. 

**Tests**: 25/25 (3 files): missionRunner.test (15) + missionScripts.coverage.test (7) + ambientChoreographer.test (3).
