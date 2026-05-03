# FXKONTROL — Arquitetura Consolidada v6 (Master Architect Pass)

## Princípio organizador

Quatro planos ortogonais, cada um com fronteiras de confiança explícitas:

1. **Safety Plane** (determinístico, auditável, latência <50ms)
2. **Show Plane** (ShowPlan canônico, IA, simulação, render)
3. **Hardware Plane** (transports reais, discovery, telemetria honesta)
4. **Experience Plane** (UI/UX, design system, marketing, training)

Cada plano tem **uma única porta de entrada** e barrels eliminados nos críticos. Tudo que existe hoje (47 memórias) se encaixa sem reescrita — esta é a ordenação canônica, não um rewrite.

---

## 1. Safety Plane — núcleo determinístico

```text
UI ──► uiCommandGateway ──► CommandBus ──► SafetyStateMachine ──► FieldBus
                                  │                                   │
                                  ├──► simulationGuard (workMode)     │
                                  ├──► aiGuardrail (caller=agent ✗)   │
                                  ├──► productionSafetyOath           │
                                  ├──► pyroTransportPolicy            │
                                  └──► safetyBlackBox (SHA-256 chain) │
                                                                      ▼
                              GlobalEStopButton ──► commandBus.E_STOP (drop SFX)
```

**Invariantes (não negociáveis):**
- UI **nunca** chama `safetyStateMachine.transition()`, `fieldBus.send()`, `executor.fire()` direto
- IA **nunca** atinge ARM/FIRE/E_STOP/workMode (bloqueado por `caller`)
- E-STOP global sempre visível `z-[9999]`, exceto `/command`
- `real_operation` exige Phase 2 grant fresco (≤5min) + production oath + plan hash
- Black box ring 500 com cadeia SHA-256 (tamper-evident)
- Quarentena ativa `__FXK_SAFETY_QUARANTINE__` → recusa real_operation

**Modos de trabalho:**
| Modo | Bloqueios físicos | Uso |
|---|---|---|
| `design` | nenhum | criação livre, IA, render |
| `simulation` | advisory only (não bloqueia) | dry-run, golden shows, training |
| `real_operation` | TODOS intertravamentos | campo, voo real |

---

## 2. Show Plane — ShowPlan como verdade canônica

```text
                     ┌──────── AI Show Builder (extend/diff/undo) ────────┐
                     │                                                     │
  Templates ─────────┤                                                     │
  Golden Catalog ────┤──► ShowPlan (canonical) ──► VerificationEngine ──► Phase Gates
  VVIZ/VDL Import ───┤         │                          │                     │
  SwarmGPT/JOI ──────┘         │                          │                  Phase 1 ─► READY_FOR_FIELD
                               │                          │                  Phase 2 ─► READY_FOR_HARDWARE_SYNC
                               ▼                          ▼                  Real    ─► requestRealOperation()
                          Show3DEngine ◄──── Timeline (audio master clock)
                               │                          │
                  ┌────────────┼──────────────┐           │
                  ▼            ▼              ▼           ▼
            PyroSim         Drones        Lasers     Exporters
        (GPGPU+WebGPU)   (formations)  (ILDA/laser)  (Skybrush/MAVLink/PDF/ZIP)
```

**Decisões consolidadas:**
- ShowPlan é **a** fonte; DMXLAYOUT.ini é puramente visual
- Rotação: Position=YZX (HPR), Effect=PTS (Pan/Tilt/Spin)
- VDL: 25 cores Euclidean, LRU 256
- Timeline: ECS/SoA, zero-GC, 4px dead-zone, snap 30/50/90
- Show3D ↔ Timeline ↔ Audio: master clock unidirecional via `useAudioMasterClock`
- Exports honestos com claim policy (`validated` / `pilot` / `marketing_hypothesis`) + disclaimers

**Render pipeline (11 layers):**
WebGPU compute unified kernel → Bitonic sort → Fire (blackbody) → Smoke (Beer-Lambert) → Wind (Curl Noise 3D) → Scatter → Bloom/Halation → ACES Hue-Preserve → Lens Flare → Film Grain → Atmospheric Depth. Fallback WebGL2 (FBO ParticleGPGPU) gated por flag.

---

## 3. Hardware Plane — honest, multi-transport, identity-unified

```text
       ┌─ Web Serial ─┐
       ├─ WebUSB ─────┤
       ├─ Web BLE ────┤──► UnifiedDiscovery ──► PortRegistry (aliases[])
       ├─ Art-Net/sACN┤        │                      │
       └─ Capacitor ──┘        ▼                      ▼
                       DeviceAggregator ──► PhysicalDevice (1:N transports)
                              │                      │
                              ▼                      ▼
                  MultiTransportLink         LinkHealth (EMA, txOk/Err)
                  (single/dual/broadcast)         │
                              │                   ▼
                              ▼            Auto-Fallback (3 fails → quarantine)
                       TransportSenderRegistry
                              │
                              ▼
                     IngestionLayer ──► realOnlyGate ──► live_read_only
                              │                                  │
                              ▼                                  ▼
                       Discovery→Registry Bridge          DeviceEventLog
                       (FXK16+Battery+Mux+SR auto-promote)
```

**Hardware estendido:**
- **FXK16**: BLE (ffe0/ffe1/ffe2 handshake) + USB; typed Command API com client-ARM gate, auto-disarm on link loss; field config persistido (mode/duration/sweep/burst)
- **FireOne FXK-PYRO 2.0**: array/pin stagger
- **Showven**: Sonicboom, SPARKULAR, PyroAdaptor, FX Commander Pro (128 cues, dual-band)
- **Tuya**: BLE Mesh + Wi-Fi (low-precision, NUNCA pyro <50ms)
- **CubeMesh RE168 + GalaxyLED**
- **Lasers**: Maiman 16/39CH, ILDA 30-60k PPS
- **DMX/Art-Net**: 33 PPS limit, MA3/GMA2 patch

**Hard rules:**
- Pyro real_operation: priority `[serial, usb, artnet]`, BLE banido
- Stub default: `NO_REAL_SENDER` + `disconnected/unknown` (zero dados sintéticos)
- Identity: `portRegistry.aliases[]` colapsa duplicatas cross-transport
- Hot-plug auto-reopen, persistent authorization por VID/PID

---

## 4. Experience Plane — DS unificado, opt-in marketing

```text
src/
├─ pages/             ◄── routes (Editor, Command, Field, Training, Pairing, Strategy, Marketing)
├─ features/          ◄── 12 buckets (barrels READ-ONLY hoje, físico depois)
│   ├─ safety/ timeline/ cue-editor/ showplan/ dockstation/
│   ├─ wfd/ artnet/ fieldbus/ logs/ settings/ nexus/ shared/
│   └─ viewport-tools/ create-flow/
├─ components/editor/ ◄── home física atual (F5.B migra depois)
├─ core/              ◄── safety, pyrosim, system/eventBus
├─ render_ultra/      ◄── WebGPU pipeline + fallbacks
├─ hardware/          ◄── transports, scheduler
├─ ai/                ◄── JOI, Joi compiler v2, runtime, replay
├─ stores/            ◄── slim macro (hardwareSync, uiWorkspace)
├─ store/             ◄── per-domain (fleet, scene, viewport, undo, …)
├─ lib/featureFlags/  ◄── flags canônicas
└─ styles/            ◄── tokens
```

**Design System (FXKONTROL DS v1):**
- Tokens `--ds-*`, `--status-*`, `--segment-*`, `--state-*`
- Tipografia única: `text-ds-{h1 48 / h2 32 / h3 24 / h4 20 / body 16 / label 14 / caption 12}` + `.ds-mono` (JetBrains)
- Fontes: Rajdhani + JetBrains Mono apenas (guard test allow-list)
- Grid editor: topbar 64 / tabs 48 / left 280 / right 320 / timeline 180

**Theming (dois temas, fronteira explícita):**

| Tema | Aplicação | Paleta | Justificativa |
|---|---|---|---|
| **Operacional (default)** | Editor, Command, Field, Training, Pairing, /dev | Vantablack `#050810`, Cyan-dessat `190 70% 58%`, status semantics (Green/Amber/Red) | OLED smear, E-STOP visibility, WCAG AA campo |
| **Commercial (opt-in)** | Landing, Pricing, Comercial, PitchUS, Unsubscribe | `#1A1A1B`, Electric Blue, Safety Orange | Brief marketing premium |

Guard test `commercialThemeScope.guard.spec.ts` impede vazamento.

**Hierarquia de decisão de design:** safety > consolidado > WCAG AA > brief marketing > estética. Brief perde em 1-3.

**Brand:** `FxkLogo` pentágono XLR 5-pin cyan + wordmark `.ds-mono`.

---

## 5. Mapa de fluxos críticos

```text
COMANDO REAL (worst case, 5 gates):
 UI button
  └► uiCommandGateway.fire(cueId)
      └► simulationGuard (workMode != real_operation? advisory)
          └► safetyGate.anyEnforced()
              └► CommandBus.dispatch
                  └► SafetyStateMachine (ARMED required, caller != 'agent')
                      └► verdictForPyroFire (planHash, pyroTransportPolicy)
                          └► safetyBlackBox.append (SHA-256 chain)
                              └► FieldBus.send → MultiTransportLink (priority serial/usb/artnet)
                                  └► LinkHealth track + auto-fallback
                                      └► DeviceEventLog
```

```text
DESIGN/SIM (zero bloqueios):
 UI ─► uiCommandGateway ─► simulationGuard.withSimBypass ─► CommandBus
                                                              └► Show3DEngine (Particle Explosion / Light Point)
```

```text
PHASE GATES:
 ShowPlan ─► VerificationEngine ─► Phase 0 (readiness audit, adapters)
                                ─► Phase 1 (catalog coverage, dry-run)
                                ─► Phase 2 (operator confirmed, hold 1.2s)
                                ─► requestRealOperation (oath + freshness + plan hash)
```

---

## 6. Otimizações estruturais propostas (delta vs hoje)

Mudanças **aditivas e seguras**, sem quebrar invariantes:

1. **Documentar os 4 planos** num único `docs/architecture/v6-overview.md` com diagramas Mermaid (fonte única de verdade arquitetural; substitui leitura de 47 memórias para onboarding).

2. **Mapa de portas (`docs/architecture/entry-points.md`)** listando as únicas portas válidas: `uiCommandGateway`, `aiGuardrail`, `requestRealOperation`, `safetyBlackBox.append`, `unifiedDiscovery`, `deviceAggregator`. Ferramenta de auditoria (test) que falha se algo importar caminhos proibidos.

3. **Ativar fase F5.B incremental** (1 bucket/sprint): mover físico de `components/editor/` para `features/<bucket>/` mantendo barrel re-export por 1 release. Começar por `safety` e `timeline` (mais coesos, já têm guard de barrel proibido).

4. **Render plane: extrair `render_ultra` para `core/render`** alinhando com `core/safety` e `core/pyrosim` (consistência semântica — "core" = motores determinísticos críticos).

5. **Adapter triage como serviço de 1ª classe**: promover `pendingRequiredAdapters` para um `AdapterReadinessService` com pub/sub no `eventBus` (`HARDWARE.READINESS_CHANGED`). HUD passa a reagir em vez de pollar.

6. **safetyBlackBox como stream**: além do ring 500 in-memory, append-only para IndexedDB com export `.fxk-blackbox.jsonl` assinado (forensics pós-show).

7. **Test plane unificado**: hoje há `__tests__`, `test/`, `*.spec.ts`, `*.test.ts`. Padronizar em `*.test.ts` co-located + `__tests__/guard/` para guards arquiteturais (typography, commercial-theme, barrels-proibidos, entry-points).

8. **Feature flags como documento vivo**: gerar `docs/architecture/feature-flags.md` automaticamente de `lib/featureFlags` listando flag, default, owner, status (experimental/stable/deprecated).

9. **Strategic Command Hub fica isolado em Experience Plane** — confirmar que NUNCA importa de `core/safety` ou `hardware/`. Adicionar guard test.

10. **Unreal bridge**: documentar em `docs/architecture/unreal-bridge.md` que `Pixel Streaming = review-only`, voo real exclusivo via `uiCommandGateway`. Universos DMX U6=drone LED preview, U7=pyro preview reservados no exporter.

---

## 7. O que NÃO mudar (invariantes preservadas)

- Quatro planos e suas portas únicas
- 3 modos de trabalho (design/simulation/real_operation)
- Tema operacional Vantablack canônico
- Tipografia DS scale + allow-list
- Guard tests existentes (commercial scope, typography, barrels)
- ShowPlan como canonical truth
- Identity unification + multi-transport
- Honest hardware layer (zero dados sintéticos)
- Black box SHA-256 chain
- AI guardrail (caller=agent banido em ARM/FIRE)

---

## 8. Entregáveis desta arquitetura (se aprovado)

**Documentação (não toca código de produção):**
- `docs/architecture/v6-overview.md` — visão dos 4 planos + Mermaid
- `docs/architecture/entry-points.md` — portas únicas + tabela de proibições
- `docs/architecture/feature-flags.md` — gerador + snapshot atual
- `docs/architecture/unreal-bridge.md` — fronteira review/comando
- `mem://arquitetura/v6-quatro-planos.md` — memória core do projeto

**Guards arquiteturais (testes novos, falham CI se violado):**
- `entryPoints.guard.spec.ts` — proíbe imports cross-plano não autorizados
- `strategicHubIsolation.guard.spec.ts` — Strategy hub não importa core/safety nem hardware
- `renderCoreLocation.guard.spec.ts` — preparar movimentação render_ultra → core/render

**Refactors aditivos (zero breaking):**
- `AdapterReadinessService` (novo arquivo, pub/sub)
- `safetyBlackBox` IndexedDB sink (opt-in via flag)

**F5.B piloto:**
- Mover fisicamente `safety` (1 bucket) — re-export shim no editor por 1 release

---

## Resumo de uma linha

Quatro planos ortogonais (Safety / Show / Hardware / Experience), portas únicas auditadas por guard tests, documentação consolidada como fonte de onboarding, e migração F5.B incremental — sem reescrever uma linha de runtime crítico.
