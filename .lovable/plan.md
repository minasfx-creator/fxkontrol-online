

# FX KONTROL — Refatoração Arquitectural Completa

## Diagnóstico do Estado Atual

O projecto tem infraestrutura core robusta mas com lacunas operacionais críticas entre o que está implementado e o que é requerido para um sistema de comando real.

### O que JÁ existe e funciona:
- **ShowPlan** canónico com PyroCue, DMXCue, DronePath, SafetyConstraints, HardwareConfig, ExportProfiles
- **ShowPlanManager** com fromProjectStore(), validate(), fromJSON()
- **VerificationPass** agregando ShowPlan + Safety + Continuity + Hardware → binário READY/BLOCKED
- **SafetyStateMachine** com cadeia IDLE→LOCKED→ARMED→FIRING→COOLDOWN, E_STOP, interlocks
- **Hardware drivers**: MuxReader (CD4051), ShiftRegisterDriver (74HC595), RelayBankController, PowerMonitor, ManualModeState
- **Protocols**: ArtNetBridge, DMXUniverseManager, FixtureAddressing, LinkFailoverPolicy
- **Execution**: executionBridge, pyroExecutor, droneExecutor
- **CommandCenter** com 17 modos em 4 secções (Execution, Monitoring, Safety, Hardware)
- **6 consoles command-grade**: SystemOverview, Safety, FieldDiagnostics, FireOneExport, DMXArtNet, AuditBlackBox
- **StatusChips + SidebarStatusWidget** globais em todos os consoles

### Gaps reais identificados:

| Gap | Severidade | Detalhe |
|-----|-----------|---------|
| ShowPlan não sincroniza com useProjectStore | CRÍTICO | `fromProjectStore()` existe mas nunca é chamado automaticamente |
| Importadores .vviz/.fin/.csv não normalizam para ShowPlan | CRÍTICO | VVIZImporter e CSVImporter existem como UI mas não alimentam ShowPlan |
| Export FireOne não sai do ShowPlan | ALTO | FireOneExportConsole mostra dados simulados, não cues reais |
| Sem página dedicada de Timeline & Cue Validation | MÉDIO | Validação existe no core mas sem console dedicado |
| Sem página Addressing & Protocols | MÉDIO | AddressingPanel existe mas não integrado no CommandCenter |
| Sem página Execution Status | MÉDIO | ExecutionBridge tem stats mas sem visualização dedicada |
| BP_SwarmManager não existe como contrato formal | ALTO | DroneChoreography/FormationBuilder existem mas sem interface operacional |
| VerificationPass não valida assets Unreal | BAIXO | Contexto web — irrelevante para o Lovable |
| import json.py lógica simplista | N/A | Script externo ao Lovable |

---

## Plano de Implementação — 5 Fases

### Fase 1: ShowPlan como Fonte de Verdade Viva (CRÍTICA)

**Problema**: ShowPlanManager.fromProjectStore() existe mas nunca é invocado automaticamente.

**Ação**:
- Criar hook `useShowPlan()` que subscreve `useProjectStore` com selector granular e chama `showPlanManager.fromProjectStore()` a cada mudança relevante (timeline, positions, trajectories)
- Montar este hook no `EngineProvider` (já envolve toda a app)
- Garantir que todos os consoles consomem `showPlanManager.current` em vez de construir dados próprios

**Ficheiros**:
- Criar: `src/hooks/useShowPlanSync.ts`
- Modificar: `src/orchestration/EngineProvider.tsx` (montar hook)

### Fase 2: Pipeline de Importação → ShowPlan

**Problema**: Importadores existem (VVIZImporter, CSVImporter) mas despejam dados no ProjectStore sem passar pelo ShowPlan.

**Ação**:
- Criar `src/core/showplan/importers/VVIZToShowPlan.ts` — converte .vviz parsed data → ShowPlan drone paths
- Criar `src/core/showplan/importers/FinaleCSVToShowPlan.ts` — converte Finale CSV → PyroCues + DMXCues
- Criar `src/core/showplan/importers/GenericCSVToShowPlan.ts` — normaliza CSV genérico → ShowPlan
- Cada importador valida e chama `showPlanManager.load()`
- Integrar nos dialogs de importação existentes (VVIZImporter.tsx, CSVImporter.tsx)

**Ficheiros**:
- Criar: `src/core/showplan/importers/VVIZToShowPlan.ts`
- Criar: `src/core/showplan/importers/FinaleCSVToShowPlan.ts`
- Criar: `src/core/showplan/importers/GenericCSVToShowPlan.ts`
- Modificar: `src/components/editor/VVIZImporter.tsx`
- Modificar: `src/components/editor/CSVImporter.tsx`

### Fase 3: Export Pipeline saindo do ShowPlan

**Problema**: FireOneExportConsole e DMXArtNetConsole mostram dados simulados.

**Ação**:
- Criar `src/core/export/FireOneExporter.ts` — gera .fir script a partir de `showPlanManager.current.pyroCues`
- Criar `src/core/export/ArtNetPatchExporter.ts` — gera patch list de `showPlanManager.current.dmxCues`
- Criar `src/core/export/DroneCSVExporter.ts` — gera drone CSV de `showPlanManager.current.dronePaths`
- Refatorar FireOneExportConsole para consumir dados reais do ShowPlan
- Refatorar DMXArtNetConsole para consumir universes reais

**Ficheiros**:
- Criar: `src/core/export/FireOneExporter.ts`
- Criar: `src/core/export/ArtNetPatchExporter.ts`
- Criar: `src/core/export/DroneCSVExporter.ts`
- Modificar: `src/components/editor/FireOneExportConsole.tsx`
- Modificar: `src/components/editor/DMXArtNetConsole.tsx`

### Fase 4: Consoles em Falta no CommandCenter

**Novos consoles a criar**:

| Console | Modo | Domínio | Descrição |
|---------|------|---------|-----------|
| `CueValidationConsole.tsx` | `cue_validation` | MONITORING | Timeline conflicts, channel collisions, timing gaps — visual drill-down |
| `AddressingConsole.tsx` | `addressing` | MONITORING | Universe/fixture/channel mapping, protocol setup |
| `ExecutionStatusConsole.tsx` | `execution_status` | EXECUTION | Real-time bridge stats, cue queue, last fired, executor states |
| `ShowPlanInspector` (já existe) | (já listado) | — | Precisa ser refatorado para consumir ShowPlan real |

**Ação**:
- Criar 3 novos componentes
- Adicionar 3 novos modos ao CommandCenter (type + accent + section + render)
- Refatorar ShowPlanInspector para ler `showPlanManager.current` em vez de dados mock

**Ficheiros**:
- Criar: `src/components/editor/CueValidationConsole.tsx`
- Criar: `src/components/editor/AddressingConsole.tsx`
- Criar: `src/components/editor/ExecutionStatusConsole.tsx`
- Modificar: `src/components/editor/ShowPlanInspector.tsx`
- Modificar: `src/pages/CommandCenter.tsx`

### Fase 5: Diagrama Mermaid Actualizado + Gap Analysis

**Ação**:
- Gerar `/mnt/documents/FXK_Architecture_v4.mmd` com todos os módulos reais mapeados, incluindo as novas conexões Import→ShowPlan→Export
- Gerar `/mnt/documents/FXK_Gap_Analysis.md` no formato: manual → requisito → estado actual → acção correctiva → evidência de teste

---

## Tipos/Interfaces — Estado vs Requerido

| Interface | Requerida | Existe | Local | Acção |
|-----------|-----------|--------|-------|-------|
| IgnitionChannel | ✅ | ✅ | `domainTypes.ts` | Alinhar campos (adicionar `relay_state`) |
| ContinuitySample | ✅ | ✅ | `domainTypes.ts` | Adicionar `source_mux` |
| PowerState | ✅ | ✅ | `domainTypes.ts` | Separar `logic_voltage` / `field_voltage` |
| SafetyInterlockState | ✅ | ✅ | `domainTypes.ts` | Adicionar `estop`, `arm_key`, `manual_mode`, `software_enable` |
| ArtNetUniverseMap | ✅ | ✅ | `domainTypes.ts` | Adicionar `start_address`, `fixture_type` |
| FireOneCue | ✅ | ✅ | `domainTypes.ts` | OK — já alinhado |
| ShowPlan | ✅ | ✅ | `ShowPlan.ts` | OK — completo |

**Acção**: Refatorar `domainTypes.ts` para alinhar campos em falta com o spec do utilizador.

---

## Fluxo Operacional Validado

```text
UI ──→ ShowPlan ──→ CommandBus ──→ SafetyStateMachine ──→ ExecutionBridge ──→ FieldBus ──→ PyroExecutor/DroneExecutor
                                         │
                                    E_STOP ──→ SAFE (terminal)
                                         │
                                    RESET ──→ IDLE
```

Este fluxo já está implementado no core. A Fase 1 garante que o ShowPlan está sempre sincronizado. A Fase 4 (ExecutionStatusConsole) torna-o visível.

---

## Casos de Teste — Mapeamento

| Caso de Teste | Módulo | Implementação |
|---------------|--------|---------------|
| Importar .vviz sem perda de trajetória | VVIZToShowPlan | Fase 2 |
| Exportar show combinado FireOne com mapeamento correcto | FireOneExporter | Fase 3 |
| Simular perda de continuidade → bloquear armamento | SafetyStateMachine + ContinuityCheck | JÁ EXISTE |
| Simular perda Art-Net → fallback | LinkFailoverPolicy | JÁ EXISTE |
| EmergencyLand/abort → propagar para UI/log | DroneExecutor + BlackBox | JÁ EXISTE |
| Validar modos preview/test/armed/live | VerificationPass levels | JÁ EXISTE |
| Bloquear comando quando estop/manual_mode/software_enable=false | SafetyValidator + CommandBus | JÁ EXISTE |

---

## Resumo de Entregas por Fase

| Fase | Ficheiros Novos | Ficheiros Modificados | Impacto |
|------|----------------|----------------------|---------|
| 1 | 1 | 1 | ShowPlan vivo |
| 2 | 3 | 2 | Import pipeline |
| 3 | 3 | 2 | Export pipeline |
| 4 | 3 | 2 | Consoles completos |
| 5 | 2 (artefactos) | 1 (domainTypes) | Documentação + alinhamento de tipos |

**Total**: 12 ficheiros novos, 8 modificações, 2 artefactos documentais.

