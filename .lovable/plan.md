
# Remoção total dos sistemas de bloqueio — Modo Testes Aberto

## Estado atual

A quarentena anterior já neutralizou as 4 camadas principais (todas retornam permissivo):

- `safetyGate.isEnforced()` → sempre `false`
- `OperationalModeGuard.check()` → sempre `allowed: true` (porque depende do safetyGate)
- `useItemLocked()` → sempre `false`
- `LockoutPanel` → modo informativo
- `safetyGate.setShowState` → set direto, sem hard gate

## Bloqueios remanescentes encontrados

Apesar do shim, três pontos ainda podem barrar simulação/export por estado interno:

1. **`ExportCoordinator.execute()`** — passos 1 e 3 chamam `operationalModeGuard.check('export')` e `readinessEvaluator.evaluate()` e abortam com `success: false` se `allowed_operations` não inclui `'export'`. Como o ModeGuard agora é permissivo, o passo 1 já passa, mas o passo 3 ainda pode bloquear (depende de status de hardware real).
2. **`ReadinessEvaluator._isOperationAllowed`** — `'export'` exige status específico de hardware, e `'simulate'`/`'preview'` retornam `false` quando `status === 'BLOCKED'`. Sem hardware real conectado isto pode resultar em `BLOCKED` e impedir simulação.
3. **`SafetyGateSettings` em `Settings.tsx`** — UI ainda expõe toggles que chamam `setMaster/setLayer` (no-ops), causando confusão ao operador.

## Mudanças propostas

### 1. `src/core/export/ExportCoordinator.ts`
- Remover o early-return do passo 1 (mode guard) — manter `verificationEngine.run()` apenas como log/auditoria, não como gate.
- Remover o early-return do passo 3 (readiness) — registrar issues como `warnings[]` no resultado mas seguir com o export.
- Adicionar campo `warnings: string[]` em `ExportAttemptResult` para o operador continuar enxergando avisos sem ser bloqueado.

### 2. `src/core/hardware/ReadinessEvaluator.ts`
- Em `_isOperationAllowed()`: forçar `return true` para `'simulate'`, `'preview'`, `'export'`, `'validate'`, `'diagnostics'`, `'sync_read_only'`.
- Manter `evaluate()` calculando `status`, `issues`, `warnings` normalmente (telemetria continua honesta) — apenas a tradução para `allowed_operations` vira "tudo permitido".

### 3. `src/components/settings/SafetyGateSettings.tsx`
- Substituir o painel inteiro por um banner informativo: "🟡 Sistemas de bloqueio em quarentena para fase de testes. Restauração: `src/_quarantine/safety/`."
- Sem switches funcionais. Mantém a aba existindo para não quebrar navegação.

### 4. `src/components/editor/SafetySummaryBar.tsx` e `VerificationBar.tsx`
- Conferir e remover qualquer renderização de "BLOCKED"/"NOT READY" que use cor vermelha bloqueante. Trocar por etiquetas neutras (informativas) — a barra continua existindo, mas sem comunicar bloqueio operacional.

### 5. `src/utils/joiCommandExecutor.ts`
- O JOI consulta `readiness.blocked_operations` e `operationalModeGuard.mode` para responder ao operador. Manter a leitura, mas como `blocked_operations` ficará vazio após a mudança em (2), a saída naturalmente passa a ser "tudo permitido". Sem edição direta necessária.

## Arquivos preservados (quarentena, sem mudança)

- `src/_quarantine/safety/*.original.*` — fonte de verdade para reativação
- `src/core/safety/safetyGate.ts` (shim no-op) — mantido
- `src/core/hardware/OperationalModeGuard.ts` — já gateado por safetyGate; mantido
- `src/lib/uiLockHelper.ts` — já neutralizado; mantido

## Resultado esperado

- ✅ Toda simulação roda sem hard gate
- ✅ Todo export executa (gera arquivo) mesmo sem hardware conectado — issues viram warnings no resultado
- ✅ Telemetria, verificação, readiness continuam **calculando e exibindo** estado real (honestidade preservada) — apenas não bloqueiam mais
- ✅ Reativação para produção: restaurar `src/_quarantine/safety/safetyGate.original.ts` + reverter os 2 early-returns no ExportCoordinator + restaurar gates em ReadinessEvaluator (commit único reversível)

## Detalhes técnicos

```text
Antes:                              Depois:
ExportCoordinator.execute()         ExportCoordinator.execute()
 ├─ ModeGuard gate ──► block         ├─ ModeGuard.check()  ──► log only
 ├─ verification.run()               ├─ verification.run() ──► log only
 ├─ Readiness gate ──► block         ├─ readiness.evaluate() ──► warnings[]
 └─ exporter.run()                   └─ exporter.run()  ── always reached

ReadinessEvaluator._isOperationAllowed(op, status, issues)
  → switch(op): retorna SEMPRE true (fase de testes)
  → status/issues continuam visíveis na UI para diagnóstico
```

Memory `mem://funcionalidades/safety-gate-opt-in.md` será atualizada para registrar o estado "quarentena total" e o caminho de reativação.
