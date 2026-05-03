---
name: training-v2-cinematic
description: Training mode v2 — GTA V-style staged missions, MetaHuman-style HumanoidCharacter NPCs, briefing/debrief cutscenes, MissionRunner FSM
type: feature
---

Training mode 2.0 ("GTA V Roadie Edition"):

- **MissionScript** (src/components/training/missions/types.ts) substitui `Mission` flat: briefing → stages[] → debrief, com `NPCEvent`, `DialogueLine`, `realWorldFact` linkado a `MANUALS[]`.
- **MissionRunner FSM** (src/components/training/missions/missionRunner.ts): pure state machine — `briefing`/`running`/`cutscene`/`complete`/`failed`, `tick(dt)`, `completeObjective(id)`, `reportSafetyViolation()`, `reset()`. Stars calculados via tempo restante − violações.
- **6 scripts** em MISSION_SCRIPTS (tutorial-truss, sfx-setup, dmx-config, drunk-invasion, producer-late, full-reveillon) com stages segmentados — snap points revelados por estágio (não tudo de uma vez).
- **HumanoidCharacter** (src/components/training/humanoid/HumanoidCharacter.tsx): MetaHuman stand-in em R3F — proporções 7.5-head, MeshPhysicalMaterial PBR (clearcoat skin + sheen tecido), eye-tracking, jaw-open lipsync proxy, idle blend (breath+sway+gesticulating/wobbly/pacing/alert/still), rim light em closeup.
- **NPC catalog** (src/components/training/npcs/npcCatalog.ts): 9 personas — roadie-veterano, produtor-ansioso, cliente-indeciso, convidado-bebado, seguranca, bombeiro-fiscal, dancarino-passagem, tecnica-som, eletricista-radio. Cada persona com bodyType/skinTone/hair/outfit/idleProfile/voiceProfile/subtitleColor.
- **HUD GTA-style** (src/components/training/hud/CinematicHUD.tsx): CinematicLetterbox (12vh top/bottom), MissionTriangle (chapter+title+stage X/Y), DialogueSubtitle (typewriter 22ms/char + ESPAÇO skip + speakerName colorido), ScorePopup, StarRating.
- **CinematicTrainingSimulator** (src/components/training/CinematicTrainingSimulator.tsx): wrapper que substitui o legacy quando `featureFlags.training_v2_cinematic` ativo. DebriefScreen com stars + takeaways técnicos + replay.
- **Feature flag**: `training_v2_cinematic` (default ON em src/lib/featureFlags.ts) — Training.tsx faz fallback para legacy `TrainingSimulator` se script não existe ou flag OFF.
- **Wire-up**: src/pages/Training.tsx detecta script via `getMissionScript(activeMission.id)`.
- **Safety**: zero impacto em workMode/SafetyStateMachine/CommandBus — pure simulation, nenhum hardware armed/fired.
- **Tests**: 15 testes em src/components/training/missions/__tests__/missionRunner.test.ts (FSM advance, fail conditions, idempotência, catalog integrity).
