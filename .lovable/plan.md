## Rodada 14 — Continuity Matrix 4×8 + Field Diagnostics

Objetivo: substituir o `ContinuityMatrix` atual (32 chips genéricos sem ligação real ao hardware) por uma **matriz 4×8 honesta** acoplada ao FXK16 + MuxReader, com painel **Field Diagnostics** ao lado da `GlobalSafetyBar` mostrando heartbeat por módulo, RSSI/BAT/firmware e provenance — sem violar nenhum interlock.

### Estado atual (auditado)

- `src/components/editor/ContinuityMatrix.tsx` — grid 8×4 chato, lê só `continuityCheckService.getAllPins()`. Sem polling, sem provenance, sem origem de leitura visível, sem dock por módulo.
- `src/core/safety/ContinuityCheckService.ts` — kernel já existe (TOTAL_PINS=32, classify, isPassingForArm). Aceita `ContinuityReader` opcional, mas **nenhum reader real é injetado** hoje.
- `src/core/hardware/adapters/MuxReaderAdapterCD4051.ts` — adapter read-only honesto (16 ch dual-MUX) com provenance, getAllChannels, pollTelemetry. Não está conectado ao service.
- `src/hooks/useSystemReadiness.ts` + `GlobalSafetyBar` — Rodada 13. Já agregam `deviceAggregator` por provenance.
- `src/components/safety/ProvenanceBadge.tsx` — Rodada 12. Reusável.

Conclusão: temos as peças, falta **costurá-las** numa superfície de campo coerente.

### Entregáveis

**1. ContinuityReader real — `MuxContinuityReader`** *(novo)*
`src/core/safety/MuxContinuityReader.ts`
- Implementa `ContinuityReader` lendo `MuxReaderAdapterCD4051.getAllChannels()` (mapeia `resistance_ohms`).
- Para canais 16–31, fallback honesto: `Infinity` (sem reader → UNKNOWN).
- Função `resolveContinuityReader()` que tenta MuxReader real do `deviceAggregator`; se ausente → `null` (service cai em UNKNOWN, nunca inventa).

**2. ContinuityMatrix v2 — 4×8 honesto** *(refatora)*
`src/components/editor/ContinuityMatrix.tsx`
- Layout 4 linhas × 8 colunas com **rótulo de origem por linha** (FXK16 #1/#2/#3/#4 ou "—") via `controllerRegistry`.
- Cada célula mostra: `CH##`, status (OK/OPEN/SHORT/UNKNOWN com tokens `ds-status-*`), Ω.
- Header passa a usar `<ProvenanceBadge>` derivado do MuxReader (`live_read_only` / `simulated` / `not_integrated`).
- Botão `RUN CHECK` injeta `MuxContinuityReader` quando disponível; quando não, dispara check honesto que retorna 32× UNKNOWN com tooltip "no hardware reader".
- Subscribe leve via `setInterval` 1s só enquanto montado (limpo em unmount, padrão `useInterval`).
- Banner inferior: "ARM READY" só quando `isPassingForArm()` E provenance ≠ `simulated` (em real_operation). Em design/simulation: badge "SIM · ADVISORY".

**3. FieldDiagnosticsDock** *(novo)*
`src/components/safety/FieldDiagnosticsDock.tsx`
- Painel sticky abaixo da `GlobalSafetyBar` (toggle via chevron, default colapsado).
- Lista um row por **PhysicalDevice** ativo do `deviceAggregator`: kind, label, transports[] com OK/Timeout/last-latency, RSSI (se BLE), BAT (se BatteryMonitor), FW (se conhecido), heartbeat age ("3s ago"), `<ProvenanceBadge>`.
- 100% read-only. Zero botão de comando. Zero chamada a `uiCommandGateway`/`fieldBus`/`safetyStateMachine.transition()`.
- Mount em `MainLayout` ao lado da SafetyBar; mesmas exclusões de path (`/command`, `/pairing/*`).

**4. Hook canônico — `useContinuityMatrix()`** *(novo)*
`src/hooks/useContinuityMatrix.ts`
- Encapsula `getAllPins()`, `getReport()`, `isPassingForArm()`, polling 1s, e expõe `provenance` derivada do MuxReader.
- Retorna `{ pins, report, provenance, runCheck, checking }`.
- Único consumidor inicial: ContinuityMatrix. Pronto para reuso em Field Test e Live Firing.

**5. Testes** *(novos)*
- `src/__tests__/muxContinuityReader.honesty.spec.ts` (5): sem MUX → null reader → 32 UNKNOWN; com MUX → ohms refletem `getAllChannels()`; ch 16–31 sempre `Infinity`; provenance respeitada; runFullCheck idempotente.
- `src/__tests__/continuityMatrix.render.spec.tsx` (4): renderiza 4×8 = 32 cells; provenance badge "NOT INTEGRATED" sem MUX; banner "ARM BLOCKED" quando 0 OK; layout 4 linhas com label FXK16 #N/—.
- `src/__tests__/fieldDiagnosticsDock.render.spec.tsx` (3): zero devices → empty honesto; 1 device com transports → renderiza chips; oculto em `/command`.

### Restrições de segurança (não-negociáveis)

- `FieldDiagnosticsDock` e `ContinuityMatrix` **read-only**. Nenhum import de `uiCommandGateway`, `commandBus`, `fieldBus`, `safetyStateMachine.transition`.
- `MuxContinuityReader` apenas lê; nunca arma, nunca dispara, nunca toca `workMode`.
- `runCheck` continua passando por `continuityCheckService.runFullCheck()` (kernel já atualiza `safetyStateMachine.setConditions` — caminho consolidado, não muda).
- Em `design`/`simulation`, banner é **advisory** (não bloqueia); em `real_operation`, exige provenance `live_read_only` para mostrar "ARM READY".

### Arquivos tocados

```text
+ src/core/safety/MuxContinuityReader.ts
+ src/hooks/useContinuityMatrix.ts
+ src/components/safety/FieldDiagnosticsDock.tsx
~ src/components/editor/ContinuityMatrix.tsx
~ src/layouts/MainLayout.tsx          (mount FieldDiagnosticsDock)
+ src/__tests__/muxContinuityReader.honesty.spec.ts
+ src/__tests__/continuityMatrix.render.spec.tsx
+ src/__tests__/fieldDiagnosticsDock.render.spec.tsx
~ mem://index.md + mem://funcionalidades/continuity-matrix-v2-field-diagnostics
```

### Critérios de aceite

- `rg -n "ContinuityReader" src/core/safety/` mostra MuxContinuityReader além do service.
- ContinuityMatrix renderiza 4×8 com label de origem por linha e ProvenanceBadge.
- FieldDiagnosticsDock visível em `/editor` e `/skycanvas`, oculto em `/command` e `/pairing/*`.
- Sem MUX conectado, todas células = `UNKNOWN` (zero dados sintéticos).
- 12 novos testes verde, suite total ≥ atual.
- Zero novo import de `uiCommandGateway`/`commandBus`/`fieldBus`/`safetyStateMachine.transition` nos arquivos novos/refatorados (guard via `rg`).
