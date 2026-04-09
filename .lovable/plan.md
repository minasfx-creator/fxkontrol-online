

# Ciclo #59 — Sprint 6: Continuity Check System + Interlock Integration

## Inventário Existente

| Componente | Estado |
|---|---|
| `FireOneHardwareBridge.readContinuity(pin)` | Funcional — envia `CONT:pin` e lê `CONT:pin:ohms` |
| `FireOneModuleEmulator.readContinuity(pin)` / `readAllContinuity()` | Funcional — sim mode com resistências |
| `useFireOneModuleMode` hook | Expõe `readContinuity`/`readAllContinuity` |
| `SafetyStateMachine.conditions.continuityOk` | Existe como booleano — usado como precondição para FIRE |
| `SafetyStateMachine.conditions.validationPassed` | Precondição para ARM |
| `VirtualIFMx32QPanel` | Tem botão CONT que chama `readAllContinuity` |
| `MobileLinkMode` | Tab "Continuity" com grade 8×4 e polling simulado |

## O que FALTA

1. **ContinuityCheckService** — subsistema kernel que orquestra verificação de todos os módulos, agrega resultados, e atualiza `safetyStateMachine.conditions.continuityOk`
2. **Integração no interlock chain** — ARM requer continuity report passado; FIRE requer continuity OK nos pinos-alvo
3. **UI no ShowCommanderPanel** — indicador de continuity status + botão "Run Check" que dispara verificação antes do ARM

## Deliverables

### 1. ContinuityCheckService — `src/core/safety/ContinuityCheckService.ts`

Serviço puro (sem React) que:
- Mantém mapa de `pin → { ohms, ok, lastChecked }` para 32 canais
- `runFullCheck(bridge?)` — lê todos os 32 pinos via hardware bridge ou emulador
- `runPinCheck(pin, bridge?)` — lê pino individual
- `getReport()` → `{ total, ok, open, short, lastCheckTime }`
- `isPassingForArm()` — true se ≥1 igniter OK e zero short-circuits
- `isPassingForFire(pin)` — true se pino específico está OK
- Atualiza `safetyStateMachine.setConditions({ continuityOk })` automaticamente após cada check
- Logs ao `safetyAuditTrail` com evento `CONTINUITY_CHECK`

Thresholds padrão (baseados em especificação FireOne):
- OPEN: > 200Ω (sem igniter)
- OK: 0.5Ω–50Ω (igniter conectado)
- SHORT: < 0.5Ω (curto-circuito — perigoso)

### 2. SafetyAuditTrail — adicionar evento `CONTINUITY_CHECK`

Adicionar `'CONTINUITY_CHECK'` ao tipo de evento no `SafetyAuditTrail`.

### 3. SafetyStateMachine — refinar precondição ARM

Atualizar `_checkPreconditions` para ARM:
- Além de `linkStable` e `validationPassed`, exigir que `continuityOk === true`
- Mensagem: `'Cannot ARM: continuity check not passed (run check first)'`

### 4. ContinuityCheckPanel — UI no ShowCommanderPanel

Componente inline que mostra:
- Grid compacto 8×4 com status de cada pino (verde OK, cinza OPEN, vermelho SHORT)
- Contadores: `12/32 OK · 18 OPEN · 2 SHORT`
- Botão "▶ RUN CHECK" que executa `continuityCheckService.runFullCheck()`
- Badge que reflete se check passa para ARM
- Auto-refresh a cada 30s quando em estado LOCKED (pré-ARM)

### 5. Integração EngineProvider

- Importar `continuityCheckService`
- Registrar handler para novo command type `CONTINUITY_CHECK` que executa `runFullCheck`
- Após check, se resultado passa, `setConditions({ continuityOk: true })`

### 6. CommandBus — novo tipo

Adicionar: `| { type: 'CONTINUITY_CHECK' }`

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/core/safety/ContinuityCheckService.ts` |
| Editar | `src/core/safety/SafetyAuditTrail.ts` (adicionar evento CONTINUITY_CHECK) |
| Editar | `src/core/safety/SafetyStateMachine.ts` (refinar precondição ARM) |
| Editar | `src/core/safety/index.ts` (export ContinuityCheckService) |
| Editar | `src/core/command/CommandBus.ts` (adicionar CONTINUITY_CHECK type) |
| Editar | `src/orchestration/EngineProvider.tsx` (handler + integration) |
| Editar | `src/components/editor/ShowCommanderPanel.tsx` (ContinuityCheckPanel inline) |

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Criar ContinuityCheckService |
| 2 | Adicionar CONTINUITY_CHECK ao CommandBus e AuditTrail |
| 3 | Refinar precondição ARM no SafetyStateMachine |
| 4 | Integrar no EngineProvider |
| 5 | Adicionar ContinuityCheckPanel no ShowCommanderPanel |
| 6 | Build verification |

