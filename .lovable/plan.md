## Rodada 4 — UI + Integração canônica

Fecha as pendências da rodada anterior conectando os módulos já criados (`twoWireBusDiscovery`, `UltraFireDownloader`, `pyroTransportPolicy`, `effectFingerprint`) à UI real e ao `fireoneTransport`.

### §1 — `TwoWireBusPanel` + rota `/pairing/two-wire`

- `src/components/pairing/TwoWireBusPanel.tsx`
  - Botão "Connect 2-Wire" → `WebSerial.requestPort()` → `TwoWireTransport`.
  - Tabela de módulos descobertos (`scanBus`): addr, deviceType, fwVersion, RSSI/health, age.
  - Provenance badge (`live_read_only` em design/simulation, `live` em real).
  - Hold-to-Confirm 800ms para "Test continuity sweep" (read-only IDENTIFY ping, jamais FIRE).
- `src/pages/PairingTwoWire.tsx` + rota lazy em `App.tsx` (`/pairing/two-wire`).
- Tema operacional Vantablack + cyan-dessat (DS tokens, sem laranja).

### §2 — `attachTwoWireSubLink` em `fireoneTransport`

- Em `SerialTransport` (e `FireOneTransportManager`), adicionar método opcional:
  - `attachTwoWireSubLink(twoWireTransport: TwoWireTransport): () => void`
  - Registra o link 2-wire como **sub-transporte de comando pyro** sem substituir o serial primário (downlink CSV/legacy continua).
  - Roteia frames CDS por ele quando `pyroTransportPolicy.pickPyroTransport(workMode)` devolver `two_wire`.
  - Detach idempotente; auto-detach em `disconnect()`.
- Sem mudar `CommandBus` nem `uiCommandGateway`; apenas amplia o transporte pyro.

### §3 — `DownloadToPanelConsole` (UltraFire)

- `src/components/fireone/DownloadToPanelConsole.tsx`
  - Lê `ShowPlan` ativa (`useProjectStore`), instancia `UltraFireDownloader`.
  - UI por módulo: progresso, retries, Verify CRC, status final.
  - Botão "Download to Panel" só habilitado em `workMode ∈ {design, simulation}` **ou** com gate Phase 2 carimbado (não muda gate, só consome).
  - Em `real_operation` sem gate, mostra "ADVISORY" (alinhado a `simulationGuard`).
  - Plug em `FireOneExportConsole` (aba "Download to Panel" ao lado de "CSV Export").

### §4 — Color pipeline canônico via `vdlQuantizer`

- Substituir `vdlColorToHex` local em `finalePartToEffect.ts` por `rgbToNearestVdl` / `VDL_PALETTE` de `src/lib/vdlQuantizer.ts` (fonte canônica que existe no repo).
- Wrapper em `src/data/effectsLibraries/colorResolver.ts`:
  - `resolveEffectColorHex(name: string): { hex, vdl, source: 'name'|'rgb'|'fallback' }`
  - Mantém aliases PT-BR (Amazon/Magic) e cai no `vdlQuantizer` quando o input é hex/rgb.
- `effectFingerprint` consome o mesmo wrapper para garantir bucketing consistente.
- Memo: como `vdlColorPipeline` (mem) **não existe** no repo, `vdlQuantizer` é tratado como o "módulo canônico atual"; nota em `mem://render/vdl-color-resolver-actual`.

### §5 — Testes

- `twoWireBusPanel.spec.tsx` — render mock transport, scan list, hold-to-confirm.
- `fireoneTransport.subLink.spec.ts` — attach/detach idempotente + routing por policy.
- `downloadToPanelConsole.spec.tsx` — gating por workMode, progresso, retry path.
- `colorResolver.spec.ts` — aliases PT, vdlQuantizer fallback, idempotência.

### §6 — Fora de escopo

- Nenhuma mudança em `CommandBus`, `safetyStateMachine`, `uiCommandGateway`, `workMode`, gates Phase 1/2.
- Sem firmware real / handshake BLE.
- Sem mover Finale libraries.

### Arquivos

**Criados (~9):** `TwoWireBusPanel.tsx`, `PairingTwoWire.tsx`, `DownloadToPanelConsole.tsx`, `colorResolver.ts`, 4 specs, 1 nota mem.

**Editados (~4):** `fireoneTransport.ts` (sub-link), `finalePartToEffect.ts` (consome resolver), `effectFingerprint.ts` (consome resolver), `App.tsx` (rota), `FireOneExportConsole.tsx` (aba Download).

Zero binários. Zero impacto em safety/transport policy (apenas consome).
