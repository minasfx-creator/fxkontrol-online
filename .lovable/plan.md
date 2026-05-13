## Diagnóstico (refinado)

Firewall arquitetural entre `/skycanvas` (editor 3D) e `/command` (controladores) é parcial. Vazamentos confirmados:

**Vazamento de identidade de pasta**
- 30+ painéis de comando vivem em `src/components/editor/*` junto com componentes de coreografia. Importes de `/command` e `/skycanvas` cruzam a mesma raiz — qualquer refactor da pasta arrasta as duas superfícies.

**Telemetria sintética em controladores (8 pontos)**
1. `DroneCommandPanel.tsx:58-72` — `setInterval(1500ms)` gera `alt/speed/heading/battery` com `Math.random()` para até 8 drones.
2. `DroneCommandPanel.tsx:112-123` — `setInterval(2000ms)` gera `windDir/windSpeed/formationLock` com `Math.random()`.
3. `live-firing/FXKNetPanel.tsx:31` — `TopologyMinimap` gera `signal: 60 + Math.random()*40` para nós de rede + firmware versions falsas (`v1.3.0`, `v1.4.1`).
4. `MA3ControlPanel.tsx:61` — `oscHost` default `'192.168.1.100'` (IP placeholder em campo "real").
5. `dmx/DMXMonitorPanel.tsx:138` — campo `source: '192.168.1.100'` hardcoded em pacotes Art-Net que serão exibidos como "vindo da rede".
6. `CurrentStateMatrix.tsx:96-100` — declara `integrationMode: 'simulated'` para 4 fontes que são internas reais (ShowPlan, VerificationEngine, ExportCoordinator, AuditTrail) — desonestidade reversa.
7. `dmx/DMXMonitorPanel.tsx:111-145` — popula `dmxValues` com `ch.firing ? ch.intensity : 0` lendo `useFireOneChannelStore` (intent do show plan, não medição real do barramento Art-Net) sem badge de proveniência.
8. (não-fix nesta entrega) `LiveFiringPanel.tsx:501` — `bridgePhysicalController.simulateHilFire` é dev-only e já gated.

**Sem guard test** que impeça regressão (importe cruzado entre as superfícies).

**O que já está correto** (preservar): `CommandCenter.tsx` não monta `SkyCanvasMount`/`Show3DEngine`; `SkyCanvas.tsx` declara "Zero CommandBus/FieldBus/SafetyStateMachine"; `MainLayout` esconde `GlobalSafetyBar` em `/command`; `GlobalEStopButton` permanece em ambas; `useConsoleProvenance` + `realOnlyGate` já existem.

## Plano

### 1. Domain firewall por re-export (zero arquivo movido)

Dois novos barrels read-only:

- `src/features/command/index.ts` — re-exporta os ~32 painéis que `CommandCenter.tsx` consome.
- `src/features/skycanvas/index.ts` — re-exporta os componentes que `SkyCanvas.tsx` consome (`SkyCanvasMount`, `SkyCanvasViewportShell`, `TimelineStripView`, `CueInspectorPanel`, `EffectLibrarySidebar`, `ViewportOverlays`, `SkyCanvasDiagnosticsPanel`, `SkyCanvasCommandPalette`, `CatalogImportDialog`).

`CommandCenter.tsx` e `SkyCanvas.tsx` reescrevem seus `lazy(() => import('@/components/...'))` para passar pelos barrels. Convive com [F5 Features Re-Export] já existente.

### 2. Guard test arquitetural

`src/__tests__/commandSkycanvasFirewall.guard.spec.ts` — varredura AST/regex em:

- **`/command` side** (`src/pages/CommandCenter.tsx` + `src/features/command/**`) → proibido importar:
  `@/components/editor/SkyCanvasMount`, `@/components/skycanvas/*`, `@/features/skycanvas/*`, `Show3DEngine`, `SkyCanvas2`, `SkyCanvas3D`, qualquer coisa de `@/render_ultra/*`.
- **`/skycanvas` side** (`src/pages/SkyCanvas.tsx` + `src/features/skycanvas/**`) → proibido importar:
  `@/core/command/CommandBus`, `@/core/safety/uiCommandGateway`, `@/hardware/transports/*`, `@/features/command/*`, `LiveFiringPanel`, `ShowCommanderPanel`, `FXKNetPanel`, `DroneCommandPanel`, `MA3ControlPanel`.
- Strings de navegação (`navigate('/command')`, `navigate('/skycanvas')`) continuam permitidas.

### 3. Real-data only nos controladores

**3a. Empty state canônico** — `src/components/command/_shared/NoLiveHardwareEmptyState.tsx`:
- Recebe `kinds: ControllerKind[]` + `label`; usa `useConsoleProvenance` + `ProvenanceBadge`; renderiza `NO HARDWARE` com mensagem "Sem link verificado com {kinds.join('/')} — telemetria desabilitada" + CTA "Abrir Pareamento" → `/pairing`.

**3b. DroneCommandPanel** (gap #1 e #2):
- Cria `src/hooks/useDroneTelemetry.ts` que filtra `deviceAggregator.getDevices()` por `controllerRegistry.kind === 'drone-link'`. Sem device verificado → retorna `{ live: false, samples: [], wind: null }`.
- Remove os dois `setInterval(Math.random())`. Telemetria/wind passam a vir do hook.
- Wrapper: enquanto `!live`, renderiza `<NoLiveHardwareEmptyState kinds={['drone-link']} label="FXK-DRONE" />`. Ações ARM/LAUNCH/ABORT continuam (rotas de comando, não dados).

**3c. FXKNetPanel TopologyMinimap** (gap #3):
- Substitui `nodes` sintéticos por leitura de `deviceAggregator.getDevices().filter(d => d.online)`. Cada nó real expõe `signal` via `LinkHealth.latencyEmaMs` (mapeada para 0-100% com clamp), `fw` via `device.firmware ?? '—'`. Sem devices online → render do bloco trocado por badge `NO NODES DISCOVERED` com link para `/pairing`.

**3d. MA3ControlPanel** (gap #4):
- Default `oscHost = ''` (não `'192.168.1.100'`); placeholder do input vira `192.168.0.10 (host MA3)`. Botão "Conectar" continua, mas com validação de IP RFC 5952 antes do submit. Sem IP → botão disabled + tooltip honesto.

**3e. DMXMonitorPanel** (gaps #5 e #7):
- `source` hardcoded `'192.168.1.100'` → `source: 'show-plan-intent'` (ou nome real do nó Art-Net se disponível via `deviceAggregator`). Adiciona `<ProvenanceBadge mode={...} />` no header do painel via `useConsoleProvenance(['dmx-bridge'])` — quando não houver bridge live, o monitor mostra explicitamente "INTENT (ShowPlan) — sem leitura de barramento".
- IDs de pacote/sessão (`Math.random().toString(36)`) ficam, mas trocados para `crypto.randomUUID()` (correção menor, semântica idêntica).

**3f. CurrentStateMatrix** (gap #6):
- Linhas internas (ShowPlan, VerificationPass, ExportCoordinator, AuditTrail) viram `integrationMode: 'live_read_only'`, `evidence_level: 'adapter_only'` — refletem a verdade (são fontes reais do app, não sintéticas). Linhas hardware mantêm `useConsoleProvenance` por família.

### 4. Cosméticos de separação

- `MainLayout.tsx` adiciona `data-surface={isEditor ? 'editor' : isCommand ? 'command' : 'app'}` no `<main>` (substrato CSS para isolar superfícies sem mexer em tokens).
- `CommandCenter.tsx` ganha banner discreto `MODO COMANDO · LIVE-RO/REAL` no topo via `useWorkMode()` — só texto, sem alterar safety.
- `SkyCanvas.tsx` ganha banner discreto `MODO EDITOR · DESIGN` no topo (mesmo padrão), reforçando que ali ninguém arma nada.

### 5. Fora de escopo (próxima rodada)

- Movimentação física `src/components/editor/* → src/components/command/*` (refactor grande).
- Adapter de drone real (`useDroneTelemetry` já fica pronto para receber).
- Refatorar `LiveFiringPanel.simulateHilFire` (já é dev-only gated).

### Arquivos

**Novos (5)**:
- `src/features/command/index.ts`
- `src/features/skycanvas/index.ts`
- `src/components/command/_shared/NoLiveHardwareEmptyState.tsx`
- `src/hooks/useDroneTelemetry.ts`
- `src/__tests__/commandSkycanvasFirewall.guard.spec.ts`

**Editados (8)**:
- `src/pages/CommandCenter.tsx` — imports via barrel + banner.
- `src/pages/SkyCanvas.tsx` — imports via barrel + banner.
- `src/components/editor/DroneCommandPanel.tsx` — remove 2 `Math.random()` + adota hook + empty state.
- `src/components/editor/live-firing/FXKNetPanel.tsx` — TopologyMinimap real ou empty state.
- `src/components/editor/MA3ControlPanel.tsx` — `oscHost` default vazio + validação.
- `src/components/editor/dmx/DMXMonitorPanel.tsx` — provenance badge + source honesto + `crypto.randomUUID()`.
- `src/components/editor/CurrentStateMatrix.tsx` — corrige `integrationMode` das 4 linhas internas.
- `src/layouts/MainLayout.tsx` — `data-surface` no `<main>`.

### Garantias

- Zero impacto em safety (nenhuma rota nova até `commandBus`/`SSM`/`fieldBus`).
- Zero mudança em workMode, featureFlags, GlobalEStopButton, Hold-to-Confirm.
- Compatível com `SkyCanvasMount canonical`, `Honest Hardware Layer`, `Real-Only Mode`, `Round 15 Mocks Erradicated`.
- Suite ganha 1 guard arquitetural + 2 testes para `useDroneTelemetry`.
