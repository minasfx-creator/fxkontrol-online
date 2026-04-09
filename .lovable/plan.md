

# Ciclo #58 — Sprint 5: SafetyValidator Avançado + Interlock State Machine + Audit Trail

## Inventário Existente

| Componente | Existe | Estado |
|---|---|---|
| SimulationValidator (geofence, collision, timing) | SIM | `src/core/validation/` — valida cues offline |
| SafetyEngine (deconfliction, geofence, PFT) | SIM | `src/lib/safetyEngine.ts` — runtime checks |
| ShowCommanderEngine (arm/disarm/lock/dryrun) | SIM | `src/hooks/useShowCommanderEngine.ts` — React hook, state local |
| FireOne Protocol (ARM/DISARM/E_STOP frames) | SIM | `src/lib/fireoneProtocol.ts` — hardware protocol |
| CommandBus (ARM_SYSTEM, DISARM_SYSTEM, E_STOP, FIRE) | SIM | Tipos existem, sem validação pré-execução |
| CommandLog + IndexedDB persistence | SIM | Sprint 4 |

## O que FALTA

1. **SafetyValidator como gate do CommandBus** — hoje comandos FIRE/ARM passam direto sem validação
2. **Interlock chain** — sequência obrigatória (LOCK → ARM → FIRE) com pré-condições verificáveis
3. **Arm/Disarm state machine** — determinística, fora do React, integrada no kernel
4. **Safety Audit Trail** — log persistido de todas as transições de segurança (arm, disarm, fire, e-stop, violations)

## Deliverables

### 1. SafetyStateMachine — `src/core/safety/SafetyStateMachine.ts`

Estado determinístico da cadeia de segurança, fora do React:

```text
States: IDLE → LOCKED → ARMED → FIRING → COOLDOWN → IDLE
                                    ↘ E_STOP → SAFE (terminal until manual reset)

Transitions:
  IDLE     + LOCK_STATE    → LOCKED   (freezes cue sheet)
  LOCKED   + ARM_SYSTEM    → ARMED    (requires: link stable, validation passed, not dry-run)
  ARMED    + FIRE          → FIRING   (requires: continuity OK on target)
  ARMED    + DISARM_SYSTEM → LOCKED
  FIRING   + fire_complete → COOLDOWN
  COOLDOWN + timeout(2s)   → ARMED
  ANY      + E_STOP        → SAFE
  SAFE     + RESET_SAFETY  → IDLE
```

Cada transição registra no audit trail. Transições inválidas são rejeitadas com motivo.

### 2. SafetyValidator — `src/core/safety/SafetyValidator.ts`

Gate que intercepta comandos no CommandBus ANTES da execução:

```text
SafetyValidator
├── validate(cmd) → { allowed: boolean; reason?: string }
├── setInterlockConfig(config)
├── getInterlockStatus() → InterlockReport
```

Regras de interlock:
- `FIRE` requer: state === ARMED, link !== 'lost', continuity check passed
- `ARM_SYSTEM` requer: state === LOCKED, validation report passed (no criticals)
- `DISARM_SYSTEM` requer: state === ARMED (no-op otherwise)
- `E_STOP` always allowed (bypasses all gates)

### 3. SafetyAuditTrail — `src/core/safety/SafetyAuditTrail.ts`

Log append-only de eventos de segurança, persistido no IndexedDB:

```text
AuditEntry {
  timestamp: number       // Date.now()
  tick: number            // lockstep tick
  event: string           // 'ARM' | 'DISARM' | 'FIRE' | 'E_STOP' | 'VIOLATION' | 'STATE_CHANGE'
  from: string            // previous state
  to: string              // new state
  detail: string          // human-readable
  originSiteId?: string   // for distributed ops
}

SafetyAuditTrail
├── log(entry)
├── getAll() → AuditEntry[]
├── exportJSON() → string
├── persist() → Promise<void>    // flush to IndexedDB
├── load() → Promise<void>       // restore from IndexedDB
```

### 4. Integration — CommandBus + EngineProvider

**Edit `src/core/command/CommandBus.ts`:**
- Add types: `LOCK_STATE`, `UNLOCK_STATE`, `RESET_SAFETY`

**Edit `src/orchestration/EngineProvider.tsx`:**
- Register SafetyValidator as priority -1 subsystem (runs BEFORE commandBus drain)
- On each drain, pass commands through `safetyValidator.validate()` — rejected commands logged to audit trail but NOT applied
- Register SafetyStateMachine transition handlers for ARM/DISARM/FIRE/E_STOP
- Boot: load audit trail from IndexedDB
- Flush audit trail alongside snapshots/commandLog

### 5. UI — SafetyInterlockBadge in ShowCommanderPanel

Small status badge showing current interlock state + chain progress (IDLE → LOCKED → ARMED). Replaces the manual `isArmed`/`isLocked` state in `useShowCommanderEngine` with reads from `SafetyStateMachine`.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/core/safety/SafetyStateMachine.ts` |
| Criar | `src/core/safety/SafetyValidator.ts` |
| Criar | `src/core/safety/SafetyAuditTrail.ts` |
| Criar | `src/core/safety/index.ts` (barrel) |
| Editar | `src/core/command/CommandBus.ts` (add LOCK_STATE, UNLOCK_STATE, RESET_SAFETY types) |
| Editar | `src/orchestration/EngineProvider.tsx` (validator gate + audit trail boot/flush) |
| Editar | `src/components/editor/ShowCommanderPanel.tsx` (interlock badge, delegate to state machine) |

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Criar SafetyStateMachine (pure state machine) |
| 2 | Criar SafetyAuditTrail (append-only + IDB) |
| 3 | Criar SafetyValidator (command gate) |
| 4 | Adicionar novos command types ao CommandBus |
| 5 | Integrar no EngineProvider (gate + audit + boot) |
| 6 | Atualizar ShowCommanderPanel com interlock badge |
| 7 | Build verification |

