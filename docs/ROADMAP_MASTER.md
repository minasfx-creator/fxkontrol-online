# FXKONTROL — Roadmap Mestre até 100%

> Documento canônico do estado real do sistema (software + hardware) e do caminho até produção.
> Atualizado: Rodada 1 da Implantação 100%.
> Convenções: ✅ pronto e testado · 🟡 parcial · ❌ pendente · 🚫 banido por safety.

---

## 1. Subsistemas Software (estado verificável)

| Subsistema | Status | Prova |
|---|---|---|
| Safety Core (uiCommandGateway, SSM, GlobalEStop, BlackBox) | ✅ | `src/core/safety/`, testes P0/P2 |
| WorkMode 3-mode (design/simulation/real_operation) | ✅ | `src/core/workMode/`, simulationGuard |
| Phase 0 Readiness Audit | ✅ | `/dev/readiness-audit`, ADAPTER_TRIAGE |
| Phase 1 Golden Show (Libertadores+Maracanã Hino) | ✅ | `/dev/golden-shows`, 13/13 catalog tests |
| Phase 2 Hardware-Sync Gate | ✅ | `phase2Transition.ts`, 12/12 tests |
| Real Operation Request Gate | ✅ | `requestRealOperation()`, oath+planHash |
| Discovery Multi-Transport (Serial/USB/BLE/ArtPoll) | ✅ | `unifiedDiscovery`, `deviceAggregator` |
| Port Registry persistente + alias unification | ✅ | `portRegistry.ts` |
| Multi-Transport Concurrent + Auto-Fallback | ✅ | `MultiTransportLink`, quarantine 3-strikes |
| FXK16 stack (firmware → adapter → bridge → commandApi → sync) | ✅ | `useFXK16Bridge`, `fxk16Sync` |
| FXK32Q stack (firmware v1.1 → adapter → bridge → CLI diagnose) | ✅ | `firmware/fxk32q-esp32s3/`, `scripts/fxk32q-diagnose.mjs` |
| Show3D Engine + Auto-Fire + Timeline Sync | ✅ | `Show3DEngine`, useShow3DEngineSync |
| AI Show Builder (extend/diff/undo) | ✅ | `AIShowBuilderPanel`, 1001 tests |
| Strategic Command Hub `/strategy` | ✅ | DemoSessions+ClientApprovals (Cloud) |
| Training v2 Cinematic + Achievements | ✅ | 6 missões staged + 4 conquistas |
| Commercial Theme `data-theme="commercial"` | ✅ | Landing/Pricing/Comercial/PitchUS |
| Unreal 5.7 Bridge (PixelStreaming review-only) | 🟡 | Cesium pendente via Fab |

---

## 2. Hardware Roadmap (todo o projeto)

| Família | Firmware | Adapter | Discovery | Bridge UI | Field-tested | Notas |
|---|---|---|---|---|---|---|
| **FXK16** (16ch pyro core) | ✅ | ✅ | ✅ | ✅ | 🟡 | bench OK; field test pendente |
| **FXK32Q ESP32-S3** (2×16ch) | ✅ v1.1 | ✅ | ✅ | ✅ | ❌ | ARM gate firmware-side, auto-disarm 30s |
| **FXK XL4 Gateway** | 🟡 rascunho `.ino` | ❌ | ❌ | ❌ | ❌ | Fase 4 |
| **FXK M1** (master) | 🟡 rascunho v1.0.0 | ❌ | ❌ | ❌ | ❌ | Fase 4 |
| **FireOne FXK-PYRO 2.0** | ext | ✅ | ✅ | ✅ | 🟡 | array/pin stagger OK |
| **Showven Sonicboom / SPARKULAR / PyroAdaptor** | ext | 🟡 | ✅ ArtPoll | 🟡 | ❌ | DMX layout canônico OK |
| **FX Commander Pro** (PBUS dual-band) | ext | 🟡 | 🟡 | 🟡 | ❌ | CRC16 19200 baud spec mapeada |
| **CubeMesh RE168** (mesh outlets) | ext | 🟡 | 🟡 | 🟡 | ❌ | low-precision, não-pyro |
| **Tuya outlets** (BLE / Wi-Fi+BLE) | ext | ✅ | ✅ | ✅ | 🚫 pyro | 200–800ms latency, banido <50ms |
| **Skybrush drones** (export-only) | ext | export ✅ | n/a | 🟡 | ❌ | claim `marketing_hypothesis` |
| **Maiman lasers 16/39CH** | ext | ❌ | 🟡 DMX | ❌ | ❌ | Fase 4 |
| **DMX / Art-Net / sACN nexus** | n/a | ✅ | ✅ | ✅ | 🟡 | 33 PPS budget presets |
| **Radio CC1101 / SX127x dual-band** | ext | 🟡 rascunho | ❌ | ❌ | ❌ | Fase 4 |
| **Arduino Nano + 74HC595/CD4051** (12V monitor) | ✅ | ✅ | ✅ | ✅ | 🟡 | spec consolidada |

**Definição de "pronto" por hardware:** firmware canônico (≥v1.0) + adapter honesto + discovery em `unifiedDiscovery` + UI bridge + ≥1 round de bench-test documentado.

---

## 3. Fases até 100%

| Fase | Descrição | Status | Critério de saída |
|---|---|---|---|
| **0** | Readiness audit (3 engines + 9 provenances) | ✅ | Badge verde em `/dev/readiness-audit` |
| **1** | Golden show simulado completo | ✅ | `phase1ExitCatalog.test.ts` 13/13 |
| **2** | Hardware-sync simulado autorizado | ✅ | Phase2 grant fresco (≤5min) p/ catálogo |
| **3** | Bench-test físico FXK16 + FXK32Q | ❌ | Ver checklist §4 |
| **4** | Integração XL4 Gateway + M1 + Maiman + Radio | ❌ | Tabela §2 sem ❌ p/ esses hardwares |
| **5** | Field-test full stack (FireOne + Showven) em sítio fechado | ❌ | Run completo c/ blackbox íntegra |
| **6** | Show real autorizado | ❌ | Fase 5 verde + production oath + Phase 2 grant |

**Critério "100%":** §1 sem 🟡 · §2 sem ❌/🟡 · §3 todas verdes · 0 testes vermelhos · `safetyBlackBox.verifyChain()` íntegra em runs reais.

---

## 4. Checklist Fase 3 — Bench-test físico (FXK16 + FXK32Q)

**FXK16:**
- [ ] Pareamento USB (`/pairing/usb`) com VERSION/STATUS handshake <3s
- [ ] Pareamento BLE (`/pairing/ble`) UUIDs ffe0/ffe1/ffe2 OK
- [ ] ARM → FIRE single ch1..16 → DISARM (Hold-800ms cada)
- [ ] BATCH mask 0xFFFF c/ duração mínima
- [ ] Continuity report STATUS válido p/ cada canal
- [ ] E-STOP físico latch <50ms (medir)
- [ ] Auto-disarm por link-loss em 5s
- [ ] Multi-transport fallback Serial→USB sob remoção de cabo

**FXK32Q ESP32-S3 (2×16ch):**
- [ ] CLI `node scripts/fxk32q-diagnose.mjs --transport serial` verde
- [ ] Repetir p/ ble, tcp, ws, artnet, rs485
- [ ] ARM gate firmware: FIRE sem ARM → `NOT_ARMED`
- [ ] Auto-disarm 30s sem atividade
- [ ] E-STOP latch + clear pulses imediato
- [ ] Art-Net edge-trigger universo 7
- [ ] RS-485 XLII+ frame STX/ADDR/CMD/CKSUM/ETX

---

## 5. Checklist Fase 4 — Hardwares pendentes

**XL4 Gateway:** firmware → v1.0 c/ ARM gate · adapter `XL4GatewayAdapter` · discoverer · bridge UI · doc PINMAP/PROTOCOL.

**M1:** mesmo escopo XL4 + papel de master (orquestra subordinados).

**Maiman lasers:** adapter DMX 16CH/39CH presets · UI assignment · safety raycast NFPA.

**Radio CC1101/SX127x:** discoverer WebSerial · TDMA 433MHz · health metrics.

---

## 6. Checklist Fase 5 — Field-test sítio fechado

- [ ] Setup completo (FXK16+FXK32Q+FireOne+Showven+DMX+drones simulados)
- [ ] Run Libertadores 90s end-to-end
- [ ] Run Maracanã Hino 60s end-to-end
- [ ] BlackBox `verifyChain()` íntegra
- [ ] Latência E-STOP medida <50ms p99
- [ ] Telemetria 10Hz sem gaps >100ms
- [ ] Auto-fallback validado em ≥1 link
- [ ] Pós-mortem documentado em `docs/field-tests/`

---

## 7. Checklist Fase 6 — Show real

- [ ] Fase 5 verde nas últimas 72h
- [ ] Production oath aceito
- [ ] Phase 2 grant fresco (≤5min) com plan hash bate
- [ ] Operator confirmation registrado em blackbox
- [ ] BLE banido em real_operation (`pyroTransportPolicy`)
- [ ] Plano de contingência (E-STOP físico + abort)

---

## 8. Limpeza & Reorganização (Rodadas 2–3)

- **Rodada 2:** deletar 10 páginas órfãs/duplicadas (ver `docs/ROUTE_AUDIT.md`), limpar `prefetchRoutes.ts`, adicionar redirects.
- **Rodada 3:** reagrupar `src/pages/` por domínio (operacional/comercial/dev/legal/onboarding) e completar F5.B (`src/components/editor/` → `src/features/<bucket>/`).

---

## 9. Riscos abertos

| Risco | Mitigação |
|---|---|
| Firmware XL4/M1 não validado em produção | Fase 4 obrigatória antes de qualquer real_operation usando-os |
| Tuya tentado em pyro por engano | `pyroTransportPolicy` bane BLE; cobrir em alerta UI |
| Plan hash mismatch após edição last-minute | `requestRealOperation` recusa; operador refaz Phase 2 |
| Drift Show3D vs audio master clock | tolerância 0.35s já implementada |
