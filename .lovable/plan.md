
# FireOne XL4-3 — Integração Total (Plano v4 final)

Refinamento sobre v3 incorporando achados da última auditoria (`ExportCoordinator` real, `OperationalModeGuard` sem allowlist explícita, `joiCommandExecutor` usa array literal `['fireone',...]`, `MegafireExporter` independente).

---

## Decisões de design ratificadas

1. **Compatibilidade retroativa total**: `ExportTarget = 'fireone'` continua válido como **alias** que mapeia para `'fireone-csv'` (CSV é a rota oficial UltraFire — única que importa de verdade no XLII+ XL4-3). Nenhum chamador legado quebra.
2. **`.fir` como audit-log**: o atual `FireOneExporter.ts` é mantido **sem deletar**, apenas rebatizado (header marca "NOT for UltraFire import"). Vira anexo do ZIP, nunca arquivo solitário entregue ao operador.
3. **Painel XL4-3** ocupa nova **tab `FIREONE`** dentro de `/field-ops` (consistente com FXK16/Pairing/Field Test) — sem rota nova, sem fragmentação de UX.
4. **Toda escrita real** passa por `uiCommandGateway` (memória `ui-command-gateway-global-estop`); zero bypass para `fireoneProtocol.build*` na UI.
5. **Honest hardware**: nada de número sintético. Sem módulo IDENTIFY-replied → painel mostra "no live module" e adapter fica `simulated/logical` (memória `honest-hardware-layer`).

---

## Pacote A — Camada de Export (CSV oficial + audit + ZIP)

### A1. NEW `src/core/export/FireOneCsvExporter.ts`
Consome **`showPlanManager.current`** (não `useProjectStore`). Header oficial UltraFire:
```text
Launch Time,Event,Slat,Cue,Length,Description,Comment,Priority,Position,Quantity,Product Number,Vendor Number
```
Regras invioláveis:
- `Launch Time` = `HH:MM:SS.X` (1 casa decimal, bate com `.sem` MDB inspecionado).
- `Slat` = `cue.module + 1` (1–40). `Cue` = `cue.channel + 1` (1–32). Fora do range → erro.
- `Length` = `clamp(cue.fuseDelay || 50, 20, 1000)` ms.
- `Priority` = `cue.priorityGroup ?? 1` (nunca 0; UltraFire rejeita 0).
- `Event` = 1 (Auto) ou `cue.eventNumber` (Semi-Auto).
- Limite hard: `pyroCues.length ≤ FIREONE_MAX_FIRINGS (4000)`.
- `verificationEngine.run()` + `simulationGuard.shouldEnforce('export-blocked')` — em design/simulation vira **advisory** (memória `simulation-guard-defense-in-depth`).
- `safetyBlackBox.recordSafetyNote('fireone-csv-export', { planHash, cueCount, slats })` (memória `p2-unified-safety-blackbox`).

### A2. EDIT `src/core/export/FireOneExporter.ts`
- Header inicial muda para `; FX KONTROL audit log — NOT for UltraFire import. Use the .csv companion file (File ▸ Import ▸ CSV File).`
- `downloadFireOneScript(filename = '<show>_audit.txt')` (era `.fir`).
- Mantém colunas atuais (auditoria humana).

### A3. EDIT `src/core/export/exportEngine.ts`
- `exportFireOneScript()` deprecated → delega a `FireOneCsvExporter`.
- `eventBus.emit('SYSTEM.EXPORT', { format: 'fireone-csv' })`.

### A4. EDIT `src/features/viewport-tools/exporters/fireOneExporter.ts`
Stub deprecated — re-exporta canônico (não pode mais gerar a partir de `useProjectStore`, viola `showplan-canonical-source-truth`).

### A5. NEW `src/core/export/fireOneImportPackage.ts`
ZIP via `jszip` (já no bundle de `goldenShowExport`):
```text
<show>.csv                      ← UltraFire CSV Import (rota oficial)
<show>_positions.csv            ← Position ↔ Slat map (alimenta "By Position")
<show>_audit.txt                ← log humano (do A2)
_FXK_FIREONE_README.md          ← passo-a-passo File ▸ Import ▸ CSV File
_FXK_DISCLAIMER.txt             ← claim policy padrão
```
Função `downloadFireOneImportPackage()`.

### A6. EDIT `src/core/export/ExportCoordinator.ts`
```ts
export type ExportTarget =
  | 'fireone'         // alias retrocompat → 'fireone-csv'
  | 'fireone-csv'     // ZIP UltraFire (CSV+positions+audit+README+disclaimer)
  | 'fireone-audit'   // só audit.txt (anexo, raramente usado isolado)
  | 'artnet' | 'drone' | 'megafire'
  | 'rj-traditional' | 'rj-timecode' | 'galaxis-gs2';
```
- `_runExporter`: `case 'fireone' | 'fireone-csv'` chama `downloadFireOneImportPackage()`.
- `case 'fireone-audit'` chama `downloadFireOneScript()` legado.
- `cueCount` vem do `FireOneCsvExporter` (Slat válido, dentro de limites).

### A7. EDIT `src/components/editor/FireOneExportConsole.tsx`
Três botões em ordem:
1. **EXPORT CSV (UltraFire)** — primário, gera ZIP. Disabled se `cueCount === 0`.
2. **DOWNLOAD AUDIT.TXT** — secundário, log humano.
3. **PREVIEW** — mostra CSV (não `.fir`).
Badge `SIM · ADVISORY` em design/simulation, `BLOCKED` em real_operation se errors.

### A8. Sweep de consumidores
EDIT em paralelo (sem mudanças semânticas, só re-roteamento):
- `src/lib/firingSystemExports.ts` → CSV first.
- `src/lib/showSeeds/goldenShowExport.ts` → ZIP UltraFire substitui o `.fir` atual.
- `src/utils/joiCommandExecutor.ts` linha 581 → `const targets = ['fireone-csv', 'artnet', 'drone'] as const;`
- `src/core/joi/JOIResolverRegistry.ts`, `src/core/joi/JOIArtifactGenerator.ts` → trocam `'fireone'` literal por `'fireone-csv'`.
- `src/core/hardware/adapters/FireOneProfileAdapter.ts` → `protocols: ['fireone-csv','fireone-audit']`.

> **Não mexer**: `MegafireExporter.ts` (apenas comentário menciona FireOne; gerador independente).

---

## Pacote B — Discovery + Adapter promovido a live

### B1. EDIT `src/core/discovery/controllerRegistry.ts`
- Cache `deviceClassificationCache: Record<deviceId, ControllerKind>` (in-mem + `localStorage` `fxk.controller.classify.v1`, hidratado no boot).
- Exporta `markDeviceClassified(deviceId: string, kind: ControllerKind): void` — persiste em registry e em `portRegistry.addAlias(deviceId, 'fireone-xlii:<serial>')` quando aplicável (memória `identity-unification-portregistry`).
- `resolveControllerProfile`: consulta cache **antes** das `FAMILY_RULES` → resolve falso-positivo de FTDI/CH340/CP210x → `dmx-generic`.

### B2. EDIT `src/core/hardware/adapters/FireOneProfileAdapter.ts`
- `protocols: ['fireone-csv', 'fireone-audit']`.
- Subscreve `unifiedDiscovery.watch`: quando algum device tem `resolveControllerProfile().kind === 'fireone' && online` → `_provenance = createLiveReadOnlyProvenance('fireone-xlii')`, snapshot inclui `slatCount`, `wirelessConnected`, `lastIdentifyAt`. Volta a `simulated/logical` quando some. **Sem `canWrite:true`** (escrita fica no painel via gateway).

### B3. `AutoControllerLauncher` (memória `auto-controller-launcher`)
Já abre card automático para profile `fireone` — apenas garantir `consoleRoute: '/field-ops#fireone'` na entrada do registry.

---

## Pacote C — Painel Operação Real XL4-3

### C1. NEW `src/features/fieldbus/useFireOneFleet.ts` (hook)
- `connect()` reusa `SerialTransport` de `src/lib/fireoneTransport.ts` com `{ baudRate:9600, dataBits:8, stopBits:1, parity:'none', bufferSize:8192, flowControl:'none' }` — **zero duplicação** de `navigator.serial`.
- **IDENTIFY probe** (broadcast `0x49`) por 1.5 s na conexão. Cada resposta válida → `markDeviceClassified(deviceId, 'fireone')` + `portRegistry.addAlias`. Sem resposta → estado `no-modules-detected` (honest).
- Telemetria 2 Hz: `STATUS` por slat → `parseStatusPayload` (já existe). Map `Record<slatAddr, FireOneModuleStatus>`.
- **Continuity**: `buildContinuityCheck` por slat → grid 32 OK/OPEN/SHORT.
- **Wireless**: `buildWirelessStatusQuery` por slat com link wireless → RSSI dBm / canal RF / packet-loss / AES status.
- **UltraFire download**: particiona ShowPlan por slat → `buildDownloadModule` em chunks (limite payload do protocolo) → `buildVerifyUltraFire` final → mismatch → `aborted` + `safetyBlackBox.recordSafetyNote('ultrafire-verify-mismatch', { slat, expected, got })`.
- Cleanup determinístico (memória `gestao-recursos-memoria-v2`): timers em `useRef`, `clearInterval` no unmount.

### C2. NEW `src/features/fieldbus/FireOnePanel.tsx`
- Header: connect/disconnect, status do transport (latência, txOk/txErr — usa `LinkHealth` de `multi-transport-concurrent` se disponível).
- Cards por slat: bateria, temperatura, RSSI, 32 igniters (verde OK / vermelho OPEN / amarelo SHORT).
- Subseção **Radio Antenna**: RSSI dBm, canal RF, packet-loss, AES on/off, botão "Configure radio" (`buildWirelessConfigCommand` com canal/TX-power/AES key).
- Botão **Push show to modules** com progress bar (cobertura da pilha download+verify).
- Comandos críticos **somente via `uiCommandGateway`**:
  - `arm()` — Hold-1.2 s (real_operation) / single tap (sim/design). Dispara `requestRealOperation` → `productionSafetyOath` → Phase 2 grant ≤ 5 min (memórias `real-operation-request-gate` + `p0-safety-hardening-trio`).
  - `fire(cueId)` — Hold-1.2 s, carimba `evaluatePyroDispatchVerdict({ available:true, mode:'auto', planHash, cueId })`.
  - `eStop()` — single tap quando ARMED/FIRING (consistente com `GlobalEStopButton` global).
  - `continuityCheck()` — sem hold.
- BLE banido por `pyroTransportPolicy` em real_operation — UI mostra motivo se transport ativo for BLE.
- Em design/simulation: badge "SIM · ADVISORY", comandos viram dry-run via `simulationGuard.withSimBypass`.

### C3. EDIT `src/pages/FieldOps.tsx`
- Tab `FIREONE` (icon `Cable`) entre `FXK16` e `FIELD TEST`.
- Auto-revelada quando `isFireOneXL43RealOpsEnabled()` ON **ou** `useActiveControllers().some(c => c.kind === 'fireone')`.
- Hash deep-link `#fireone` para `AutoControllerLauncher`.

### C4. EDIT `src/lib/featureFlags.ts`
- `isFireOneXL43RealOpsEnabled()` (default OFF, override `localStorage.fxk.flag.fireone_xl43_realops`).
- Export CSV **NÃO** fica atrás de flag (sempre disponível — é só geração de arquivo).

---

## Pacote D — Testes (vitest)

| Arquivo | Cobertura |
|---|---|
| `core/export/__tests__/fireoneCsvExporter.spec.ts` | Header exato; Slat/Cue 1-based; Length clamp 20–1000; Priority≥1; rejeita Slat>40, Cue>32, firings>4000; advisory em design/simulation × bloqueio em real_operation; carimbo no `safetyBlackBox`. |
| `core/export/__tests__/fireoneImportPackage.spec.ts` | ZIP contém os 5 arquivos; README cita `File ▸ Import ▸ CSV File`. |
| `core/export/__tests__/exportCoordinatorFireOneTargets.spec.ts` | `'fireone'` (alias), `'fireone-csv'`, `'fireone-audit'` retornam `success/issues/cueCount` corretos. |
| `features/fieldbus/__tests__/fireOnePanel.gateway.spec.ts` | Painel **nunca** importa `fireoneProtocol.build*` direto — só `uiCommandGateway`. |
| `features/fieldbus/__tests__/useFireOneFleet.identifyProbe.spec.ts` | Probe reclassifica + persiste em `portRegistry`; sobrevive a reload. |
| `features/fieldbus/__tests__/useFireOneFleet.ultrafireVerify.spec.ts` | Download ok = success; mismatch = aborted + nota no black box. |
| `core/discovery/__tests__/markDeviceClassified.spec.ts` | Cache cross-session; FTDI cai em `fireone` se classificado (não em `dmx-generic`). |
| `core/hardware/adapters/__tests__/fireoneProfileAdapter.liveReadOnly.spec.ts` | Provenance flipa simulated→live_read_only quando device aparece e volta quando some. |

Mantidos intactos: 5× `fireoneModuleHardwareBridge.*`, `fireoneTelemetryParser.test.ts`, `phase1ExitCatalog.test.ts`.

---

## Pacote E — Garantias de não-regressão

**Zero alteração** em:
`uiCommandGateway`, `commandBus`, `safetyStateMachine`, `fireoneProtocol.ts` (já completo), `fireoneTransport.SerialTransport`, `fireoneModuleHardwareBridge.ts`, `GlobalEStopButton`, `MainLayout`, `workMode`, `simulationGuard`, `safetyBlackBox`, `productionSafetyOath`, `pyroTransportPolicy`, `phase2Transition`, `requestRealOperation`, `MegafireExporter`.

---

## Resumo de superfície

```text
NOVO   8 arquivos   (CSV exporter + ZIP package + 2 hooks/painel + 4 testes)
EDIT  ~14 arquivos  (FireOneExporter, exportEngine, viewport stub,
                    ExportCoordinator, FireOneProfileAdapter, controllerRegistry,
                    FieldOps, FireOneExportConsole, featureFlags,
                    firingSystemExports, goldenShowExport, joiCommandExecutor,
                    JOIResolverRegistry, JOIArtifactGenerator)
ZERO  alteração em superfície de safety / commandBus / protocol
```

## Premissas confirmadas pelo usuário

- Formatos export: **CSV oficial UltraFire** (rota oficial) + `.fir` rebatizado **audit.txt** (não-import).
- Hardware: **FireOne XL4-3 / XLII+** via **USB-FTDI direto** (WebSerial 9600 8N1, FT232R 0x0403/0x6001).
- Wireless / **rádio antena**: monitorado via `WIRELESS_STATUS`, configurável via `WIRELESS_CONFIG`.
- ARM/FIRE/E-STOP exclusivamente via `uiCommandGateway` + Hold-1.2 s + Phase 2 + production oath em real_operation. Em design/simulation tudo é advisory.

Pronto para aprovação. Após o **Approve**, executo na ordem: A1→A2→A3→A4→A5→A6→A7→A8 (export pipeline), B1→B2→B3 (discovery+adapter), C1→C2→C3→C4 (painel), D (testes).
