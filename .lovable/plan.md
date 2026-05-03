# Training v2.1 — Roadie Academy (Unreal Edition)

Refinamento profundo do Training v2 atual. Foco: profundidade de missões, fidelidade visual MetaHuman-style, situações reais de palco, e direção cinemática estilo GTA V (cutscene → gameplay → debrief).

**Safety:** tudo permanece em `workMode = simulation`. Zero impacto em CommandBus / SafetyStateMachine / FieldBus.
**Flag:** continua sob `training_v2_cinematic` (já ON).

---

## 1. Roteirização aprofundada (missionScripts v2)

Hoje: 6 missões, briefing + 1–3 stages flat.
Meta: **16 missões** organizadas em 5 capítulos progressivos, com **stages multi-tipo** (`place` → `inspect` → `dialogue` → `fire-check` → `evacuate`), beats narrativos no meio do gameplay, e múltiplos NPCs reagindo dinamicamente.

Capítulos:
- **Cap. 1 — Carga & Montagem** (3 missões): truss H, truss A-frame, ground support
- **Cap. 2 — Energia & DMX** (3 missões): distribuição AC trifásica, RCD/PE check, patch DMX 2 universos, terminator chain
- **Cap. 3 — SFX & Pirotecnia** (3 missões): sparkular safe-arc, flamer FR clearance, mortar layout NFPA 1123
- **Cap. 4 — Caos ao Vivo** (4 missões): bêbado no palco, chuva súbita, queda de fase, dançarino na linha de fogo
- **Cap. 5 — Show Completo** (3 missões): casamento, festival corporativo, Réveillon legendary

Cada missão ganha:
- `cinematicBeats[]` — momentos para câmera cutscene mid-gameplay (dolly, crane, close-up)
- `voiceLines[]` (texto + duração + intent: 'urgent'|'calm'|'excited') usados pra modular lipsync amplitude
- `manualRefs[]` por objective (link real para `MANUALS[]` em Training.tsx)
- `failureScenarios[]` — narrativas distintas para falhas distintas (tempo, violation, ordem errada)

## 2. NPCs refinados (MetaHuman+ stand-in)

Expansão do `HumanoidCharacter.tsx`:
- **Mesh secondaries**: belt loop, walkie-talkie, prancheta, capacete (props paramétricos por outfit)
- **Cloth sim leve**: vest/blazer com sway (Three.js bone offset, sem CCD — pseudo-cloth via senoide)
- **Eye blink** (3–6s aleatório, durabilidade 100ms)
- **Brow micro-expressions** (preocupação, aprovação) sincronizadas com `voiceLine.intent`
- **Hand IK simplificado**: mão aponta pra alvo durante `speak` se `pointAt` setado
- **Footstep IK**: pés grudam no chão durante idle (hoje flutuam)

Catálogo cresce de 9 → **14 NPCs**: + bombeiro-jovem, eletricista-presente (vs rádio), DJ, cliente-corporativo, segurança-feminina.

## 3. Câmera cinemática GTA-V

Novo `CinematicCameraDirector.tsx`:
- **Shot library**: `wide-establishing`, `medium-2shot`, `over-the-shoulder`, `close-up-reaction`, `crane-down`, `dolly-in`
- Trigger por `cinematicBeats[]` da missão; transição com lerp 1.2s (ease-in-out)
- Fora de cutscene volta ao OrbitControls do jogador (camera state preservado)
- Letterbox auto-anima 12vh in/out
- Depth-of-field sutil (postprocessing `Bokeh` opcional via flag, fallback fog-density bump)

## 4. HUD GTA-V refinado

`CinematicHUD.tsx` ganha:
- **Mission triangle pulsante** quando objetivo novo é revelado
- **Subtitle queue** — múltiplas linhas em fila, não sobrescreve
- **Floating XP popups** (`+50 XP — perfect snap`) ao completar objetivo
- **Wasted/Mission Failed screen** (full-bleed vermelho, slow-mo 0.4× fade)
- **Mission Passed flash** (golden bar sweep)
- **Mini-map canto inferior-esquerdo** (top-down do palco com NPCs e equipment placeholders)

## 5. Situações cotidianas de palco

Novo módulo `ambientChoreographer.ts` que, em **qualquer** missão, agenda micro-eventos (NPCs paralelos):
- DJ fazendo soundcheck ao fundo (toca beat 4 batidas a cada 30s)
- Dançarinos passando coreografia em linha reta
- Cliente checando relógio
- Roadie carregando case do ponto A→B
- Walkie-talkie chiando ("rádio interno")

Configurável por chapter — Cap. 5 fica caótico, Cap. 1 fica calmo.

## 6. Arquivos previstos

**Novos:**
- `src/components/training/missions/missionScripts.ts` — ampliado para 16 missões (substitui)
- `src/components/training/missions/types.ts` — adiciona `cinematicBeats`, `voiceLines`, `failureScenarios`
- `src/components/training/camera/CinematicCameraDirector.tsx`
- `src/components/training/camera/shotLibrary.ts`
- `src/components/training/hud/MiniMap.tsx`
- `src/components/training/hud/XPPopupLayer.tsx`
- `src/components/training/hud/MissionFailedScreen.tsx`
- `src/components/training/hud/MissionPassedFlash.tsx`
- `src/components/training/ambient/ambientChoreographer.ts`
- `src/components/training/ambient/AmbientNPCLayer.tsx`
- `src/components/training/npcs/npcCatalog.ts` — +5 NPCs (substitui)
- `src/components/training/humanoid/HumanoidCharacter.tsx` — refinamento PBR + props + blink + IK
- `src/components/training/humanoid/HumanoidProps.tsx` — props paramétricos (capacete, prancheta, walkie)
- `src/components/training/missions/__tests__/missionScripts.coverage.test.ts` — garante 16 missões, todas com briefing+debrief+manualRefs
- `src/components/training/camera/__tests__/cameraDirector.test.tsx` — transições determinísticas

**Editados:**
- `src/components/training/CinematicTrainingSimulator.tsx` — monta director + minimap + xp layer + ambient layer; passa `cinematicBeats` ao runner
- `src/components/training/missions/missionRunner.ts` — emite eventos `beat:start`, `beat:end`, `objective:revealed` para director e XP layer

## 7. Testes

- 15+ novos unit tests (FSM beats, ambient scheduler, camera director lerp, mission catalog coverage)
- Mantém suíte atual em verde (1047/1047 → ~1062/1062)

## 8. Performance

- HumanoidCharacter cap em **8 NPCs simultâneos** (ambient + scripted); excedentes viram billboards lod
- Eye blink/IK usam `useFrame` único compartilhado (zero subscriptions extras)
- Cinematic camera reaproveita o `<Canvas>` existente (sem segundo viewport)

---

## Fora de escopo (deixar pra v2.2)

- Voice-over real (TTS) — manteremos lipsync proxy + texto
- MetaHuman vinculado de fato (Quixel runtime) — fora do bundle web; usamos stand-in PBR
- Multiplayer cooperativo
- Save/replay de runs

Posso prosseguir?
