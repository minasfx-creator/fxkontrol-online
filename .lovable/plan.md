

# FX KONTROL — Alinhamento Arquitetural com Hardware Real

## Diagnóstico

O projeto tem infraestrutura sólida mas dispersa. As lacunas críticas entre o código e a arquitetura operacional real:

| Bloco Requerido | Estado Atual |
|---|---|
| **ShowPlan** (fonte de verdade) | Inexistente. `useProjectStore` (445 linhas) é um monolito Zustand com dados misturados |
| **VerificationPass** | Inexistente. Sem status binário READY_FOR_FIELD/SIMULATION/EXPORT |
| **Hardware Layer** (74HC595, CD4051, RelayBank) | Inexistente. `ContinuityCheckService` simula 32 pinos mas sem drivers reais |
| **ArtNetBridge / DMXUniverseManager** | Inexistente no core. DMX só existe como componentes UI (`dmx/`) |
| **ShowPlan → CommandBus → Safety → Execution** | Parcial. ExecutionBridge existe mas não consome um ShowPlan canônico |
| **FireOne Export Console** | `exportEngine.ts` (66 linhas) exporta CSV genérico, não .fir nativo |

## Plano de Implementação — 5 Fases

### Fase 1 — ShowPlan Core (Fonte de Verdade)

**Criar `src/core/showplan/ShowPlan.ts`**

Interface canônica que concentra TODOS os dados do show:
- `metadata` (nome, local, GPS, duração, versão)
- `timeline_events` (todos os cues tipados)
- `pyro_cues` (posição, módulo, canal, efeito, fuse delay)
- `drone_paths` (waypoints, formações)
- `dmx_cues` (universo, canal, valor, curva)
- `safety_constraints` (geofence, exclusion zones, NFPA limits)
- `export_profiles` (FireOne, Finale CSV, Art-Net)
- `hardware_config` (módulos, canais, endereçamento)

**Criar `src/core/showplan/ShowPlanManager.ts`**
- `fromProjectStore()` — converte estado Zustand actual para ShowPlan
- `toProjectStore()` — aplica ShowPlan de volta
- `fromVVIZ()`, `fromFinaleCSV()`, `fromJSON()` — importadores
- `validate()` — retorna `VerificationResult`

### Fase 2 — VerificationPass (Status Binário)

**Criar `src/core/verification/VerificationPass.ts`**

Status: `READY_FOR_SIMULATION` | `READY_FOR_EXPORT` | `READY_FOR_FIELD` | `BLOCKED`

Checks:
1. Integridade do ShowPlan (cues sem posição, posições sem efeito)
2. Conflitos de tempo/canal (via `collisionSystem` do timelineECS)
3. Limites de módulo (>32 canais por módulo = BLOCKED)
4. Continuity check (via ContinuityCheckService)
5. Safety interlock (SafetyStateMachine state)
6. Link DMX/Art-Net (NetworkHealth)
7. Geofence violations
8. Audit trail completeness

**Criar `src/core/verification/useVerificationStore.ts`** — Zustand store com resultado em tempo real

### Fase 3 — Hardware Layer Explícita

**Criar `src/core/hardware/`** com módulos que modelam o hardware real:

| Módulo | Responsabilidade |
|---|---|
| `ShiftRegisterDriver.ts` | Interface para 74HC595 — expander de 8→32 saídas |
| `MuxReader.ts` | Interface para CD4051 — leitura multiplexada analógica |
| `RelayBankController.ts` | Controlo dos 32 relés (arm, fire, status) |
| `PowerMonitor.ts` | Monitoramento bateria 12V (tensão, corrente, SOC) |
| `ManualModeState.ts` | Estado do modo manual (key switch, deadman) |
| `HardwareRegistry.ts` | Registo central de dispositivos conectados |

Cada módulo expõe interface abstrata consumida pelo `FieldBus` e `ExecutionBridge`. Implementações concretas: WebSerial (real) ou Emulator (simulação).

### Fase 4 — DMX/Art-Net Bridge Real

**Criar `src/core/protocols/`**:

| Módulo | Responsabilidade |
|---|---|
| `ArtNetBridge.ts` | Ponte Art-Net 4 via WebSocket (send/receive ArtDmx, ArtPoll) |
| `DMXUniverseManager.ts` | Gestão de universos (merge, priority, HTP/LTP) |
| `FixtureAddressing.ts` | Endereçamento de fixtures separado do layout visual |
| `LinkFailoverPolicy.ts` | Failover Art-Net → sACN → serial |

Separação clara: `dmx/` UI components para editor visual; `core/protocols/` para lógica operacional.

### Fase 5 — UI Alinhada (Command-Grade)

**Páginas/Consoles novos ou refatorados:**

| Console | Descrição |
|---|---|
| **System Overview** | Dashboard binário: ShowPlan loaded, Verification status, Hardware link, Safety state |
| **ShowPlan Inspector** | Árvore navegável do ShowPlan com contadores por domínio |
| **Continuity Matrix** | Grid 32 canais visual (OK/OPEN/SHORT) com ohms em tempo real |
| **FireOne Export Console** | Exportação .fir com preview de script e validação pré-export |
| **Verification Console** | Lista de checks com PASS/FAIL/BLOCKED e drill-down |

**Consoles existentes a expandir no CommandCenter:**
- `pyro_fire` → integrar VerificationPass como gate visual (barra de status)
- `hardware` → integrar PowerMonitor e HardwareRegistry
- `dmx_monitor` → conectar a DMXUniverseManager real

**Ajustes visuais:**
- Cor por domínio consistente (ciano=sync, verde=ok, âmbar=warn, vermelho=interlock, violeta=drone)
- VerificationPass como barra horizontal no topo do editor com status binário
- Safety state visível em TODAS as views (não só no SafetyPanel)

## Ficheiros a Criar

```text
src/core/showplan/
  ShowPlan.ts              — Interfaces e tipos canónicos
  ShowPlanManager.ts       — Conversor, importador, validador

src/core/verification/
  VerificationPass.ts      — Motor de verificação com checks compostos
  useVerificationStore.ts  — Store reativo

src/core/hardware/
  ShiftRegisterDriver.ts   — 74HC595 interface
  MuxReader.ts             — CD4051 interface
  RelayBankController.ts   — 32-relay control
  PowerMonitor.ts          — Battery/power monitoring
  ManualModeState.ts       — Manual mode interlocks
  HardwareRegistry.ts      — Device registry

src/core/protocols/
  ArtNetBridge.ts          — Art-Net 4 bridge
  DMXUniverseManager.ts    — Universe management
  FixtureAddressing.ts     — Addressing logic (separated from UI)
  LinkFailoverPolicy.ts    — Protocol failover
```

## Ficheiros a Modificar

| Ficheiro | Mudança |
|---|---|
| `src/core/execution/executionBridge.ts` | Consumir ShowPlan em vez de array genérico de cues |
| `src/core/export/exportEngine.ts` | Adicionar `exportFireOneScript()` nativo |
| `src/core/engine/fxkEngine.ts` | Registar hardware e protocols no boot |
| `src/pages/CommandCenter.tsx` | Adicionar consoles: verification, continuity matrix |
| `src/pages/Index.tsx` | Barra de VerificationPass no topo do editor |

## Diagrama Mermaid Actualizado

Será gerado com os 6 domínios: Authoring/Control, Safety/Verification, Execution/Protocols, Simulation, Hardware Diagnostics, Persistence/Reliability.

## Prioridade

1. **ShowPlan + VerificationPass** (Fase 1-2) — maior impacto arquitectural
2. **Hardware Layer** (Fase 3) — alinha com protótipo Arduino real
3. **DMX/Art-Net Bridge** (Fase 4) — separa lógica de UI
4. **UI Command-Grade** (Fase 5) — visual alinhado com mission control

