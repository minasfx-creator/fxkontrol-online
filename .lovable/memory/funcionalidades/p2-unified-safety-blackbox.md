---
name: Unified Safety Black Box (P2)
description: Append-only hash-chained audit consumindo P0 trio (planHash + oath + pyro policy) com veredito único para real_operation e pyro dispatch
type: feature
---
`safetyBlackBox.ts` em `src/core/safety/` — ring buffer 500, persistido em `localStorage` (`fxk.safety.blackbox.v1`), cadeia SHA-256 via `hashCanonical()` (mesmo helper do showPlanHash; aceita fallback `fnv1a:` em test runners).

**Cadeia**: `entryHash = sha256(prevHash + '|' + canonicalJSON(envelope))`. Primeira entrada usa `prevHash='GENESIS'`. `verifyChain()` retorna `{ok, brokenAt}` — quebra se payload OU prevHash forem alterados.

**API pública (a única que UI deve usar)**:
- `evaluateRealOperationVerdict(opts)` — wrapper async de `requestRealOperation()` que registra granted/refused com grantId, grantSeed, grantAgeMs, oathReason, planHashes (expected/actual + flag `planHashIsCryptographic`).
- `evaluatePyroDispatchVerdict({available, mode, planHash?, cueId?})` — chama `verdictForPyroFire()` e registra mode/cueId/planHash/available/allowed/banned. Captura o ban contratual de BLE em real_operation.
- `recordSafetyNote(msg, data?)` — anotação livre do operador.
- `safetyBlackBox.getRecent(n)` / `verifyChain()` / `reset()`.

**Não muta**: workMode, SSM, FieldBus, CommandBus, MultiTransportLink. Orthogonal ao `blackBoxRecorder` (telemetria 10Hz durante show) — este registra apenas decisões de gate.

8/8 tests verde. Próximo passo de adoção: trocar `requestRealOperation` direto por `evaluateRealOperationVerdict` no Phase2TransitionPanel + chamar `evaluatePyroDispatchVerdict` no PyroExecutor antes do dispatch real.
