# Rodada 4 v4 — Gaps & Refino: Libraries, 2-Wire, Download-to-Panel

Foco em três frentes que ficaram **abertas/parcialmente plugadas** depois das rodadas anteriores. Cada item lista o gap atual no código, o que entra e o critério de aceite. Nada toca `safety/SafetyStateMachine`/`workMode`. Tudo passa por `uiCommandGateway` quando há comando.

---

## §A — Effect Libraries (Showven/Lidu/Magic/Winda/Amazon + FWsim + EFFECT_LIBRARY)

**Estado real (verificado):**
- `EffectLibrary.tsx` faz spread direto: `EFFECT_LIBRARY ∪ FWSIM_BUILTIN_EFFECTS ∪ getFinaleEffects()` → 527 + 45 + N ≈ 600+ entries num único array sem dedupe.
- `finalePartToEffect` mapeia cor por nome PT/EN local; **não usa o `vdlColorPipeline` canônico** (mem://vdl-color-pipeline-led-accurate). `renderHex` e `paletteHex` divergem do shader 3D.
- Sem fingerprint para casar parts equivalentes vindos de fabricantes diferentes (mesmo Peony 4" Red).
- Sem badge por library na lista, sem filtro por manufacturer, sem indicador de provenance (`validated` vs `pilot` vs `marketing_hypothesis`).
- Thumbnails: só FWsim built-ins (44 PNG). 527 parts importadas mostram emoji.

**Entra:**
1. `src/data/effectsLibraries/effectFingerprint.ts` — `effectFingerprint(e: Effect): string` = SHA-1 truncado de `partType|caliber|color(VDL-canonical)|durationBucket(0.5s)|heightBucket(5m)`. Determinístico, idempotente.
2. `registry.ts`: novo `getMergedEffectsCatalog()` que aplica dedupe por fingerprint, mantendo o de prioridade maior (`EFFECT_LIBRARY > FWSIM_BUILTIN > Finale`), expondo `aliases: string[]` com os ids colapsados.
3. `finalePartToEffect.ts`: trocar resolver de cor pelo `vdlColorPipeline.quantizeRgbToVdl` (já canônico) — `renderHex` passa a bater 1:1 com o SkyCanvas.
4. UI `EffectLibrary.tsx`: chip de manufacturer (Showven/Lidu/Magic/Winda/Amazon/FWsim/Curated), filtro multi-select, contador `N/Total`, badge de `ClaimPolicy` (`validated/pilot/marketing_hypothesis`) lendo `src/lib/claims.ts`.
5. Guard test: `effectsCatalogDedupe.spec.ts` — garante que merge não regrida (≥600 antes, ≤600 após dedupe, alias coverage ≥10%).

**Aceite:**
- `getMergedEffectsCatalog()` retorna < input total e expõe aliases.
- `renderHex` de qualquer Finale part = `quantizeRgbToVdl(part.color).renderHex`.
- Lista mostra chips e contador correto; filtro por manufacturer funciona.
- Suite verde, **zero arquivo binário** novo.

---

## §B — 2-Wire CDS: integração + bus discovery + policy

**Estado real:**
- `twoWireProtocol.ts` (HMAC+CRC+counter) e `twoWireTransport.ts` (WebSerial) **existem standalone**.
- `pyroTransportPolicy.ts` declara `PYRO_FIRE_PRIORITY=[two_wire, serial, usb, artnet]` mas **nada consome** essa policy ainda.
- Sem rota de pareamento, sem bus-scan (POLL 1..32), sem painel de saúde do barramento, sem ligação com `fireoneTransport` (que é quem o `FireOnePanel` realmente usa hoje).

**Entra:**
1. `src/lib/twoWireBusDiscovery.ts` — `scanBus(transport, {addrs:[1..32], timeoutPerAddr:80ms})`: emite `IDENTIFY` por addr, agrega `{addr, fwVersion, deviceType, lastSeenTs}` honesto (ausência = `unknown`, nunca sintético).
2. `src/components/hardware/TwoWireBusPanel.tsx` — read-only: lista 32 endereços com chip `LIVE-RO/UNSEEN/COLLISION`, `crcErrorRate60s`, `busBiasV/busCurrentA` quando o adapter publicar; botão "Rescan" e "Open WebSerial port".
3. `fireoneTransport.ts`: novo método `attachTwoWireSubLink(twoWire: TwoWireTransport)` — quando presente, `fire()` consulta `pyroTransportPolicy.pickTransport(['two_wire','serial','usb','artnet'])` e roteia. `real_operation` rejeita BLE.
4. Rota nova `/pairing/two-wire` (4 passos: Welcome → WebSerial port → IDENTIFY scan → Confirm). Reusa o estilo do `/pairing/usb`. `pairingAuditLog` (mem://) recebe success+failure.
5. Tests:
   - `twoWireBusDiscovery.spec.ts` (mock transport, scan retorna shape correto, ausência ≠ erro).
   - `pyroTransportPolicy.routing.spec.ts` (real_operation: BLE bloqueado; design: passa com warn).

**Aceite:**
- `scanBus()` cobre 32 addrs em ≤2.5s no mock.
- `TwoWireBusPanel` monta sem hardware real e mostra todos `UNSEEN` (honest).
- `fireoneTransport.fire()` em `real_operation` com 2-wire conectado roteia via `two_wire`.
- `/pairing/two-wire` registrado em `App.tsx`, fora de `/command`.

---

## §C — "Download to Panel" (FireOne UltraFire + 2-Wire batch)

**Estado real:**
- `fireoneProtocol.ts` já tem `buildDownloadToModule`/`buildVerifyUltraFire`/`buildUltraFireGo` e wrappers `downloadUltraFire/verifyUltraFire/startUltraFire` na class transport.
- **Não há orquestrador**: nada compila `ShowPlan.pyroCues` em `UltraFireCueData[]` por módulo, faz chunking, retry, verify code, progress, audit. `FireOneExportConsole` só baixa CSV.
- Botão "Download to Panel" não existe na UI.

**Entra:**
1. `src/core/export/UltraFireDownloader.ts`:
   - `compileShowToModules(showPlan): Map<addr, UltraFireCueData[]>` (agrupa por `cue.module`, valida channel 1–32, duration clamp 20–1000ms, max 4000 firings/módulo, max 999 events).
   - `verifyCodeFor(cuesByModule)` = CRC-16 do payload concatenado canônico (determinístico, idempotente).
   - `downloadAll(transport, {onProgress, abortSignal})` — POR módulo: `downloadUltraFire` → aguarda `STATUS` → `verifyUltraFire` → confere reply. Retry 2x com backoff 250→750ms. **NÃO arma**, **NÃO dispara** `ULTRAFIRE_GO` automaticamente.
   - Black box: `safetyBlackBox.recordSafetyNote('ultrafire-download', {planHash, modulesOk, modulesFail, verifyCode})` — usando o `blackBoxRecorder` existente como gancho real (memória menciona `safetyBlackBox` mas não existe).
2. `src/components/editor/DownloadToPanelConsole.tsx`:
   - Card abaixo do `FireOneExportConsole`. Pré-condições visíveis: `level∈READY_FOR_*`, `transport.connected`, `workMode`. Em `design/simulation` mostra "SIM · ADVISORY" e habilita download (mock loopback).
   - Lista módulos com progress bar individual (idle/sending/verifying/ok/fail), código de verify global, total bytes, ETA.
   - Botões: `COMPILE` (preview por módulo), `DOWNLOAD` (Hold-to-Confirm 800ms em `real_operation`, single-click em sim/design), `ABORT`.
   - **Nunca** um botão "FIRE NOW". Disparo continua exclusivo do Show Commander via `uiCommandGateway`.
3. Tests `ultraFireDownloader.spec.ts`:
   - Compilação determinística (mesmo show → mesmo verifyCode).
   - Channel out-of-range é rejeitado antes de tx.
   - Retry: 1 falha CRC + sucesso = 1 retry, status `ok`.
   - Abort no meio para a fila; black box registra parcial.

**Aceite:**
- `compileShowToModules(festivalMainStageDemo)` produz Map não-vazio, verifyCode estável entre runs.
- Painel monta em `/` (editor) e mostra todos os módulos como `idle` quando sem transport.
- Em mock loopback, download de 50 cues × 4 módulos completa em ≤3s na suite.
- 0 chamadas a `safetyStateMachine.transition` ou `executor.fire` no caminho de download.

---

## Detalhes técnicos resumidos

```text
ShowPlan.pyroCues
  └→ UltraFireDownloader.compileShowToModules
       └→ Map<addr, UltraFireCueData[]>  (validate channel/duration/limits)
            └→ verifyCodeFor() ── CRC16 canonical ──┐
            └→ for each addr:                       │
                 buildDownloadToModule  ── tx ──┐   │
                 wait STATUS (≤500ms, retry×2)  │   │
                                                ▼   │
                              buildVerifyUltraFire ─┘
                                  ↓ reply == verifyCode?
                                  ↓ yes → modulesOk++
                                  ↓ no  → modulesFail++ (retry)
            └→ blackBox.record('ultrafire-download', {...})

UI Download path (NEVER fires):
  DownloadToPanelConsole
    └→ uiCommandGateway.downloadShowToPanel()  (NEW gateway method, no SSM transition)
         └→ UltraFireDownloader.downloadAll(transport, …)
```

Transport routing:
```text
fireoneTransport.fire(cmd)
  └→ pyroTransportPolicy.pickTransport(available, workMode)
        priority: two_wire > serial > usb > artnet
        real_operation: BLE → REJECTED
        design/sim: BLE → WARN, allowed
```

## Arquivos

**Novos (~12):**
- `src/data/effectsLibraries/effectFingerprint.ts`
- `src/data/effectsLibraries/__tests__/effectsCatalogDedupe.spec.ts`
- `src/lib/twoWireBusDiscovery.ts`
- `src/lib/__tests__/twoWireBusDiscovery.spec.ts`
- `src/lib/__tests__/pyroTransportPolicy.routing.spec.ts`
- `src/components/hardware/TwoWireBusPanel.tsx`
- `src/pages/PairingTwoWire.tsx`
- `src/core/export/UltraFireDownloader.ts`
- `src/core/export/__tests__/ultraFireDownloader.spec.ts`
- `src/components/editor/DownloadToPanelConsole.tsx`
- `docs/reference/ultrafire-download-flow.md`

**Editados (~6):**
- `src/data/effectsLibraries/finalePartToEffect.ts` (cor via VDL pipeline)
- `src/data/effectsLibraries/registry.ts` (`getMergedEffectsCatalog`)
- `src/components/editor/EffectLibrary.tsx` (chips/filtro)
- `src/lib/fireoneTransport.ts` (`attachTwoWireSubLink` + policy routing)
- `src/lib/pyroTransportPolicy.ts` (`pickTransport(available, workMode)`)
- `src/App.tsx` (rota `/pairing/two-wire`, console no editor)

**Zero** binário novo, **zero** mudança em `SafetyStateMachine`/`CommandBus`/`workMode`.

## Fora de escopo (próxima rodada)
- Edição inline de presets Finale.
- BLE handshake real para FXK16 ↔ 2-wire bridge.
- `safetyBlackBox` canônico (atualmente só memória; usaremos `blackBoxRecorder` como gancho).
- Gate Phase 2 vs 2-wire (precisa `phase2Transition` real, ausente no repo).

Aprovar para implementar nesta rodada?
