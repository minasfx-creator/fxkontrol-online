## Rodada 15 — §2.3 Erradicar Mocks dos Consoles

**Objetivo**: substituir os 4 consoles que hoje exibem dados estáticos/simulados por wiring real ao `ShowPlan` canônico + `deviceAggregator`, sem violar a cadeia de safety (zero `uiCommandGateway`/`fieldBus`/`SafetyStateMachine.transition`).

### Frentes

1. **Hook canônico `useShowPlanProjection`**
   - Deriva `ShowPlan` (pyroCues, droneCues, modules, art-net universes) a partir de `useProjectStore` via memo estável.
   - Fonte única para todos os consoles desta rodada — elimina drift entre UI e ShowPlan.

2. **`FireOneExportConsole` (real)**
   - Remove fixtures `MOCK_FIRE_CUES`.
   - Consome projeção e gera preview `.fir` reaproveitando `goldenShowExport.ts`.
   - `<ProvenanceBadge>`: SIMULATED se sem FXK16 online, LIVE-RO quando módulo aparece em `deviceAggregator`.

3. **`DMXArtNetConsole` (real)**
   - Universos derivados de `ShowPlan.modules` + ArtPoll entries do aggregator.
   - Tabela 512ch × N universos com colunas "ShowPlan" vs "Live (read-only)".
   - Sem broadcast (zero send). Reaproveita `dmxTimingHarness` só para exibir budget atual.

4. **`CueConflictsConsole` (novo)**
   - Wrapper read-only do `verificationEngine.run()` filtrado por severidade `error|warn`, agrupado por `cueId`.
   - Rota `/dev/cue-conflicts`.
   - Slot opcional na `GlobalSafetyBar` exibindo contador quando `errors > 0` (não bloqueia).

5. **`AddressingPanel` reativado**
   - Rota `/dev/addressing` lendo `ArtNetUniverseEntry[]` da projeção.
   - Mostra start_address + fixture_type quando os campos existirem (gracioso se ausentes — depende da §2.4 futura).

### Guard test

- `mocksErradicated.guard.spec.ts`: ripgrep proíbe identificadores `MOCK_`/`FAKE_`/`SIMULATED_DATA`/`STATIC_FIXTURE` nos 4 arquivos de console.

### Testes funcionais

- `useShowPlanProjection.spec.ts` — estabilidade de referência + recomputação on cue change.
- `fireOneExportConsole.honesty.spec.tsx` — provenance correto sem device, com device.
- `dmxArtNetConsole.honesty.spec.tsx` — universos espelham `ShowPlan.modules`.
- `cueConflictsConsole.spec.tsx` — agrupamento por cueId, contador na bar.

### Não-objetivos (rodadas seguintes)

- §2.1 Auto-invocar `fromProjectStore()` no ciclo de vida (Rodada 16 candidata).
- §2.2 Bloquear writes diretos VVIZ/CSV no ProjectStore (Rodada 17 candidata).
- §2.4 Expandir tipos `SafetyInterlockState`/`IgnitionChannel.relay_state`/etc.

### Invariantes preservados

- Zero import de `uiCommandGateway`, `fieldBus`, `safetyStateMachine.transition` nos novos componentes.
- Cadeia E-STOP <50ms intocada.
- WorkMode/SSM inalterados.
- DS tokens canônicos (Vantablack + cyan-dessat + ds-status-*).

### Entregáveis

```text
src/
  hooks/useShowPlanProjection.ts                  (novo)
  components/editor/FireOneExportConsole.tsx      (refactor)
  components/editor/DMXArtNetConsole.tsx          (refactor)
  components/editor/AddressingPanel.tsx           (refactor + montar rota)
  components/safety/CueConflictsConsole.tsx       (novo)
  pages/dev/CueConflicts.tsx                      (novo)
  pages/dev/Addressing.tsx                        (novo)
  __tests__/
    useShowPlanProjection.spec.ts
    fireOneExportConsole.honesty.spec.tsx
    dmxArtNetConsole.honesty.spec.tsx
    cueConflictsConsole.spec.tsx
    mocksErradicated.guard.spec.ts
src/App.tsx                                       (+2 rotas /dev)
mem://index.md                                    (+1 entrada Rodada 15)
```

Suite alvo: 1263 → ~1273 testes verdes.
