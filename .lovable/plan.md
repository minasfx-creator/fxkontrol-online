
## Plano v3 — 2-Wire FireOne (CDS) + Demo Show + Festival Stage 3D

Refinamento final consolidando v1 (escopo) + v2 (25 gaps HW/SW/UX) + v3 (mais 25 gaps de segurança, perf, integração, conformidade).

---

## §0 — Princípios não negociáveis
- Zero mudança em `uiCommandGateway`, `safetyStateMachine`, `commandBus`, `workMode`, RLS
- Toda nova superfície honra `mem://honest-hardware-layer` (default disconnected/unknown)
- Toda dispatch passa por `commandJournal` (mem liveops-3-camadas) e carimba `safetyBlackBox`
- 2-Wire em pyro families = **transport exclusivo** (anti double-fire)
- E-STOP <50ms é invariante testado, não aspiração

---

## §1 — Camada física e protocolo 2-Wire CDS

### 1.1 Especificação física (`docs/reference/two-wire-cds-physical-layer.md`)
- DC bias 28V ±10%, current-limit 5A, ripple <2%
- Polaridade-agnóstica (bridge no módulo)
- FSK half-duplex sobre bias, baud 9600 (≤6,5km) ou 19200 (≤2km)
- Termination 120Ω nos dois extremos, par 18 AWG
- Galvanic isolation obrigatória no módulo (ISO1500-class, 2,5kVrms)
- Surge IEC 61000-4-5 classe 4 (4kV par↔par, 6kV par↔terra) — TVS bidir + GDT
- Inrush soft-start: PTC + ramp 100ms (cold-start cap charge)
- Faixa térmica operacional: −20°C a +60°C (módulo recusa FIRE fora)
- Cross-channel isolation ≥500V

### 1.2 Frame protocol (`src/lib/twoWireProtocol.ts`)
```
[PRE 0xAA 0xAA][SYNC 0x7E][ADDR u8][CMD u8][LEN u8][PAYLOAD ≤56B]
[COUNTER u32 monotônico][HMAC-SHA256 truncado 8B][CRC16-CCITT]
```
- **Anti-replay**: monotônico por slave, master persiste em `localStorage`
- **Anti-tamper**: HMAC-SHA256 com PSK gerado no /pairing/two-wire (32B em NVS)
- **Frame max 80B** (limita buffer firmware)
- Opcodes: `POLL, IDENTIFY, STATUS, CONTINUITY_REQ, CONTINUITY_REPLY, ARM, DISARM, FIRE_MASK, E_STOP, BUS_RENUMBER, SET_PSK, FW_VERSION, TEMP_READ`
- **CRC16-CCITT vetores de teste** publicados no doc (8 casos canônicos)

### 1.3 Discriminated union TS
```ts
export type TwoWireCmd =
  | { type:'POLL'; addr:number }
  | { type:'IDENTIFY'; addr:number }
  | { type:'FIRE_MASK'; addr:number; mask:Uint32Array; tFire:number }
  | { type:'E_STOP' /* broadcast addr=0 */ }
  | ...
```

### 1.4 E-STOP broadcast preempção [CRIT]
- `E_STOP` com `addr=0x00` interrompe transação em curso no master em ≤2 byte-times
- Slaves abortam FIRE em ≤2 byte-times (~2ms @9600)
- **Watchdog dual-side**: master sem POLL recebido por 500ms → auto-disarm; slave sem POLL >500ms → drop bias caps em ≤200ms (safe state)
- Spec `eStopBroadcastLatency.spec.ts` valida <50ms com 99 endereços ativos

### 1.5 Continuity thresholds elétricos
- Test current 30mA, NO-fire >50mA (NFPA 1126)
- `<50Ω = OK`, `50–200Ω = WARN`, `open || >200Ω = FAIL`
- `enum ContinuityState { OK, OPEN, SHORT, OUT_OF_RANGE, NO_TEST }` integra com `MuxContinuityReader`

### 1.6 FireOne compat decoder
- `twoWireProtocol` ganha dois decoders: `fxkNative` + `fireoneCompat` (sniff por preamble)
- FXK em 2-wire entra em `dual-listen`: responde ao protocolo do master detectado
- Mapping `fireoneCompat`: `FireOne FIRE OUT n` → `FXK channel n`
- Spec `fireoneCompatRoundtrip.spec.ts`

---

## §2 — Transport, discovery, identidade

### 2.1 `TwoWireTransport` em `fireoneTransport.ts`
- `TransportType += 'two_wire'`, priority `0` (mais alto)
- Honest default: connected mas devices `unknown` até IDENTIFY
- `LinkHealth` estende: `busBiasV, busCurrentA, collisionCount, crcErrorRate60s`

### 2.2 Discovery em Worker (`twoWireBusDiscovery.worker.ts`)
- Scan 1..99 com POLL 80ms/addr, AbortController, progress 5-em-5
- UI mostra progress bar + cancel sempre habilitado
- Resultado parcial é válido

### 2.3 `pyroTransportPolicy` mudanças auditadas
- `PYRO_FIRE_PRIORITY = ['two_wire','serial','usb','artnet','radio']`
- **Novo:** `EXCLUSIVE_FAMILIES = ['fireone-ifmx','fxk16','fxk32q']` → MultiTransportLink usa single-best-link
- 4 call-sites auditados: `MultiTransportLink.selectBestLink`, `transport-auto-fallback`, `safetyBlackBox.evaluatePyroDispatchVerdict`, `useFXK16Bridge.preferredTransport`
- Spec `pyroExclusiveTransport.spec.ts` (anti double-fire)

### 2.4 Identity unification (mem identity-unification-portregistry)
- `busAddress` vira alias do `PhysicalDevice` quando linkMode=`two_wire`
- IFMx serial X em wireless ≡ bus addr 17 em 2-wire ≡ mesmo device

### 2.5 FXK busAddress persistido
- `fxk16FieldConfigStore.busAddress: 0..99` (localStorage host + NVS firmware-decl)
- Wizard detecta colisão e oferece auto-renumber

### 2.6 IDENTIFY com capability bitmask
- Reply: `{ family, fwVersion, busAddress, serialNumber, supportedCommands: u32 bitmask, tempC, biasReadV }`
- Master adapta call set por slave conforme fwVersion

---

## §3 — Safety integration

### 3.1 Phase 2 gate (mem phase2-transition-gate) — novas condições
- 2-wire bus completou POLL cycle ≤30s
- crcErrorRate60s < 0.5%
- Termination confirmada pelo operador no preflight
- `linkMode='two_wire'` exige checkbox "instalação aterrada + surge protegida"

### 3.2 `safetyBlackBox.evaluatePyroDispatchVerdict` enriquece envelope
Carimba: `{ transport:'two_wire', busAddress, busBiasV, busCurrentA, counter, slaveAckTs, planHash }`
- Telemetria rate-limited a 1Hz (não inflar ring 500)

### 3.3 `commandJournal` (mem liveops-3-camadas)
- `recordCommandRequested` + `recordCommandDispatched` para todo frame 2-wire (correlated por commandId)
- Fire-and-forget no uiCommandGateway preservado

### 3.4 `realOnlyGate` aceita handshake 2-wire
- `markHandshakeOk('two_wire', deviceKey)` integra ao mesmo registry

### 3.5 `pairingAuditLog`
- /pairing/two-wire registra success+failure (cap 100 mantido)

### 3.6 `mocksErradicated` guard
- Novo transport não pode ter samples hardcoded; teste estende allow-list

---

## §4 — Demo Show "Main 2021-02-03"

### 4.1 Asset original (não em `public/`)
- Hospedado em **Lovable Cloud Storage** bucket privado `demo-shows/` + signed URL
- Header `MA DATA` documentado em `docs/reference/demo-shows/main-2021-02-03.md` com SHA-256
- **NÃO parseado** (binário grandMA proprietário)

### 4.2 Seed canônico equivalente (`src/data/demoShows/festivalMainStageDemo.ts`)
- 4:30 min, ~120 cues, BPM 128, downbeats hardcoded
- Mix: 18 mines (6 anchors × 3 fileiras), 8 CO₂ jets, 16 movers DMX, 32 drones (logo + grid)
- `provenance:'marketing_hypothesis'` por-cue (não só plan-level)
- `transportRequirements:['two_wire']` no manifest
- Adicionado a `GOLDEN_SHOW_CATALOG` como 3ª seed
- Spec dedicada (`festivalMainStageDemo.spec.ts`): zero error-severity, totalCues>100, anchors resolvidos, dry-run cuesFired===total

### 4.3 Audio sync
- Stem royalty-free 4:30 em Cloud Storage `demo-shows/main-2021-02-03-audio.mp3`
- `_LICENSE.md` ao lado documenta autoria/licença
- `useAudioMasterClock` liga timeline ↔ engine
- SoundLevelPanel mostra SPL meter synced

### 4.4 Overlay anti-confusão
- Componente `DemoModeOverlay` canto inferior, ds-status-warn
- Texto i18n PT/EN: "DEMO · CUES SIMULADOS · NÃO É SHOW REAL"
- WCAG AA contraste, aria-live="polite" anuncia "demo mode" no mount
- Botão "Ver código fonte do seed" abre modal TS pretty-printed

### 4.5 Camera presets
- 4 shots cinematic: front-low, side-pan, drone-bird, audience-pov
- CameraAnimator existente, presets em `festivalDemoCameras.ts`

### 4.6 Export demo (GoldenShowExport)
- ZIP com .fir + CSV + BoM (lista IFMx + FXK16 em 2-wire) + PDF + disclaimer
- BoM gerado por `goldenShowExport.ts` extendido

---

## §5 — Festival Stage 3D

### 5.1 `FestivalStageModel.tsx` (procedural, zero asset binário)
- Deck 18×12×1.2m
- Truss principal pórtico 20×12m (InstancedMesh barras 3cm) + 2 delays laterais 8m
- **LED wall**: 1 PlaneGeometry 14×8m + DataTexture 224×128 RGBA + shader uniform pulse (≠ 28k instances)
- 2 IMAG 4×3m laterais
- Cluster PA: 2 line array hangs (8 boxes) + 2 subs
- 16 movers (InstancedMesh + per-instance color attribute)
- Beam cones: billboards aditivos
- 6 mine anchors (3 front, 2 mid, 1 back) + 4 CO₂ jet anchors
- Plateia 80×60m ground com gradiente noturno

### 5.2 `stageAnchors.ts` tipado
```ts
export type StageAnchorKind = 'mine-front'|'mine-mid'|'mine-back'|'co2-jet-l'|'co2-jet-r'|'mover-truss'|'led-wall'|'pa-cluster';
export interface StageAnchor { id:string; kind:StageAnchorKind; position:[number,number,number]; rotation?:[number,number,number]; }
export const STAGE_ANCHORS_VERSION = 1;
```
- ShowPlan cue `position?: [x,y,z] | { anchorRef:string }` resolvido em `canonicalToEnginePlan`
- Versionado para detectar mismatch seed↔model

### 5.3 Performance
- Target ≤4 draw calls extras vs SkyCanvas baseline
- LOD: camera distance >50m → truss vira boxes, LED wall vira plano emissivo plano
- 1 shadow map opt-in (flag `r_festival_stage_shadows`)
- Spec `festivalStagePerf.spec.ts` mede draw calls headless

### 5.4 Dispose contract (mem M5)
- `useEffect(()=>cleanup,[])` dispõe geometries/materials/textures/RTs

### 5.5 Terrain sync (mem terrain-sync)
- Stage placeable em coords reais (default Maracanã 22.9122°S 43.2302°W) → height via XZ raycaster
- Sun position correta para hora do show

### 5.6 Variants
- `stage: 'arch' | 'festival' | 'festival-small' | 'minimal' | 'none'`
- `festival-small` para mobile (1 mover wall, sem IMAG)

### 5.7 SkyCanvas integration
- `SkyCanvas3D` aceita prop `stage`, default `arch` (retrocompat)
- ShowEngineHost força `festival` para seed `festival-main-stage-demo`
- React.Suspense fallback durante mount

### 5.8 Rota dev
- `/dev/festival-stage-demo` — SkyCanvas + FestivalStageModel + ShowEngineHost loop + HUD play/pause/seek + camera presets

---

## §6 — UX / wizard /pairing/two-wire

5 passos: Welcome → Wiring (SVG inline) → Termination check → Bus scan (worker progress) → Confirm + PSK gen

- `GlobalSafetyBar` chip `2-WIRE` com tooltip `BIAS 28V · 12 nodes · 0 CRC errors`
- `FieldDiagnosticsDock` coluna "Bus" (BLE/USB/2-Wire/RF) + bus health row
- AutoControllerLauncher reconhece IFMx 2-wire e mostra card

---

## §7 — Firmware decl-only

- `firmware/fxk32q-esp32s3/include/fxk32q_two_wire.h` — pinmap RS-485, ISO1500 wiring, NVS keys (`busAddr`, `psk`, `counter`), watchdog 500ms, cold-start safe state, FW update-over-bus bootloader vector (TODO)
- `firmware/_PENDING.md` lista cpp impls pendentes (não bloqueiam web)
- Header parsável por TS importer para validação de constantes (pinmap consistency test)

---

## §8 — Testes (cobertura final)

| Spec | O que valida |
|---|---|
| `twoWireProtocol.spec.ts` | encode/decode RT, CRC vectors, HMAC, counter |
| `twoWireTransport.spec.ts` | connect/disconnect, IDENTIFY, honest default |
| `twoWireBusDiscovery.spec.ts` | scan 1..99, cancel, partial result |
| `eStopBroadcastLatency.spec.ts` | **<50ms com 99 nodes ativos (CRIT)** |
| `twoWireBusCollision.spec.ts` | 2 slaves mesmo addr, master detecta |
| `twoWireReplayAttack.spec.ts` | counter reuse rejeitado |
| `twoWireHmacTamper.spec.ts` | HMAC inválido rejeitado |
| `fireoneCompatRoundtrip.spec.ts` | FXK responde frame FireOne válido |
| `pyroExclusiveTransport.spec.ts` | single-fire em multi-transport |
| `phase2GateTwoWire.spec.ts` | gate exige bus health |
| `festivalMainStageDemo.spec.ts` | seed válida, anchors resolvidos |
| `festivalStagePerf.spec.ts` | draw calls ≤ baseline+4 |
| `festivalStageDispose.spec.ts` | zero leak após unmount |
| `demoShowOverlay.spec.ts` | overlay sempre presente |
| `stageAnchorsContract.spec.ts` | versão + resolver |
| `mocksErradicatedTwoWire.spec.ts` | guard estendido |

**Total: 16 specs novas.** Suite alvo 1310+/1310+ verde.

---

## §9 — Documentação

- `docs/reference/two-wire-cds-physical-layer.md`
- `docs/reference/two-wire-protocol-frames.md` (+ CRC vectors + HMAC test cases)
- `docs/reference/two-wire-bench-test-procedure.md`
- `docs/reference/two-wire-wiring-diagram.svg` (procedural)
- `docs/reference/fireone-compat-mode.md`
- `docs/reference/festival-stage-anchors.md`
- `docs/reference/demo-shows/main-2021-02-03.md`
- `docs/reference/firmware-version-skew-matrix.md`

---

## §10 — Roadmap memória (pós-build)

- `mem://hardware/two-wire-fireone-cds` — protocolo + HMAC + counter + bias + watchdog + claim pilot
- `mem://funcionalidades/festival-main-stage-demo` — seed + model + rota + audio
- atualizar `mem://hardware/fireone-system` (paridade 2-wire)
- atualizar `mem://funcionalidades/skycanvas-v2-stagelayer` (variant festival)
- atualizar `mem://arquitetura/showplan-canonical-source-truth` (transportRequirements)

---

## §11 — Out of scope explícito

- .cpp do firmware FXK32Q 2-wire (apenas headers + TODO)
- Parser binário grandMA proprietário
- GLTF externo de palco
- Mudanças em `uiCommandGateway`/`safetyStateMachine`/`commandBus`/`workMode`/RLS
- Showven PBUS interop em 2-wire (documental only — gap registrado)
- FX Commander Pro 2-wire (gap documental)
- FW update-over-bus implementação (vector reservado, não implementado)

---

## §12 — Inventário final

- **~28 novos arquivos** (TS+specs+docs+SVG+1 worker+1 header)
- **~12 editados** (fireoneTransport, useFXK16Bridge, fxk16FieldConfigStore, MultiTransportLink, unifiedDiscovery, GlobalSafetyBar, FieldDiagnosticsDock, SkyCanvas3D, GOLDEN_SHOW_CATALOG, pyroTransportPolicy, App router, AutoControllerLauncher)
- **2 assets em Cloud Storage** (show .gz + audio .mp3, NÃO em public/)
- **0 binários novos em `public/`**

---

### Decisão pedida
Aprovar plano v3 inteiro (recomendado) ou pedir corte (ex.: pular §5.5 terrain, §5.6 mobile variant, §4.5 cameras)?
