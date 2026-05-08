---
name: LiveOps 3 Camadas (Studio/Compiler/LiveOps Core)
description: Arquitetura canônica derivada do deep-research LiveOps 2026-05; separação Studio→Compiler→LiveOps Core; CompiledShow assinado ECDSA-P256; commandJournal correlacionado
type: feature
---

Arquitetura canônica FXKONTROL LiveOps (deep-research 2026-05, `docs/strategy/liveops-deep-research-2026-05.md`):

**3 camadas rígidas**:
1. **Studio/Previs** (`/skycanvas`, `/dev/golden-shows`): desenho, IA, RA, simulação. SEM autoridade sobre hardware real.
2. **Compiler** (`src/core/compiler/CompiledShow.ts`): transforma ShowPlan em `CompiledShow` assinado (ECDSA P-256 SHA-256, kid persistido em localStorage `fxk.compiler.key.v1.<kid>`). Manifest inclui planHash SHA-256 (canonical, ignora updatedAt/author/notes), counts, duration, compilerVersion, compiledAt. `verifyCompiledShow(compiled, plan?)` retorna ok/reason (no-subtle/bad-signature/plan-hash-mismatch/plan-hash-not-cryptographic/manifest-corrupt). 4/4 tests.
3. **LiveOps Core**: `uiCommandGateway` → `CommandBus` → `SafetyStateMachine` → `FieldBus`. Já consolidado.

**Sprint B — Command Journal correlacionado** (`src/core/journal/commandJournal.ts`):
- `recordCommandRequested({type,source,detail,payload})` → retorna `commandId` UUID + grava entry `kind:'command.requested'` no `safetyBlackBox`.
- `recordCommandDispatched(commandId, 'ack'|'nack'|'timeout', reason?)` → grava `kind:'command.dispatched'` com `latencyMs` (performance.now diff).
- Wireado em `uiCommandGateway.audit()` como fire-and-forget (`void recordCommandRequested(...)`); NUNCA bloqueia caminho de comando.
- Ack/nack downstream é wiring opcional do adapter (ainda não implementado por adapter — futuro).
- Cadeia hash do blackBox preservada (3/3 tests).

**Roadmap pendente** (em `docs/strategy/liveops-deep-research-2026-05.md`):
- Sprint C: Cue Engine modos manual/semi-auto/mixed (paridade FireOne XLII+).
- Sprint D: FireOne Serial Adapter READ-ONLY (sem reverse engineering, apenas leitura documentada).
- Sprint E: quarentena por device com workflow de liberação.
- Sprint F: HIL bench 50 ciclos por caminho crítico.

**Decisões críticas**:
- Sem engenharia reversa de FireOne; apenas leitura documentada quando autorizada.
- Tuya banido de pyro_critical (já consolidado).
- Mobile mTLS depende de Capacitor nativo; adiado.
- `requestRealOperation` PODE passar a exigir `compiledShow.signature.verified===true` em iteração futura — hoje é opcional/aditivo.
