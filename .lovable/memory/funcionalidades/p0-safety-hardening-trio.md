---
name: P0 Safety Hardening Trio
description: Plan Integrity Hash + Pyro Transport Policy + Production Safety Oath — 3 hard gates antes de real_operation
type: feature
---
3 módulos puros, sem singletons, integrados via `requestRealOperation()`:

1. **showPlanHash.ts** (`src/core/showplan/`) — `canonicalizeShowPlan()` (stable JSON, ignora updatedAt/author/notes) + `hashShowPlan()` SHA-256 via WebCrypto (fallback `fnv1a:` prefixado para test runners). `isCryptographicHash()` permite refusar fallback em prod.

2. **productionSafetyOath.ts** (`src/core/safety/`) — `evaluateProductionOath({envMode, quarantineActive})`: refuse `production` + `quarantineActive=true`. `detectProductionOathInputs()` lê `import.meta.env.MODE` + `globalThis.__FXK_SAFETY_QUARANTINE__`. Independente da quarentena (não pode ser silenciado pelos shims).

3. **pyroTransportPolicy.ts** (`src/core/transport/`) — `PYRO_FIRE_PRIORITY = [webserial, webusb, mdns-artnet]` (BLE ausente por contrato). `bannedFor('pyro-fire'|'pyro-arm', 'real_operation')` retorna `['webble']`. `verdictForPyroFire()` retorna estrutura {ok, reason, selection} para call sites.

**Integração** em `realOperationRequest.ts`:
- Production Oath roda PRIMEIRO (refuse antes de tudo)
- `Phase2AuditEntry.planHash?` opcional carimbado em `recordPhase2Transition(result, {planHash})`
- `requestRealOperation({currentPlanHash})` compara hash, refusa com `plan-hash-mismatch` quando AMBOS presentes (retrocompat: legacy grants sem hash são aceitos)
- 4 reasons: phase2-not-recently-authorised | phase2-grant-stale | production-oath-failed | plan-hash-mismatch

**Não muta**: workMode contract, command path, MultiTransportLink, SSM, FieldBus. Pyro policy ainda NÃO é aplicada em dispatch — fica como contrato pronto para o call site (`MultiTransportLink` consumer) adotar.

28/28 tests verde. Ordem de adoção futura: aplicar `verdictForPyroFire` no PyroExecutor + carimbar `planHash` no Phase2TransitionPanel.
