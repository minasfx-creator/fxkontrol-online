---
name: Phase 1 transition gate
description: Lógica + UI para transitar Fase 0 → Fase 1 validando pendingRequiredAdapters() em sessão real e abrindo o golden show selecionado no Show3DEngine real (preview cinematográfico).
type: feature
---

## API (`src/lib/showSeeds/phase1Transition.ts`)

`evaluatePhase1Gate(entry: GoldenShowEntry, registry)` → `Phase1GateResult`
- Pure, deterministic. NO side-effects.
- Combina 3 fontes de verdade canônicas:
  1. `verificationEngine.run(seed)` → READY_FOR_EXPORT/FIELD + 0 errors
  2. `pendingRequiredAdapters(registry)` → array vazio (Fase 0 exit)
  3. `simulationDryRun(seed).cuesFired === seed.pyroCues.length`
- Retorna `{ ok, seedId, verificationLevel, verificationErrors, pending, cuesFired, totalCues, reasons[], evaluatedAt }`
- `reasons`: 'verification-not-ready' | 'verification-errors' | 'pending-required-adapters' | 'simulation-incomplete'

`recordPhase1Transition(result)` → `Phase1AuditEntry`
- Persiste gate result em `localStorage[fxk.phase1.transitions.v1]` (ring buffer cap=50, oldest dropped).
- Persiste **granted E denied** — ambos auditáveis.

`getPhase1AuditLog()` / `clearPhase1AuditLog()` / `explainBlockReason(r)` — helpers PT-BR.

## UI (`src/components/dev/Phase1TransitionPanel.tsx`)

Painel inline montado em `/dev/golden-shows`. Tick 2s re-avalia gate live contra `unifiedHardwareRegistry`. Seleciona seed (dropdown), mostra 4 stats (Verification level/errors, Cues fired, Pending adapters), lista de adapters pendentes + lista de bloqueios PT-BR.

Botão **"Open & Validate (Phase 1)"** chama `recordPhase1Transition(gate)` (sempre — registra denied também), e quando granted abre `<ShowEngineHost plan={canonicalToEnginePlan(seed)} autoPlay />` inline (h-96), com Particle Explosions + Light Points renderizados via auto-play do Show3DEngine. Toast de sucesso/falha.

Audit trail (últimas 10 transições) com badge GRANTED/DENIED, timestamp, cues, pendentes, primeira reason.

## Honesty
- ZERO CommandBus, ZERO FieldBus, ZERO mudança de workMode.
- Engine preview é puramente visual (mesmo Show3DEngine usado em /dev/libertadores e /dev/golden-shows).
- A "sessão real" é o site passar `unifiedHardwareRegistry` singleton; testes passam mock registry com provenances scriptadas.

## Tests (`src/lib/showSeeds/__tests__/phase1Transition.test.ts` · 9 tests)

- Gate: grants/blocks por estado dos adapters; cobre todos seeds do catálogo; validates ISO timestamp.
- Audit: persiste granted/denied; reasons preservadas; cap=50; clear() wipes; explainBlockReason cobre as 4 reasons.
