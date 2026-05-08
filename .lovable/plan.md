## Plano: FXKONTROL LiveOps — gap analysis e implementação

Objetivo: aterrar as recomendações do `deep-research-report_5.md` no código atual, identificar o que já existe vs. o que falta, e entregar incrementos verificáveis sem violar a arquitetura canônica (uiCommandGateway → CommandBus → SafetyStateMachine → FieldBus, workMode, simulationGuard).

### 1. Mapa: relatório ↔ código atual

| Bloco do relatório | Status no código | Arquivo canônico |
|---|---|---|
| Safety Kernel (FSM SAFE→PRE_ARM→ARMED→RUNNING…) | **Existe parcial** — estados IDLE/LOCKED/ARMED/FIRING/E_STOP | `src/core/safety/SafetyStateMachine.ts` |
| Device Registry (SoT) | **Existe** — `portRegistry` + `deviceAggregator` (multi-transport, aliases) | `src/core/discovery/{portRegistry,DeviceAggregator}.ts` |
| Transport Manager (discovery+health+quarantine) | **Existe** — `UnifiedDiscoveryService`, `MultiTransportLink`, `TransportSenderRegistry` (auto-fallback 3 falhas) | `src/core/discovery/*` |
| Cue Engine (manual/semi/auto/mixed) | **Existe parcial** — `Show3DEngine` dispara cues por timestamp; falta modo "manual/semi-auto" formal | `src/components/show3d/Show3DEngine.ts` |
| Timecode Service (LTC/MTC/GPS/Internal) | **Existe parcial** — `smpteEngine` + `timecodeCore` + `ltcEncoder`; falta MTC/GPS e seleção de fonte unificada | `src/lib/smpte/*`, `src/core/time/timecodeProvider.ts` |
| Go/No-Go + readiness | **Existe** — `useSystemReadiness`, `VerificationEngine`, `phase1/phase2Transition` | `src/core/verification/*`, `src/lib/showSeeds/*` |
| Black Box / Journal encadeado | **Existe** — `safetyBlackBox.ts` (SHA-256 chain, 500 ring) + `blackBoxRecorder` (telemetria 10Hz) | `src/core/safety/safetyBlackBox.ts` |
| Compiled Show artifact (assinado, hash, COSE) | **Falta** — temos `showPlanHash` SHA-256, mas sem manifest+signing+verify code | a criar: `src/core/compiler/CompiledShow.ts` |
| FireOne bridge (read-only/assistido) | **Falta** — temos exporter `.fir`, sem leitura de painel/clock/health | a criar: `src/hardware/adapters/fireOneSerialAdapter.ts` |
| Art-Net/sACN/RDM/RDMnet adapter | **Existe parcial** — Art-Net via edge function `artnet-bridge`; sem sACN nem RDM | `supabase/functions/artnet-bridge/`, a expandir |
| Mobile companion mTLS | **Falta** — Capacitor existe; sem mTLS, sem sessão limitada por papel | a criar: `src/mobile/MobileGateway.ts` |
| Maleta + DockTwin bench HIL | **Existe parcial** — `/dev/perf-bench`, `/dev/golden-shows`; falta bench HIL com dummy load | a expandir |
| 50 ciclos validação por caminho crítico | **Falta** — temos testes unitários, sem suíte de stress de caminho crítico | a criar: `src/__tests__/criticalPath50Cycles.spec.ts` |
| SBOM / SLSA / SSDF / build provenance | **Falta** — CI tem AI quality pipeline, sem SBOM/provenance | `.github/workflows/` a expandir |
| Quarentena formal (regra+liberação) | **Existe parcial** — `deviceAggregator.quarantineTransport` por link; falta quarentena por device com workflow de liberação | a expandir |
| HMI física (chave, deadman, E-stop hard) | **Existe parcial** — `GlobalEStopButton` software; sem suporte a HID/Serial physical key | a planejar (sprint maleta) |

**Pontos fortes já consolidados**: porta única de comando (uiCommandGateway), workMode 3-mode com simulationGuard, real_only_mode + provenance honesty, Phase1/Phase2 gates com freshness 5min, p0 hardening (oath+planHash+pyroTransportPolicy banindo BLE em real_operation), continuity matrix honesta com `NO_HARDWARE` default.

**Riscos vs. relatório**:
- Falta segregação formal Studio/Compiler/LiveOps em rotas (hoje misturado em `/skycanvas`, `/command`, `/dev/*`).
- Cue Engine dispara por tempo apenas; não suporta `manual/semi-auto/mixed mode` explícito (FireOne paridade).
- Black Box hoje guarda decisões de safety + telemetria; falta journal de **cada comando** com `commandId` correlacionado UI→ack/nack.

### 2. Entregas por sprint (incrementais, cada uma testável)

**Sprint A — Compiled Show artifact (Compiler v1)**
- Novo `src/core/compiler/CompiledShow.ts`: gera `manifest.json` (cuesHash, modulesHash, planHash, signerKid, createdAt) + envelope com `Ed25519` (Web Crypto API, `Ed25519` se disponível, fallback `ECDSA P-256`).
- `requestRealOperation` passa a exigir `compiledShow.signature.verified === true` antes de Phase2.
- UI: `/dev/golden-shows` ganha botão "Compile & Sign" + "Verify".
- Testes: assinatura/verificação round-trip, tampered manifest rejeitado, planHash consistente entre compile e Phase2.

**Sprint B — Command Journal correlacionado**
- Wrap `commandBus.dispatch` para emitir 3 entries no `safetyBlackBox`: `command.requested`, `command.decision` (accepted/blocked + ruleId), `command.dispatched` (ack/nack + latencyMs), todos com `commandId` UUID.
- Painel `/dev/blackbox-inspector` ganha view "Por commandId" agrupando ciclo de vida.
- Esquema casado com `command_journal` Supabase já existente — adicionar sync opcional offline-first.

**Sprint C — Cue Engine modos manual/semi-auto/mixed**
- Estender `Show3DEngine` (ou novo `src/core/cue/CueEngine.ts`) com `mode: 'auto'|'semi'|'manual'|'mixed'`.
- `auto`: comportamento atual.
- `semi`: para em cada cue marcado `requiresOperatorGo`, espera `cueEngine.go(cueId)`.
- `manual`: nada dispara sozinho; UI lista próximos cues com botão GO + Hold-800ms.
- `mixed`: mistura por trackIndex (PYRO=manual, DRONE=auto).
- Roteia tudo via `uiCommandGateway.fire({ cueId })`.

**Sprint D — FireOne Serial Adapter (read-only)**
- Novo `src/hardware/adapters/fireOneSerialAdapter.ts` usando `Web Serial` já disponível.
- Apenas leitura: fingerprint do painel, firmware, clock, mode (manual/internal/computer-assisted/mixed), continuity status, fire power.
- Registra como `transport='serial'`, `provenance='live_read_only'`, `class='pyro_critical'`.
- UI: card em `FieldDiagnosticsDock` com badge "FireOne · READ-ONLY".
- Sem nenhum frame de disparo. Anota memória `mem://hardware/fireone-readonly-adapter`.

**Sprint E — Quarentena por device + workflow liberação**
- Estender `deviceAggregator` com `quarantineDevice(deviceKey, reason, evidence)` (hoje só por transport).
- Regras automáticas: 3 heartbeats perdidos em link crítico → device DEGRADED; CRC mismatch repetido → bloqueio comando novo; ACK timeout em RUNNING → HOLD via SSM.
- Liberação exige `operatorConfirmed` + entry no blackBox.
- UI: `/dev/quarantine-console` com lista, motivo, evidência, botão "Liberar (Hold-1.2s)".

**Sprint F — HIL bench 50-ciclos**
- Novo `src/__tests__/criticalPath50Cycles.spec.ts`:
  - 50× discovery→register→arm→fire→safe (com `dev_hardware_simulator` flag ON, fixtures em `src/dev/`).
  - 50× phase1→phase2→requestRealOperation→disarm.
  - 50× ESTOP path latência <50ms (assert via deterministicClock).
- Falha de qualquer iteração derruba CI.

### 3. Decisões técnicas explícitas

- **Sem engenharia reversa** de FireOne: adapter usa apenas leitura serial documentada; nada de frames de disparo.
- **Sem cloud no caminho crítico**: blackBox/journal seguem locais (`localStorage` + opcional sync Supabase posterior, já implementado em `command_journal`).
- **Tuya permanece banida de pyro_critical**: já consolidado em memória.
- **mTLS mobile fica para sprint posterior** (depende de Capacitor nativo + cert pinning); Sprint A-F focam stack web/Lovable Cloud.
- **Sem tocar em**: `client.ts`, `types.ts` Supabase, brief operacional Vantablack, design priority (Safety>WCAG>brief).

### 4. Documentação e memória

- Salvar relatório em `docs/strategy/liveops-deep-research-2026-05.md` (cópia do upload).
- Atualizar `docs/ROADMAP_MASTER.md` com seção "LiveOps Maturity" referenciando os 6 sprints.
- Nova memória `mem://arquitetura/liveops-3-camadas` (Studio/Compiler/LiveOps) — Core rule.

### 5. Ordem proposta

1. Salvar relatório + atualizar roadmap (read-only, sem código).
2. Sprint A (Compiler/sign) — base para Phase2 endurecida.
3. Sprint B (Journal) — observabilidade de tudo que vier depois.
4. Sprint E (Quarentena) — usa journal.
5. Sprint C (Cue modes) — depende de journal.
6. Sprint D (FireOne RO) — independente, pode entrar em paralelo.
7. Sprint F (50 ciclos) — gate de release.

Aguardando aprovação para começar pela etapa 1 (salvar relatório + atualizar `ROADMAP_MASTER.md` + memória `liveops-3-camadas`) e Sprint A.