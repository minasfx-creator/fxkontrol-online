# Separar Modos: Design / Simulação / Operação Real

## Objetivo
Garantir liberdade total para criar, editar, simular e renderizar (incluindo IA, consoles, comandos internos), e restringir bloqueios de segurança **exclusivamente** ao caminho de Operação Real (armar/disparar/energizar hardware físico).

## Diagnóstico atual
A camada de segurança hoje mistura preocupações:

- `operationalModeGuard` (`src/core/hardware/OperationalModeGuard.ts`) bloqueia operações como `simulate`, `preview`, `export` por modo — isso afeta Design/Simulação indevidamente.
- `safetyGate` controla 4 camadas (`lockoutGroups`, `interlockChain`, `modeGuard`, `uiLocks`). Apenas as duas primeiras são realmente "físicas"; `modeGuard` e `uiLocks` impactam edição/preview.
- `SafetyValidator` (CommandBus) já gateia comandos de hardware (LOCK/ARM/FIRE/E_STOP) — esse é o ponto correto para Operação Real.
- `ExportCoordinator` chama `operationalModeGuard.check('export')` — export é design-time, não deve depender disso.
- `realOnlyGate` já isola telemetria real de simulada — boa fundação para "Real Operation Mode".

## Plano

### 1. Introduzir `WorkMode` canônico
Novo arquivo `src/core/safety/workMode.ts`:

```ts
export type WorkMode = 'design' | 'simulation' | 'real_operation';
```

Singleton `workMode` com `get()`, `set(mode)`, `subscribe(fn)`, persistido em `localStorage` (`fxk:work-mode:v1`). Default: `'design'`.

`real_operation` só pode ser ativado via confirmação humana explícita (modal Hold-to-Confirm) e exige operador autorizado (já existe via `useAdminRole` / blaster role).

### 2. Reescopo do `safetyGate`
Reduzir as 4 camadas a duas categorias:

- **Physical safety (sempre ON em `real_operation`)**: `lockoutGroups`, `interlockChain`. Não-bypassáveis em Operação Real, mesmo com toggle off.
- **Editorial helpers (informativos)**: `uiLocks`, `modeGuard` viram **avisos visuais**, nunca bloqueios em Design/Simulação.

Em Design/Simulation: `safetyGate.isEnforced(layer)` retorna `false` para qualquer camada (curto-circuito no topo do método).
Em Real Operation: physical layers retornam `true` independentemente do toggle de usuário.

### 3. Aposentar `operationalModeGuard` como bloqueador
`OperationalModeGuard.assertAllowed()` e `.check()` passam a:

- Em `design`/`simulation`: sempre `{ allowed: true }`.
- Em `real_operation`: aplicar regras atuais para operações **físicas** (`fire`, `arm`, `sync_real`, etc). Operações puramente de software (`simulate`, `preview`, `validate`, `diagnostics`, `export`) sempre permitidas.

Atualizar `AllowedOperation` para distinguir `software` vs `physical`.

### 4. Caminho de comando único para hardware real
`SafetyValidator` (já existente) continua sendo o **único gate** para comandos físicos. Validar contra:

1. `workMode.get() === 'real_operation'` — caso contrário, marcar comando como `simulated` e rotear para o simulador (não para FieldBus).
2. Operador autorizado (role check).
3. Interlock chain (LOCK→ARM→FIRE).
4. Lockout groups Hold-to-Confirm.

Comandos de IA (`joiCommandExecutor`) **nunca** podem emitir `ARM_SYSTEM`, `FIRE`, `E_STOP` bypass, nem alterar `workMode`. Adicionar allowlist em `joiCommandExecutor.ts` rejeitando esses tipos com erro auditado.

### 5. Limpeza de pontos contaminados
- `ExportCoordinator.execute()`: remover chamada `operationalModeGuard.check('export')`. Export é Design-time.
- `ExportReadinessPanel`, `HardwareOverview`, `SafetySummaryBar`: ler `workMode` em vez de `operationalModeGuard.mode` para decidir o que mostrar; manter avisos, remover bloqueios.
- `uiLockHelper.isItemLocked()`: retornar `false` fora de `real_operation`.
- `JoiContextBuilder`/`JOIResolverRegistry`/`JOIArtifactGenerator`: trocar referências a `operationalModeGuard.mode` por `workMode.get()`.

### 6. UI de Configurações
Renomear `SafetyGateSettings` → `OperationalLockoutSettings`:

- Card de topo "Sistema de bloqueio operacional" (afeta apenas Operação Real).
- Toggle master + sublabels deixando claro: "Não afeta criação, simulação ou render 3D".
- Badge do modo atual (Design / Simulação / Operação Real) com botão para alternar (Real exige Hold-to-Confirm + role).
- Em STRICT (`safety_gate_strict`), continuar travando os toggles físicos como hoje.

### 7. Testes guardiões
Adicionar `src/core/safety/__tests__/workMode.test.ts`:

- Em `design`/`simulation`: `safetyGate.isEnforced(*)` é `false`, `operationalModeGuard.check(*)` é `allowed`, `isItemLocked()` é `false`, `ExportCoordinator` roda sem mode-check.
- Em `real_operation`: physical layers ON mesmo com toggle off, `SafetyValidator` rejeita `FIRE` sem ARM, `joiCommandExecutor` rejeita `ARM_SYSTEM`.
- Transição design → real_operation requer confirmação (mock).
- IA não consegue mudar `workMode` nem emitir comandos físicos.

## Detalhes técnicos

Arquivos novos:
- `src/core/safety/workMode.ts`
- `src/core/safety/__tests__/workMode.test.ts`

Arquivos editados:
- `src/core/safety/safetyGate.ts` — curto-circuito por `workMode`.
- `src/core/hardware/OperationalModeGuard.ts` — vira no-op fora de `real_operation` para operações de software.
- `src/core/hardware/types.ts` — particionar `AllowedOperation` em `software` | `physical`.
- `src/core/safety/SafetyValidator.ts` — checar `workMode === 'real_operation'` antes de aplicar transição; caso contrário marcar simulado.
- `src/core/export/ExportCoordinator.ts` — remover gate de modo.
- `src/lib/uiLockHelper.ts` — `false` fora de Real.
- `src/utils/joiCommandExecutor.ts` — allowlist de comandos IA.
- `src/core/joi/JoiContextBuilder.ts`, `JOIResolverRegistry.ts`, `JOIArtifactGenerator.ts` — usar `workMode`.
- `src/components/settings/SafetyGateSettings.tsx` — reescrita para "Sistema de bloqueio operacional".
- `src/components/editor/{ExportReadinessPanel,HardwareOverview,SafetySummaryBar}.tsx` — informativos, não bloqueantes.

Memória a salvar:
- `mem://arquitetura/work-mode-design-simulation-real` — regra de 3 modos.
- Atualizar `mem://funcionalidades/safety-gate-opt-in` para apontar nova arquitetura.

## Resultado esperado
- Em Design/Simulação: nenhum bloqueio. IA, consoles, comandos de software, export, render 3D, edição, preview funcionam livremente.
- Em Operação Real: todos os intertravamentos físicos ativos, operador autorizado obrigatório, IA proibida de armar/disparar.
- Toggle "Sistema de bloqueio operacional" afeta apenas Operação Real; alertas continuam visíveis em todos os modos.
