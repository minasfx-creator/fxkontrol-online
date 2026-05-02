
# Plano de Implantação · FX KONTROL (derivado do orçamento JOI 02/05/2026)

Estado atual confirmado no código:
- `ReadinessEvaluator` retorna `BLOCKED` enquanto `VerificationEngine` falha ou houver erros de hardware.
- `unifiedHardwareRegistry` reporta 1/9 adapters online (resto `not_integrated`/`simulated`).
- `real_only_mode = true` (default) — telemetria de adapter sem handshake é dropada por `realOnlyGate`.
- `safety_gate_strict = true` em produção, mas Modo Testes (`src/_quarantine/safety/`) tem shims neutralizados.
- ShowPlan canônico, mas `sp.hardwareConfig.modules.length === 0` força `READY_FOR_SIMULATION`.

A meta é caminhar `BLOCKED → READY_FOR_SIMULATION → READY_FOR_EXPORT → READY_FOR_HARDWARE_SYNC → LIVE_READ_ONLY` sem violar nenhuma regra core (E-STOP <50ms, AI nunca arma/dispara, simulação ≠ disparo real, hierarquia de design).

---

## Fase 0 · Debug e Integração Básica  (semana 1–2)

Objetivo: sair de `BLOCKED` e atingir `READY_FOR_SIMULATION` estável.

Entregas:
1. **Diagnóstico consolidado**
   - Painel `/dev/readiness-audit` que renderiza `verificationEngine.run()` + `readinessEvaluator.evaluate()` + `unifiedHardwareRegistry.getSystemHealth()` lado a lado, com `Provenance` de cada um dos 9 adapters.
   - Export JSON do snapshot (alimenta o relatório PDF da rodada de Go-Live).
2. **Triagem dos 8/9 adapters offline**
   - Para cada adapter (`FXK16ModuleAdapter`, `ArduinoNanoAdapter`, `ArtNetNodeAdapter`, `BatteryMonitorAdapter`, `DMXUniverseAdapter`, `FireOneProfileAdapter`, `MuxReaderAdapterCD4051`, `RelayBankAdapter32`, `ShiftRegisterAdapter74HC595`): classificar como (a) sem hardware presente → manter `not_integrated` honesto; (b) hardware presente sem handshake → roteiro de pareamento; (c) bug no adapter.
   - Garantir que (a) e (b) **não** emitam telemetria sintética com `dev_hardware_simulator=false` (regra Honest Hardware Layer).
3. **FXK16 como módulo de referência**
   - Validar fluxo USB e BLE pelos wizards `/pairing/usb` e `/pairing/ble` já existentes; persistir em `portRegistry`; confirmar handshake via `fxk16BleHandshake` e `useFXK16Bridge`.
   - Smoke test: `useFXK16Commands.ping()` retornando `CommandResponse.ok` com 1 dispositivo real ou emulador `src/dev/fxk16/fxk16AsciiEmulator`.
4. **Limpar warnings de Provenance**
   - Adapters não conectados saem do dashboard de "erros" e entram numa tabela "Não integrado (esperado)" — separação visual exigida pela camada Honesty.
5. **Critério de saída**
   - `readinessEvaluator.evaluate().status === 'READY_FOR_SIMULATION'` em sessão limpa (nenhum hardware real, simulator OFF).
   - 0 erros em `VerificationEngine`, warnings só sobre conteúdo do ShowPlan.

---

## Fase 1 · Readiness para Design de Show  (semana 3–5)

Objetivo: criar e validar shows completos em `simulation` sem hardware, atingindo `READY_FOR_EXPORT`.

Entregas:
1. **Show Libertadores como golden show**
   - Seed em `src/lib/showSeeds/libertadores.ts`: 32 pontos altos, 32 baixos, cometas, posicionamento via `PlannedPosition` (YZX HPR), efeitos via `PlannedTimelineItem`.
   - Validador roda `ShowPlanValidationResult` antes de gravar.
2. **Loop simulação = execução**
   - `play` em workMode=`simulation` toca a coreografia 100% — partícula GPGPU, smoke shader, blackbody, com `safetyGate.anyEnforced` respeitando workMode (já implementado em Simulation Guard Defense).
   - Visual idêntico ao que será exportado: shaders cinema + lens flare + halation já estão no `render_ultra/`.
3. **Especificações técnicas exportáveis**
   - `inspect_showplan` → BoM (calibres, contagens, gradientes VDL), diagrama de sequenciamento (CSV + PDF via `pdfRenderer`), pinout proposto por módulo FXK16/74HC595.
   - Reaproveita `vdlEffectMapper` (já com saturação de calibre validada nos testes da rodada anterior).
4. **Export honesto**
   - FireOne `.fdb`-like via adapter existente; Skybrush ZIP com `_FXK_DISCLAIMER.txt` (claim `marketing_hypothesis`).
   - `ExportCoordinator` em modo Testes vira advisory (já consolidado), mas em produção exige `READY_FOR_EXPORT`.
5. **Critério de saída**
   - Show Libertadores gera PDF técnico + export FireOne + export Skybrush sem nenhum erro de Verification.
   - `readinessEvaluator.evaluate().status === 'READY_FOR_EXPORT'`.

---

## Fase 2 · Expansão de Hardware e Redundância  (semana 6–9)

Objetivo: integrar hardware físico real, atingir `READY_FOR_HARDWARE_SYNC` e operar com segurança em `LIVE_READ_ONLY`.

Entregas:
1. **Frota FXK16 multi-módulo**
   - `DeviceAggregator` já agrupa multi-transport; expandir UI `/dev/real-discovery` para mostrar fila de módulos pareados, alias unificados, `linkMode` persistido (single/dual/broadcast).
   - Auto-fallback de transport via 3 falhas → quarentena (já implementado, expor métricas).
2. **Hardware auxiliar**
   - `74HC595` shift register, `CD4051` mux reader e `RelayBank32` ganham handshake real ou ficam `not_integrated` declarado; nada de simulação silenciosa.
   - `BatteryMonitorAdapter` exigido para sair de `READY_FOR_SIMULATION` (`low_battery_alarm` bloqueia sync — já implementado).
3. **Art-Net / DMX produção**
   - `artNetNodeAdapter.link.degraded` deve ser `false`; aplicar preset `dmxTimingHarness` `safe`/`standard` e medir packet loss real no console `DMXBroadcastDiagnostics`.
   - Patch MA3/GMA2 validado em `/features/artnet`.
4. **Safety + redundância**
   - Quarentena de safety **só** em Modo Testes; produção rearma `safetyGate.enableAll()` (regra `safety_gate_strict`).
   - Continuity Check antes de qualquer ARM, com latência E-STOP medida <50ms (instrumentar via `useTransportDiagnostics`).
   - Redundância: 2× FXK16 em `linkMode='dual'` para pontos críticos do show Libertadores.
5. **Live Read-Only**
   - `OperationalModeGuard` em `live-read-only` durante o ensaio com hardware armado mas barramento sem dispatch (já mapeado em `_isOperationAllowed`).
6. **Critério de saída**
   - 9/9 adapters em estado declarado correto (`integrated` ou `not_integrated` honesto).
   - Ensaio do show Libertadores em LIVE_READ_ONLY com telemetria contínua, 0 erros, latência E-STOP medida <50ms, audit trail 100% gravado em `SafetyAuditTrail`.

---

## Fase 3 · Otimização e Diferenciação  (semana 10+)

Objetivo: feature work depois que a base está sólida. Sem comprometer Fases 0–2.

Entregas (priorizadas, recortáveis):
1. **Coreografia avançada**
   - Espelhamento avançado, arcos paramétricos, biblioteca VDL expandida (mantendo os 25 colors canônicos).
   - `aiShowBuilder` melhora `ShowPlan` antes de tocar no `useProjectStore` (já é o contrato), com guardrails do `aiGuardrail.ts` impedindo qualquer ação física.
2. **Drone swarm sincronizado**
   - Pipeline VVIZ + Skybrush export com FAA Part 107 já validado client-side; agora plugar `swarmgpt` (Hungarian + FPS sampling, flags já existentes) na timeline da pirotecnia.
   - DockTwin pilot (telemetria mock primeiro, real depois).
3. **ML para style transfer**
   - `learn_style` extraindo timing/density patterns de shows passados; sugestões aparecem como "ghosts" na timeline, nunca aplicadas sem confirm humano.
4. **Risco em tempo real**
   - Weather-vis crítico (<1km) já tripa `useFleetStore.setShowState`; expandir para previsão (vento, umidade) via Google Geo Intelligence edge function existente.
5. **Pacotes SaaS**
   - Cards Previs / LiveOps / Enterprise em `/comercial`, CTAs → demo form. Sem checkout real nesta fase (deferido).

---

## Detalhes técnicos transversais (válido para todas as fases)

- **AI**: nunca pode armar/disparar/energizar/mudar workMode. Novos endpoints passam por `aiGuardrail.ts` + `uiCommandGateway`. JOI continua "secretária", nunca executora.
- **Fluxo de comando**: UI → `uiCommandGateway` → `CommandBus` → `SafetyStateMachine` → `FieldBus`. Zero atalho.
- **Persistência**: Lovable Cloud — qualquer tabela nova segue padrão `demo_sessions` (owner via uuid, RLS owner-scoped + admin read-all, sem FK para `auth.users`, `gen_random_uuid()`).
- **Design**: hierarquia canônica (safety > consolidado > WCAG > brief > estética). Tokens `--field-*`, `--status-*`, `--state-*`, `.ds-*`. Rejeitados permanecem rejeitados (#121214 / #00FFFF puro / laranja-CTA chrome).
- **Sem barrels** em módulos de reliability/safety/hardware. Imports diretos.
- **Honesty Layer**: nenhuma rota nova pode ler `IngestionLayer` sem provenance verificada com `real_only_mode=true`.
- **E-STOP global**: `GlobalEStopButton` permanece visível (z-9999) em todas as rotas exceto `/command`.
- **Testes**: cada fase entrega com Vitest verde (atual: 849/849). Novos módulos exigem teste para path crítico.
- **Memória**: ao final de cada fase, atualizar `mem://index.md` com referências a memos novas (ex.: `mem://implantacao/fase-0-debug-readiness`).

---

## Sequência de execução proposta

```text
F0  ─►  F1  ─►  F2  ─►  F3
 │       │       │       │
 │       │       │       └─ paralelizável depois de F2 estável
 │       │       └─ exige hardware físico em mesa
 │       └─ 100% software, paralelo a aquisição de hardware
 └─ pré-requisito absoluto, bloqueia tudo
```

Próxima ação ao aprovar: começar Fase 0 pelo painel `/dev/readiness-audit` e pela triagem dos 8 adapters offline, sem tocar em nada de safety nem em comportamento de produção.

---

### Fase 0 · Status atual (rolling)
- ✅ Painel `/dev/readiness-audit` operacional com export JSON.
- ✅ Triagem declarativa em `src/core/hardware/adapterTriage.ts` (9/9 adapters classificados).
- ✅ FXK16ModuleAdapter agora tem API pública `markHandshakeOk(transport)` / `markHandshakeLost()`.
- ✅ `discoveryRegistryBridge` boot em `App.tsx` — promove provenance do FXK16 para `live_read_only` ao detectar handshake real (USB ou BLE) via singleton `useFXK16Bridge`. Demote em disconnect/heartbeat timeout.
- ⏳ Próximos: equivalente para Art-Net (ArtPollReply → markHandshakeOk) e Battery-12V (piggy-back no controlador host).
- ✅ ArtNetNodeAdapter agora tem API pública `markHandshakeOk(host)` / `markHandshakeLost()` e a bridge promove no primeiro ArtPollReply real (via `mdnsArtnetDiscoverer.watch`); demote quando todos os hosts somem.
