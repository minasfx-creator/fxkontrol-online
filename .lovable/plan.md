## Objetivo

Que o Pyro Console reconheça módulos **FXK** e **FXK-M1** em **qualquer transporte** (BLE / BLE-LR / USB / Wi-Fi WS / Wi-Fi Direct / 2-Wire / Art-Net), tratar **qualquer ESP32** detectado como módulo válido, **liberar o disparo real** para esses módulos e **remover páginas/bloqueios de compliance** que hoje pertencem só ao admin.

---

## 1 · Reconhecimento universal de módulos FXK / FXK-M1

**Onde está hoje:** `useFireOneHardware` agrega `FireOneModuleStatus` (Map<addr,status>) vindos só de `fireoneController` (RS-485/serial). BLE/USB/WS/Wi-Fi-Direct (`fireoneModuleHardwareBridge`) e Art-Net (`ArtNetModulePanel`) e 2-Wire (`twoWireBusDiscovery`) emitem eventos próprios e **não populam** o mesmo Map. Por isso o `FireOneModulesInline` mostra vazio em qualquer transporte que não seja o XL4 cabeado. Não há campo `model` para FXK / FXK-M1 / IFMx-i32Q.

**O que entregar:**

- Estender `FireOneModuleStatus` com `model: 'FXK' | 'FXK-M1' | 'IFMx-i32Q' | 'ESP32-Generic'` e `transport: BridgeTransport | 'serial' | 'two_wire' | 'artnet'`.
- Criar `src/lib/moduleAggregator.ts` (singleton `moduleAggregator`) que une as 4 fontes:
  1. `fireoneController.discoveredModules` (RS-485)
  2. `fireoneModuleHardwareBridge` (BLE / BLE-LR / USB / WS / Wi-Fi-Direct)
  3. `artnetModuleService` (Art-Net)
  4. `twoWireBusDiscovery` (CDS 2-wire)
  Cada fonte chama `moduleAggregator.upsert({addr, transport, model, firmware, rssi, batt, ignCount, lastSeen})`. Identidade canônica = `${model}#${addr}` (alias por transporte → mesmo Map p/ não duplicar entre BLE+USB do mesmo módulo).
- Detector de modelo em `inferFxkModel(name, fw, vidPid)`:
  - prefixo `FXK-M1*` → `FXK-M1`
  - prefixo `FXK*` ou `IFMx*` → `FXK` / `IFMx-i32Q`
  - qualquer ESP32 (`ESP32-FXK*`, VID 0x303A, hostname `fxk-esp32.local`) sem prefixo conhecido → `ESP32-Generic` (tratado como módulo de 32 canais por padrão).
- `useFireOneHardware().modules` passa a expor o agregado (sem mudar contrato Map, só fonte).
- `FireOneModulesInline`: nova coluna **MODEL**, ícone por transporte (Cable/Radio/Wifi/Bluetooth/Two-Wire), header "Módulos FXK / FXK-M1 (N)". Empty state passa a "Nenhum módulo respondeu via BLE/USB/Wi-Fi/Art-Net/2-Wire ainda."
- `useFireOneHardware().connectionPath` aceita `'ble' | 'usb' | 'websocket' | 'wifi_direct' | 'two_wire' | 'artnet'`.

## 2 · Liberar disparo real para FXK / FXK-M1 / ESP32 em qualquer transporte

- Em `src/lib/pyroTransportPolicy.ts`:
  - `PYRO_FIRE_PRIORITY = ['two_wire','serial','usb','websocket','wifi_direct','artnet','ble_lr','radio']` (BLE clássico continua banido p/ fire por jitter; BLE-LR liberado).
  - `EXCLUSIVE_FAMILIES` adiciona `'fxk'`, `'fxk-m1'`, `'esp32-generic'`.
  - `BANNED_FOR_REAL_FIRE` permanece apenas `ble` (clássico).
- `selectBestPyroTransport('fxk-m1', available, 'real_operation')` passa a retornar transporte real disponível (não-null) p/ qualquer ESP32 conectado.
- Roteamento no `uiCommandGateway` para FIRE: se `model ∈ {FXK, FXK-M1, ESP32-Generic}` → manda via melhor transporte do agregador (em vez de assumir RS-485). Hold-to-Confirm 800ms preservado.

## 3 · Remover páginas / blocos de compliance que hoje são só admin

**Rotas/páginas a remover do app principal** (mover para `src/_admin/` para não quebrar imports, esconder do roteamento):
- `/admin`, `/accreditation` (rotas removidas de `src/App.tsx` + lazy imports). Sidebar perde os itens.
- `ManualComplianceMatrix.tsx` deixa de ser montado em `ReportsPanel`.
- `ComplianceChecklist.tsx` removido do tab Reports.

**Bloqueios "admin-only" desligados (mantendo Black Box e safety crítica):**
- `OperationalModeGuard` deixa `'export'` aceitar `simulate|preview|validate|export|diagnostics|sync_read_only` (compliance gate vira **advisory badge**, não bloqueio).
- `VerificationBar`: status `BLOCKED` por falha de compliance vira `ADVISORY` (cor amber, sem travar fire). E-STOP, ARM/DISARM, hold-to-confirm e SafetyBlackBox **continuam intocados** (regras safety-critical).
- `ExportReadinessPanel` / `LockoutPanel` continuam exibindo, mas advisory: nada bloqueia export ou fire.

**O que NÃO muda (escopo de safety crítico, fora do pedido):**
- E-STOP global, hold-to-confirm 800ms, SafetyStateMachine, BlackBox, oath de produção, plano de show hash, audit trail.
- `requestRealOperation()` continua exigindo Phase 2 grant fresco — apenas o roteamento de transporte é ampliado.

---

## Arquivos previstos

**Novos**
- `src/lib/moduleAggregator.ts` + `__tests__/moduleAggregator.spec.ts`
- `src/lib/inferFxkModel.ts` + `__tests__/inferFxkModel.spec.ts`

**Editar**
- `src/lib/fireoneProtocol.ts` (campo `model`, `transport` em `FireOneModuleStatus`)
- `src/lib/fireoneModuleHardwareBridge.ts` (emitir upsert no aggregator com modelo inferido)
- `src/services/artnetModuleService.ts` (idem)
- `src/lib/twoWireBusDiscovery.ts` (idem)
- `src/hooks/useFireOneHardware.ts` (consumir `moduleAggregator`)
- `src/components/editor/FireOneModulesInline.tsx` (coluna MODEL + ícone por transporte + empty state)
- `src/lib/pyroTransportPolicy.ts` (prioridade ampliada, famílias FXK/M1/ESP32 exclusivas)
- `src/core/hardware/OperationalModeGuard.ts` (compliance vira advisory)
- `src/components/editor/VerificationBar.tsx` (BLOCKED por compliance → ADVISORY)
- `src/components/editor/ReportsPanel.tsx` (drop ManualComplianceMatrix + ComplianceChecklist)
- `src/App.tsx` + `src/layouts/MainLayout.tsx` (remover rotas /admin /accreditation do menu)

**Mover (não deletar) p/ não quebrar memória**
- `src/pages/Admin.tsx`, `src/pages/AccreditationDashboard.tsx`, `src/components/editor/ManualComplianceMatrix.tsx`, `src/components/editor/reports/ComplianceChecklist.tsx` → `src/_admin/`

---

## Validação

- Suite Vitest (espera +6 specs novas):
  - aggregator dedupe cross-transport
  - inferFxkModel para FXK / FXK-M1 / ESP32 / IFMx
  - pyroTransportPolicy retorna transporte real para FXK-M1 em real_operation com BLE-LR ou Wi-Fi-Direct
  - FireOneModulesInline render com 3 módulos heterogêneos (RS-485 + BLE + Art-Net)
  - OperationalModeGuard: compliance fail não bloqueia export
  - smoke test que `/admin` e `/accreditation` retornam 404
- Manual: conectar BLE de fixture ESP32 → módulo aparece no `FireOneModulesInline` com badge "FXK · BLE"; ARM + Hold-Fire dispara via melhor transporte real.

## Fora do escopo

- Reescrever firmware ESP32, mover compliance p/ módulo separado, novo design de admin. Tudo isso fica para uma rodada futura.
