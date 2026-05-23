---
name: Training Achievements + Mission Unlocks
description: 4 conquistas (Zero Violations / Perfect Cue Timing / No Unknown Devices / E-STOP Ready) com store persistente e desbloqueio sequencial + bônus por contagem
type: feature
---

**Pure engine** (`src/components/training/achievements/achievements.ts`):
- `evaluateAchievements({script, snap, attempts})` → `{awarded, bonusXP}`. Só awarda se `snap.phase === 'complete'`.
  - `zero-violations`: `snap.safetyViolations === 0`
  - `perfect-cue-timing`: `remainingSeconds / timeLimitSeconds >= 0.6`
  - `no-unknown-devices`: zero `attempts.correct === false`
  - `e-stop-ready`: missão tem stage `inspect|fire-check` AND `safetyViolations === 0`
- `computeUnlocks({orderedMissionIds, justCompletedId, lifetimeAchievements, currentUnlocked})`:
  - Sequencial: completou missão N → desbloqueia N+1
  - 3 conquistas distintas → desbloqueia `producer-late`
  - 4 conquistas distintas → desbloqueia `full-reveillon`
  - Idempotente

**Store** (`useAchievementsStore`, persist `fxk.training.achievements.v1`):
- `lifetime: AchievementId[]`, `missionRuns`, `unlockedMissions`, `lastBatch`
- `recordMissionCompletion()` chamado UMA vez por mount no DebriefScreen (guard `recordedRef`)
- `resetAll()` apaga conquistas + desbloqueios

**UI**:
- `AchievementsBadgeStrip` no DebriefScreen mostra 4 conquistas (earned/locked) + missões recém-desbloqueadas, com `.op-go-pulse` nos novos
- `TrainingCenter > MissionsPanel`: cards lockados (Lock icon + opacity 60), badge OK em completos, chips de conquistas earned, banner "Conquistas/Missões liberadas" no topo (lê `lastBatch`)
- `TrainingCenter > ProgressPanel`: progresso real (X/Y missões), grid 4 conquistas com tone token (ok/sync/warn/fail), bônus XP total, hint "3+ → producer-late, 4 → full-reveillon", botão Resetar
- `Training.tsx` reconcilia `INITIAL_MISSIONS.locked` com `unlockedMissions` da store

**Safety**: zero impacto em CommandBus/SafetyStateMachine/FieldBus/workMode. Tudo client-side, modo design/simulation.

**Tests**: 9/9 (`achievements.test.ts`) — eval por flag, e-stop-ready gating, computeUnlocks producer-late+full-reveillon, idempotência.
